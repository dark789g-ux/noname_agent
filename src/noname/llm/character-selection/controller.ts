import { game, get, lib, _status, ui } from "noname";
import { resolvePlayerBackend, resolvePlayerSeatIndex } from "../backends.js";
import { getLLMConfig } from "../index.js";
import { llmLogger } from "../logger.js";
import { selectTransport } from "../harness/harness.js";
import { cleanPromptText } from "../prompt-format.js";
import { buildSelectionCandidates, type SelectionCandidates } from "./candidates.js";
import { decideOpening, type OpeningDecision } from "./decision.js";
import { localSelection } from "./fallback.js";
import { createOpeningProgress } from "./progress.js";
import type { OpeningPublicFacts } from "./prompt.js";
import { OpeningState } from "./state.js";
import { setOpeningSummary } from "./summary.js";
import { validateCharacterSelection, type CharacterSelectionResult } from "./validation.js";

let nextRound = 0;

function collectMonarchPublicInfo(monarch: any): OpeningPublicFacts["monarch"] | undefined {
	if (!monarch?.identityShown || !monarch.name1) return undefined;
	const seen = new Set<string>();
	const skillIds: string[] = [];
	for (const charName of [monarch.name1, monarch.name2].filter(Boolean)) {
		const character = get.character(charName);
		for (const skill of character?.skills || []) {
			if (skill && !seen.has(skill)) {
				seen.add(skill);
				skillIds.push(skill);
			}
		}
	}
	if (typeof monarch.getSkills === "function") {
		for (const skill of monarch.getSkills(null, false, false) || []) {
			if (skill && !seen.has(skill)) {
				seen.add(skill);
				skillIds.push(skill);
			}
		}
	}
	const hp = monarch.hp !== undefined && monarch.maxHp !== undefined ? String(monarch.hp) + (monarch.maxHp !== monarch.hp ? `/${monarch.maxHp}` : "") : undefined;
	return {
		name: [monarch.name1, monarch.name2]
			.filter(Boolean)
			.map(name => cleanPromptText(get.translation(name)))
			.join(" / "),
		group: monarch.group,
		...(hp !== undefined ? { hp } : {}),
		skills: skillIds.map(skill => ({
			name: cleanPromptText(get.translation(skill)),
			description: cleanPromptText(lib.translate[`${skill}_info`] || ""),
		})),
	};
}

function buildOpeningPublicFacts(player: any, seat: number): OpeningPublicFacts {
	const playerCount = game.players.length;
	const isNonMonarch = game.zhu !== player;
	const stepsAfterMonarch = isNonMonarch && seat > 1 && playerCount > 1 ? seat - 1 : undefined;
	const stepsBeforeMonarch = isNonMonarch && seat > 1 && playerCount > 1 ? playerCount - (seat - 1) : undefined;
	const distanceToMonarch = stepsAfterMonarch !== undefined && stepsBeforeMonarch !== undefined ? Math.min(stepsAfterMonarch, stepsBeforeMonarch) : undefined;
	const monarch = isNonMonarch ? collectMonarchPublicInfo(game.zhu) : undefined;
	return {
		seat,
		identity: cleanPromptText(get.translation(`${player.identity}2`) || player.identity),
		specialIdentity: player.special_identity ? cleanPromptText(get.translation(player.special_identity)) : undefined,
		playerCount,
		...(distanceToMonarch !== undefined ? { distanceToMonarch, stepsAfterMonarch, stepsBeforeMonarch } : {}),
		...(monarch ? { monarch } : {}),
	};
}

export interface PreparedSelection {
	player: any;
	sources: string[];
	preferred: string[];
	snapshot: SelectionCandidates;
}

export interface SelectedOpening {
	job: PreparedSelection;
	decision: OpeningDecision;
	result: CharacterSelectionResult;
}

/** 游戏适配器；模型请求期间不修改 player、公共池或引擎事件队列。 */
export class CharacterOpeningController {
	readonly state = new OpeningState();
	readonly round = ++nextRound;
	private readonly config = getLLMConfig();
	private readonly gameId = (_status as any).llmGameId as string;
	private readonly players = game.players.map(player => ({ player, identity: player.identity, position: player.dataset.position }));
	private readonly monarch = game.zhu;
	private readonly human = game.me;
	private readonly progress: ReturnType<typeof createOpeningProgress>;
	private readonly watchdog: ReturnType<typeof setInterval>;
	private readonly unfinished = new Set<string>();
	private closed = false;

	constructor(private readonly event: any) {
		const total = game.players.filter(player => this.eligible(player) && !player.name1).length;
		this.progress = createOpeningProgress(this.state, total, ui.window || document.body);
		this.watchdog = setInterval(() => {
			if (!this.current()) this.close(true);
		}, 100);
	}

	eligible(player: any): boolean {
		return resolvePlayerBackend(player, this.config, _status as any).kind !== "local";
	}

	current(): boolean {
		return this.state.valid && !this.event.finished && (_status as any).llmGameId === this.gameId && game.zhu === this.monarch && game.me === this.human && this.players.length === game.players.length && this.players.every(({ player, identity, position }) => game.players.includes(player) && player.identity === identity && player.dataset.position === position);
	}

	assertCurrent(): void {
		if (!this.current()) {
			this.close(true);
			throw new Error("选将轮次已失效，拒绝旧结果写回");
		}
	}

	prepare(player: any, sources: readonly string[], preferred: readonly string[] = []): PreparedSelection {
		this.assertCurrent();
		const snapshot = buildSelectionCandidates(sources, get.config("double_character") ? 2 : 1, {
			source: name => get.sourceCharacter(name),
			versions: source => (!_status.noReplaceCharacter && lib.characterReplace[source]?.length ? lib.characterReplace[source].slice() : [source]),
			allowed: name => !!lib.character[name] && !lib.filter.characterDisabled(name),
			describe: name => {
				const character = get.character(name);
				return {
					name,
					label: cleanPromptText(get.translation(name)),
					groups: Object.freeze(get.selectGroup(name).slice()),
					sex: cleanPromptText(get.translation(character.sex)),
					faction: character.group,
					hp: String(character.hp) + (character.maxHp !== character.hp ? `/${character.maxHp}` : ""),
					skills: Object.freeze(
						character.skills.map(skill =>
							Object.freeze({
								name: cleanPromptText(get.translation(skill)),
								description: cleanPromptText(lib.translate[`${skill}_info`] || ""),
							})
						)
					),
				};
			},
		});
		return { player, sources: [...sources], preferred: [...preferred], snapshot };
	}

	async decide(job: PreparedSelection): Promise<SelectedOpening> {
		this.assertCurrent();
		const { player, snapshot } = job;
		const seat = resolvePlayerSeatIndex(player, _status as any, { monarch: (game as any).zhong || game.zhu, playerCount: game.players.length });
		const backend = resolvePlayerBackend(player, this.config, _status as any);
		let decision = await this.state.request(seat, signal => {
			this.progress.update();
			return decideOpening({
				gameId: this.gameId,
				round: this.round,
				playerName: `${seat}号位（选将）`,
				backend,
				snapshot,
				facts: buildOpeningPublicFacts(player, seat),
				budgetSec: this.config.decisionTimeoutSec,
				maxTurns: this.config.maxTurns,
				signal,
				logger: llmLogger,
				transport: selectTransport(backend),
			});
		});
		if (!decision) {
			const logId = llmLogger.start(
				"chooseCharacter",
				`${seat}号位（选将）`,
				{
					enabled: true,
					configured: backend.configured,
					backend: backend.kind,
					model: backend.model,
					providerLabel: backend.label,
				},
				seat
			);
			llmLogger.logSessionMeta(logId, { mode: "full", sessionKey: `${this.gameId}:opening_${this.round}:seat_${seat}` });
			decision = { logId, fallbackReason: "user_skip" };
		}
		if (!this.current()) {
			llmLogger.end(decision.logId, "interrupted");
			this.assertCurrent();
		}
		this.unfinished.add(decision.logId);
		const result = decision.selection || localSelection(snapshot, player.identity, game.zhu?.group, job.preferred);
		// 完成标记在整批提交之前更新，跳过不会抹掉已返回的合法结果。
		this.state.completed++;
		if (!decision.selection) this.state.fallbacks++;
		this.progress.update();
		return { job, decision, result };
	}

	/** 只在主流程顺序调用；真人也使用原 step 1 的初始化副作用。 */
	apply(selected: SelectedOpening): void {
		this.assertCurrent();
		this.revalidate(selected);
		const { player } = selected.job;
		player.init(...selected.result.characters);
		if (player === game.zhu && game.players.length > 4 && !player.isInitFilter("noZhuHp")) {
			player.hp++;
			player.maxHp++;
		}
		this.applyGroup(player, selected.result);
		this.finish(selected);
	}

	applyGroup(player: any, result: CharacterSelectionResult): void {
		const type = get.selectGroup(result.characters[0], true);
		if (type !== "default") player._groupChosen = type;
		if (result.group) player.group = result.group;
		player.node.name.dataset.nature = get.groupnature(player.group);
		player.update();
	}

	revalidate(selected: SelectedOpening): void {
		this.assertCurrent();
		const { result, job } = selected;
		validateCharacterSelection(job.snapshot, {
			characters: result.characters.map((version, i) => ({ ref: job.snapshot.candidates.find(candidate => candidate.source === result.sources[i])?.ref, version })),
			group: result.group,
		});
		const occupied = new Set(game.players.filter(player => player !== job.player).flatMap(player => [player.name1, player.name2].filter(Boolean).map(name => get.sourceCharacter(name))));
		if (result.sources.some(source => occupied.has(source))) throw new Error("选将候选已被占用");
	}

	finish(selected: SelectedOpening): void {
		const { decision, result, job } = selected;
		this.unfinished.delete(decision.logId);
		const reason = decision.toolCall?.reason || `本地 AI 回退（${decision.fallbackReason || "unknown"}）`;
		setOpeningSummary(job.player, { characters: result.characters, group: result.group, reason });
		if (decision.toolCall && decision.selection) {
			llmLogger.logResponse(decision.logId, decision.toolCall, result);
			llmLogger.end(decision.logId, "success");
		} else {
			llmLogger.logAutomaticResponse(decision.logId, result);
			llmLogger.endFallback(decision.logId, decision.fallbackReason || "unknown");
		}
	}

	close(invalidate = false): void {
		if (invalidate) {
			this.state.invalidate();
			for (const logId of this.unfinished) llmLogger.end(logId, "interrupted");
			this.unfinished.clear();
		}
		if (this.closed) return;
		this.closed = true;
		clearInterval(this.watchdog);
		this.progress.close();
	}
}

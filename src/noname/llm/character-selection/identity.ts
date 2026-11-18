import { game, get, lib, _status } from "noname";
import { discardLLMOpeningPreparation, getLLMConfig, prepareLLMGame } from "../index.js";
import { runSelectionBatches } from "./batch.js";
import { CharacterOpeningController, type PreparedSelection, type SelectedOpening } from "./controller.js";

let active: CharacterOpeningController | undefined;

/** 选将重入时废弃旧轮次；非目标模式绝不建立模型请求。 */
export function createIdentityOpening(event: any, retainOpeningResults = false): CharacterOpeningController | undefined {
	const skipped = !!event.llmOpening?.state.skipped;
	active?.close(true);
	active = undefined;
	const enabled = event.llmOpening ? getLLMConfig().enabled : !!lib.config.llm_enabled;
	if (_status.connectMode || _status.mode !== "normal" || _status.brawl || !enabled || event.chosen?.length || event.modchosen || (typeof lib.config.test_game === "string" && lib.config.test_game !== "_")) {
		discardLLMOpeningPreparation();
		return;
	}
	if (!retainOpeningResults) delete event.llmRemainingChoices;
	prepareLLMGame(!!event.llmOpening, retainOpeningResults);
	const controller = new CharacterOpeningController(event);
	if (skipped) controller.state.skip();
	if (!game.players.some(player => controller.eligible(player))) {
		controller.close();
		return;
	}
	active = controller;
	return controller;
}

/** AI 主公的 LLM 候选与主公正常界面一致，而非原 AI 可直接访问的整个池。 */
export async function selectOpeningMonarch(event: any, monarchCandidates: string[], commonCandidates: string[]): Promise<boolean> {
	const opening = event.llmOpening as CharacterOpeningController | undefined;
	if (!opening?.eligible(game.zhu)) return false;
	const count = get.config("choice_zhu");
	const sources = [...new Set([...monarchCandidates, ...commonCandidates.slice(0, count)])];
	const selected = await opening.decide(opening.prepare(game.zhu, sources, monarchCandidates));
	opening.apply(selected);
	return true;
}

function identityCandidateCount(player: any): number {
	return Number(get.config(`choice_${player.identity}`));
}

function releaseUnusedSources(event: any, sources: readonly string[], usedSources: readonly string[]): void {
	const used = new Set(usedSources);
	event.list.push(...sources.filter(source => !used.has(get.sourceCharacter(source))));
}

export async function selectOpeningSelf(event: any, sources: string[]): Promise<boolean> {
	const opening = event.llmOpening as CharacterOpeningController | undefined;
	if (!opening?.eligible(game.me) || event.chosen.length || event.modchosen) return false;
	delete event.llmRemainingChoices;
	if (game.me === game.zhu) {
		const monarchPreferred = sources.filter(name => {
			const versions = lib.characterReplace[name] || [name];
			return versions.some(version => lib.character[version]?.isZhugong);
		});
		event.llmChoice = await opening.decide(opening.prepare(game.me, sources, monarchPreferred));
		// 真正初始化仍交给 identity 的下一阶段，避免重复初始化与主公加血。
		return true;
	}
	// 非主公自身位受 LLM 接管时，主公已初始化并公开；与其余非主公 LLM 座位同批并发。
	for (const source of sources) event.list.remove(source);
	const others = game.players.filter(player => player !== game.me && player !== game.zhu && opening.eligible(player));
	const remainingChoices = new Map<any, SelectedOpening>();
	const sourcesByJob = new Map<PreparedSelection, string[]>();
	const selectedByJob = new Map<PreparedSelection, SelectedOpening>();
	const need = (player: any) => (player === game.me ? 0 : identityCandidateCount(player));
	await runSelectionBatches<any, PreparedSelection, SelectedOpening>([game.me, ...others], {
		eligible: () => true,
		local: () => {},
		canBatch: (batch, next) => event.list.length >= batch.reduce((sum, player) => sum + need(player), need(next)),
		prepare: player => {
			if (player === game.me) {
				const job = opening.prepare(game.me, sources);
				sourcesByJob.set(job, sources);
				return job;
			}
			event.list.randomSort();
			const playerSources = event.list.splice(0, identityCandidateCount(player));
			const job = opening.prepare(player, playerSources);
			sourcesByJob.set(job, playerSources);
			return job;
		},
		decide: job => opening.decide(job),
		commit: (job, selected) => {
			selectedByJob.set(job, selected);
			if (job.player === game.me) {
				event.llmChoice = selected;
			} else {
				remainingChoices.set(job.player, selected);
			}
		},
		release: job => {
			releaseUnusedSources(event, sourcesByJob.get(job)!, selectedByJob.get(job)!.result.sources);
		},
	});
	event.llmRemainingChoices = remainingChoices;
	return true;
}

export async function selectRemainingOpening(event: any): Promise<boolean> {
	let prepared = event.llmOpening as CharacterOpeningController | undefined;
	if (!prepared) return false;
	if (!prepared.current() && !event.llmChoice) {
		// 真人选将设置里的换座不重进 step 0；在最终座位确定后刷新映射。
		// 已选主公及真人结果不重选，也不丢失本座位的选将摘要。
		prepared = createIdentityOpening(event, true);
		event.llmOpening = prepared;
		if (!prepared) return false;
	}
	const opening = prepared;
	const remainingChoices: Map<any, SelectedOpening> | undefined = event.llmRemainingChoices;
	delete event.llmRemainingChoices;
	const players = game.players.filter(player => player !== game.me && player !== game.zhu);
	const sourcesByJob = new Map<PreparedSelection, string[]>();
	const selectedByJob = new Map<PreparedSelection, SelectedOpening>();
	try {
		if (remainingChoices?.size) {
			for (const player of players) {
				const preDecided = remainingChoices.get(player);
				if (preDecided) opening.apply(preDecided);
			}
		}
		const pending = players.filter(player => !remainingChoices?.has(player));
		await runSelectionBatches<any, PreparedSelection, SelectedOpening>(pending, {
			eligible: player => opening.eligible(player),
			local: player => {
				opening.assertCurrent();
				event.list.randomSort();
				event.ai(player, event.list.splice(0, identityCandidateCount(player)), null, event.list);
			},
			canBatch: (batch, next) => event.list.length >= batch.reduce((sum, player) => sum + identityCandidateCount(player), identityCandidateCount(next)),
			prepare: player => {
				event.list.randomSort();
				const sources = event.list.splice(0, identityCandidateCount(player));
				const job = opening.prepare(player, sources);
				sourcesByJob.set(job, sources);
				return job;
			},
			decide: job => opening.decide(job),
			commit: (job, selected) => {
				selectedByJob.set(job, selected);
				opening.apply(selected);
			},
			release: job => {
				releaseUnusedSources(event, sourcesByJob.get(job)!, selectedByJob.get(job)!.result.sources);
			},
		});
	} finally {
		opening.close();
	}
	return true;
}

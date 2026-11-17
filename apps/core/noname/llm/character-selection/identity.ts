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

export async function selectOpeningSelf(event: any, sources: string[]): Promise<boolean> {
	const opening = event.llmOpening as CharacterOpeningController | undefined;
	if (!opening?.eligible(game.me) || event.chosen.length || event.modchosen) return false;
	event.llmChoice = await opening.decide(
		opening.prepare(
			game.me,
			sources,
			game.me === game.zhu
				? sources.filter(name => {
						const versions = lib.characterReplace[name] || [name];
						return versions.some(version => lib.character[version]?.isZhugong);
					})
				: []
		)
	);
	// 真正初始化仍交给 identity 的下一阶段，避免重复初始化与主公加血。
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
	const players = game.players.filter(player => player !== game.me && player !== game.zhu);
	const count = (player: any) => Number(get.config(`choice_${player.identity}`));
	const sourcesByJob = new Map<PreparedSelection, string[]>();
	try {
		await runSelectionBatches<any, PreparedSelection, SelectedOpening>(players, {
			eligible: player => opening.eligible(player),
			local: player => {
				opening.assertCurrent();
				event.list.randomSort();
				event.ai(player, event.list.splice(0, count(player)), null, event.list);
			},
			canPair: (first, second) => event.list.length >= count(first) + count(second),
			prepare: player => {
				event.list.randomSort();
				const sources = event.list.splice(0, count(player));
				const job = opening.prepare(player, sources);
				sourcesByJob.set(job, sources);
				return job;
			},
			decide: job => opening.decide(job),
			commit: (_job, selected) => opening.apply(selected),
			release: job => {
				const used = new Set([get.sourceCharacter(job.player.name1), get.sourceCharacter(job.player.name2)]);
				event.list.push(...sourcesByJob.get(job)!.filter(source => !used.has(get.sourceCharacter(source))));
			},
		});
	} finally {
		opening.close();
	}
	return true;
}

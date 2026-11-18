import skills from "../../../character/standard/skill.js";
import { DecisionSession } from "../apply.js";
import { buildDecisionCandidateSnapshot } from "../action-candidates.js";
import { MoveDecisionSession } from "../move-session.js";
import { callLLMWithTimeout } from "../client.js";
import { buildTools } from "../tools.js";
import { describeDecisionStage } from "../backup-protocol.js";

const output = document.querySelector<HTMLPreElement>("#result")!;
const lines: string[] = [];
const responses: { name: string; arguments: Record<string, any> }[] = [];
const nativeFetch = window.fetch;
let requests = 0;

window.fetch = async (input, init) => {
	const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
	if (!url.startsWith("http://llm-smoke.invalid/")) return nativeFetch(input, init);
	requests++;
	const next = responses.shift();
	if (!next) throw new Error("Unexpected model request");
	return new Response(JSON.stringify({ id: `mock${requests}`, object: "chat.completion", created: 0, model: "mock", choices: [{ index: 0, message: { role: "assistant", content: null, tool_calls: [{ id: `call${requests}`, type: "function", function: { name: next.name, arguments: JSON.stringify({ ...next.arguments, reason: "浏览器固定响应" }) } }] }, finish_reason: "tool_calls" }] }), { headers: { "content-type": "application/json" } });
};

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

async function run() {
	const registry = skills;
	assert(registry, "Standard skill registry is unavailable");
	const owner: any = { name: "owner", playerid: "owner", getCards: () => cards, isIn: () => true };
	const cards = [{ name: "sha", suit: "heart", number: 7, owner }];
	const first = { name: "first", playerid: "first", isIn: () => true, hasSex: () => true, canUse: () => false };
	const second = { name: "second", playerid: "second", isIn: () => true, hasSex: () => true, canUse: (_card, target) => target === first };
	const players = [owner, first, second];
	const runtime: any = {
		getCandidateSkills: event => event.skills,
		getCandidateCards: (_event, _player, ids) => cards.map((card, index) => ({ card, ref: `c${index}`, id: card.name, name: card.name, cardAction: false, skills: ids })),
		getPlayers: () => players,
		getTargetId: player => player.playerid,
		getTargetName: player => player.name,
		getSkillInfo: id => registry[id],
		getCardInfo: () => ({}),
		checkSelectTarget() {},
		autoViewAs: definition => definition,
		getOwner: card => card.owner,
		alivePlayers: () => players,
		deadPlayers: () => [],
		translate: value => value.name || String(value),
		isSkillEligible: (event, _player, id) => event.skills.includes(id),
	};
	const config: any = { url: "http://llm-smoke.invalid/v1", apikey: "test-only", model: "mock", timeoutSec: 5, maxRetries: 0 };
	for (const id of ["zhiheng", "lijian"]) {
		const event = { name: "chooseToUse", player: owner, skills: [id] };
		const snapshot = buildDecisionCandidateSnapshot(event, owner, runtime);
		const session = new DecisionSession(event, snapshot, runtime);
		responses.push({ name: "use_skill", arguments: { skill_name: id } });
		let stage = session.stage;
		let result: any;
		for (let turn = 0; turn < 4; turn++) {
			if (stage) responses.push({ name: `select_${stage.type}s`, arguments: { step_id: stage.id, [`${stage.type}_refs`]: stage.type === "target" ? ["p1", "p2"] : ["c0"] } });
			const response = await callLLMWithTimeout([{ role: "user", content: stage ? describeDecisionStage(stage) : `发动${id}` }], buildTools(event.name, snapshot, stage), config);
			const accepted = session.accept(response);
			if (accepted.result) {
				result = accepted.result;
				break;
			}
			stage = accepted.pending;
		}
		assert(result?.bool === true && result.skill === id, `${id}: incomplete selection`);
		if (id === "lijian") assert(result.targets[0] === first && result.targets[1] === second, "ordered targets changed");
		lines.push(`通过：${id}（真实技能声明 → SDK 模拟响应 → 完整选择结果）`);
	}
	const moved = new MoveDecisionSession({ list: [["牌堆顶", cards], ["牌堆底"]], selectionSpec: { move: "guanxing" } }, { translate: value => value.name, getSuit: card => card.suit });
	const result = moved.accept({ name: "move_cards", arguments: { piles: [[], ["m0"]] } }).result;
	assert(result.moved[1][0] === cards[0], "partition identity changed");
	lines.push("通过：观星分堆、牌序与实体牌守恒");
	lines.push(`通过：${requests} 次真实 SDK 工具请求均由本页模拟，无外部请求`);
	output.textContent = lines.join("\n");
	document.title = "通过 · LLM 技能浏览器冒烟";
}

run()
	.catch(error => {
		output.textContent = [...lines, `失败：${error.stack || error}`].join("\n");
	})
	.finally(() => {
		window.fetch = nativeFetch;
	});

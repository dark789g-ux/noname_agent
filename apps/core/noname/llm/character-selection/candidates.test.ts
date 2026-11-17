import assert from "node:assert/strict";
import test from "node:test";
import { buildSelectionCandidates } from "./candidates.js";
import { localSelection } from "./fallback.js";
import { buildSelectionPrompt } from "./prompt.js";
import { candidates } from "./fixtures.js";
import { validateCharacterSelection } from "./validation.js";

test("候选仅来自给定池，展开允许版本并按来源去重、排除禁将", () => {
	const snapshot = buildSelectionCandidates(["a", "a_variant", "banned", "b"], 2, {
		source: name => (name === "a_variant" ? "a" : name),
		versions: name => (name === "a" ? ["a1", "a_disabled", "a1"] : [name]),
		allowed: name => !["banned", "a_disabled"].includes(name),
		describe: name => ({ name, label: name, faction: "wei", hp: "4", sex: "男", skills: [], groups: [] }),
	});
	assert.deepEqual(
		snapshot.candidates.map(entry => [entry.source, entry.versions.map(version => version.name)]),
		[
			["a", ["a1"]],
			["b", ["b"]],
		]
	);
	assert.equal(Object.isFrozen(snapshot), true);
	assert.equal(Object.isFrozen(snapshot.candidates[0].versions), true);
	assert.throws(() => buildSelectionCandidates([], 2, {} as any), /候选不足/);
});

test("本地回退始终限制在冻结候选，并完成双将和主将势力选择", () => {
	for (const identity of ["zhu", "zhong", "fan", "nei"]) {
		const snapshot = candidates(2);
		const result = localSelection(snapshot, identity, "shu", ["a"], () => 0);
		assert.equal(result.characters.length, 2);
		assert.notEqual(result.sources[0], result.sources[1]);
		validateCharacterSelection(snapshot, {
			characters: result.characters.map((version, i) => ({ ref: snapshot.candidates.find(candidate => candidate.source === result.sources[i])!.ref, version })),
			group: result.group,
		});
	}
});

test("选将提示只包含显式白名单自己的信息和公开主公，不采集其他身份或牌局", () => {
	const messages = buildSelectionPrompt(candidates(), {
		seat: 8,
		identity: "反贼",
		specialIdentity: "贼首",
		playerCount: 8,
		monarch: {
			name: "曹操",
			group: "wei",
			hp: "5",
			skills: [
				{ name: "奸雄", description: "当你受到伤害后，你可以获得对你造成伤害的牌。" },
				{ name: "护驾", description: "主公技，当你需要使用或打出【闪】时，你可以令其他魏势力角色选择是否打出一张【闪】。" },
			],
		},
	});
	const text = String(messages[1].content);
	assert.match(text, /- 你的座位：8号位（共 8 人，主公为 1 号位）/);
	assert.match(text, /- 你的身份：反贼（特殊身份：贼首）/);
	assert.match(text, /- 离主公的距离：初始距离 1（主公下家方向 7 步，主公上家方向 1 步；未计入技能与坐骑修正）/);
	assert.match(text, /- 已公开主公：曹操（势力：wei；体力：5）/);
	assert.match(text, /- 主公技能：\n {2}- 奸雄：当你受到伤害后，你可以获得对你造成伤害的牌。\n {2}- 护驾：/);
	assert.match(text, /a1/);
	assert.doesNotMatch(text, /drawPile|otherPlayers|reasoning_content|hiddenIdentity/);

	const monarchPrompt = String(
		buildSelectionPrompt(candidates(), {
			seat: 1,
			identity: "主公",
			playerCount: 8,
		})[1].content
	);
	assert.match(monarchPrompt, /- 你的座位：1号位（主公，首家行动，共 8 人）/);
	assert.doesNotMatch(monarchPrompt, /离主公的距离|已公开主公/);
});

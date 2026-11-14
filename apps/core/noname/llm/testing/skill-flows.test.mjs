import assert from "node:assert/strict";
import test from "node:test";
import { createDeciderRuntime, choiceEvent, stageTool } from "./decider-runtime.mjs";
import { installLegacyArrays } from "./legacy-arrays.mjs";
import { tool } from "./skill-runtime.mjs";

test("yiji distributes exactly the original cards through repeated real child decisions", async () => {
	const f = await createDeciderRuntime();
	installLegacyArrays(f.moduleRuntime);
	const owner = f.player("guojia");
	const recipient = f.player("recipient");
	const cards = [
		{ name: "sha", suit: "heart" },
		{ name: "shan", suit: "club" },
	];
	const moved = [];
	f.get.cards = () => cards.slice();
	f.game.cardsGotoOrdering = async values => moved.push(...values);
	f.game.playerMap = { guojia: owner, recipient };
	f.game.loseAsync = value => ({
		async setContent() {
			moved.push(value.gain_list);
		},
	});
	owner.chooseCardButton = params => choiceEvent(owner, "chooseButton", { ...params, selectButton: params.select, dialog: { buttons: params.cards.map(link => ({ link })) } }, f.decide);
	owner.chooseTarget = params => choiceEvent(owner, "chooseTarget", { ...params, selectTarget: 1 }, f.decide);
	owner.line = () => {};
	owner.addExpose = () => {};
	f.queue.push(stageTool("button", ["b0"]), stageTool("target", ["p1"]), stageTool("target", ["p0"]));
	await f.lib.skill.yiji.content({}, {}, owner);
	const list = moved.at(-1);
	assert.equal(list.length, 2);
	assert.deepEqual(
		Array.from(list)
			.flatMap(entry => Array.from(entry[1]))
			.sort((a, b) => a.name.localeCompare(b.name)),
		cards.slice().sort((a, b) => a.name.localeCompare(b.name))
	);
	assert.equal(new Set(list.flatMap(entry => Array.from(entry[1]))).size, 2);
	assert.equal(f.requests.length, 3);
	assert.equal(
		f.logs.some(log => log[0] === "endFallback"),
		false
	);
});

test("fanjian decisions belong to the target and unknown hand buttons remain anonymous", async () => {
	const f = await createDeciderRuntime();
	const owner = f.player("zhouyu", [{ name: "tao", suit: "spade" }]);
	const target = f.player("target", [{ name: "shan", suit: "heart" }]);
	const cards = owner.cards;
	let damage = 0;
	f.game.log = () => {};
	target.chat = () => {};
	target.damage = async () => damage++;
	target.chooseControl = params => choiceEvent(target, "chooseControl", params, f.decide);
	target.gainPlayerCard = params => choiceEvent(target, "gainPlayerCard", { ...params, selectButton: 1, getTarget: () => owner, dialog: { buttons: cards.map(link => ({ link, classList: { contains: name => name === "blank" } })) } }, f.decide);
	f.queue.push(stageTool("control", ["o0"]), stageTool("button", ["b0"]));
	await f.lib.skill.fanjian.content({ target }, {}, owner);
	assert.equal(damage, 1);
	for (const request of f.requests) assert.ok(request.messages[0].content.includes('"actor":"target"'));
	const stageText = f.requests[1].messages.at(-1).content;
	assert.ok(stageText.includes("未知牌"));
	assert.equal(stageText.includes("tao"), false);
	assert.equal(stageText.includes("spade"), false);
});

test("qianxin and qinxue grant the reviewed active skills at the original point in the flow", async () => {
	const f = await createDeciderRuntime();
	const owner = f.player("awakening");
	const calls = [];
	owner.awakenSkill = id => calls.push(id);
	owner.addSkills = async id => calls.push(id);
	owner.loseMaxHp = async () => calls.push("loseMaxHp");
	owner.chooseDrawRecover = async () => calls.push("chooseDrawRecover");
	await f.lib.skill.qianxin.content({ name: "qianxin" }, {}, owner);
	assert.deepEqual(calls, ["qianxin", "jianyan", "loseMaxHp"]);
	calls.length = 0;
	await f.lib.skill.qinxue.content({ name: "qinxue" }, {}, owner);
	assert.deepEqual(calls, ["qinxue", "loseMaxHp", "chooseDrawRecover", "gongxin"]);
	assert.ok(f.lib.skill.gongxin.selectionSpec && f.lib.skill.jianyan.selectionSpec);
});

test("gongxin executes only the selected disposal and never repeats card movement", async () => {
	const f = await createDeciderRuntime();
	const owner = f.player("lvmeng");
	const target = f.player("target", [
		{ name: "sha", suit: "heart" },
		{ name: "shan", suit: "club" },
	]);
	const discarded = [];
	target.discard = async cards => discarded.push(...cards);
	owner.chooseToMove_new = prompt => choiceEvent(owner, "chooseToMove_new", { prompt, getParent: () => ({ target }) }, f.decide);
	f.queue.push(tool("move_cards", { piles: [["m1"], ["m0"], []] }));
	await f.lib.skill.gongxin.content({ target }, {}, owner);
	assert.deepEqual(discarded, [target.cards[0]]);
	assert.equal(f.requests.length, 1);
	assert.equal(
		f.logs.some(log => log[0] === "endFallback"),
		false
	);
});

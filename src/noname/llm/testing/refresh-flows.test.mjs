import assert from "node:assert/strict";
import test from "node:test";
import { createDeciderRuntime, choiceEvent, stageTool } from "./decider-runtime.mjs";
import { tool } from "./skill-runtime.mjs";

for (const suit of ["heart", "spade"]) {
	test(`yijue ${suit}: target reveals its own card; the correct follow-up runs once`, async () => {
		const f = await createDeciderRuntime();
		const owner = f.player("guanyu");
		const target = f.player("target", [{ name: "shan", suit }]);
		const calls = [];
		f.get.recoverEffect = () => 1;
		f.game.broadcastAll = (callback, ...args) => callback(...args);
		target.chooseCard = () => choiceEvent(target, "chooseCard", { forced: true, filterCard: () => true, selectCard: 1 }, f.decide);
		target.showCards = async () => calls.push("reveal");
		target.addTempSkill = skill => calls.push(skill);
		target.markSkill = () => {};
		target.recover = async () => calls.push("recover");
		owner.addTempSkill = skill => calls.push(skill);
		owner.gain = async card => calls.push(card);
		owner.chooseBool = prompt => choiceEvent(owner, "chooseBool", { prompt }, f.decide);
		f.queue.push(stageTool("card", ["c0"]));
		if (suit === "heart") f.queue.push(tool("yes"));
		await f.lib.skill.new_yijue.content({ target }, {}, owner);
		assert.equal(calls[0], "reveal");
		if (suit === "heart") assert.deepEqual(calls, ["reveal", target.cards[0], "recover"]);
		else assert.ok(calls.includes("fengyin") && calls.includes("new_yijue_effect"));
		assert.equal(f.requests.length, suit === "heart" ? 2 : 1);
		assert.ok(f.requests[0].messages.some(msg => msg.role === "user" && msg.content.includes('"actor":"target"')));
		assert.equal(
			f.logs.some(log => log[0] === "endFallback"),
			false
		);
	});
}

test("jianyan selects a category then a male recipient using the actual acquired skill", async () => {
	const f = await createDeciderRuntime();
	const owner = f.player("xushu");
	const target = f.player("recipient");
	const card = { name: "sha", suit: "heart" };
	const gained = [];
	f.get.cardPile = filter => (filter(card) ? card : undefined);
	owner.chooseControl = controls => choiceEvent(owner, "chooseControl", { controls }, f.decide);
	owner.chooseTarget = (forced, prompt, filterTarget) => choiceEvent(owner, "chooseTarget", { forced, prompt, filterTarget, selectTarget: 1 }, f.decide);
	owner.showCards = async cards => assert.equal(cards[0], card);
	owner.line = () => {};
	target.gain = async value => gained.push(value);
	f.queue.push(stageTool("control", ["o0"]), stageTool("target", ["p1"]));
	await f.lib.skill.jianyan.content({}, {}, owner);
	assert.deepEqual(gained, [card]);
	assert.equal(f.requests.length, 2);
	assert.equal(
		f.logs.some(log => log[0] === "endFallback"),
		false
	);
});

test("shizhan makes the chosen target use duel on the owner without a material cost", async () => {
	const f = await createDeciderRuntime();
	const owner = f.player("gongsunzan");
	const target = f.player("target");
	const calls = [];
	target.useCard = async (...args) => calls.push(args);
	await f.lib.skill.shizhan.content({ target }, {}, owner);
	assert.equal(calls.length, 1);
	assert.equal(calls[0][0].name, "juedou");
	assert.equal(calls[0][1], owner);
	assert.equal(owner.cards.length, 0);
});

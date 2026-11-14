import assert from "node:assert/strict";
import test from "node:test";
import { createDeciderRuntime, choiceEvent } from "./decider-runtime.mjs";
import { tool } from "./skill-runtime.mjs";

for (const id of ["jijiang1", "hujia"]) {
	for (const success of [true, false]) {
		test(`${id}: real skill asks allies in seat order, ${success ? "stops at success" : "all decline"}`, async () => {
			const f = await createDeciderRuntime();
			const leader = f.player("leader");
			const first = f.player("first", [{ name: id === "hujia" ? "shan" : "sha", suit: "heart", number: 1 }]);
			const second = f.player("second", [{ name: id === "hujia" ? "shan" : "sha", suit: "spade", number: 2 }]);
			const players = [leader, first, second];
			const order = [];
			for (const [index, player] of players.entries()) {
				player.next = players[(index + 1) % players.length];
				player.group = id === "hujia" ? "wei" : "shu";
				player.ai = { shown: 0 };
				player.isOnline = () => false;
				player.addTempSkill = skill => order.push(skill);
				player.chooseToRespond = properties => {
					order.push(player.name);
					return choiceEvent(player, "chooseToRespond", properties, f.decide);
				};
			}
			f.get.attitude = () => 3;
			f.queue.push(tool("pass"), success ? tool("respond_card", { card_ref: "c0" }) : tool("pass"));
			const parent = {
				set() {},
				goto(step) {
					order.push(`goto:${step}`);
				},
			};
			const trigger = {
				skill: "jijiang",
				getParent: () => parent,
				cancel() {
					order.push("cancel");
				},
			};
			await f.lib.skill[id].content({}, trigger, leader);
			assert.deepEqual(order.slice(0, 2), ["first", "second"]);
			assert.equal(f.requests.length, 2);
			assert.ok(f.requests[0].messages[0].content.includes('"actor":"first"'));
			assert.ok(f.requests[1].messages[0].content.includes('"actor":"second"'));
			if (success) assert.equal(id === "hujia" ? trigger.responded : trigger.card.name === "sha", true);
			else if (id === "jijiang1") assert.deepEqual(order.slice(-3), ["jijiang3", "cancel", "goto:0"]);
			assert.equal(
				f.logs.some(log => log[0] === "endFallback"),
				false
			);
		});
	}
}

test("multi-turn cap and invalid proposals fall back without paying a skill cost", async () => {
	for (const kind of ["cap", "invalid", "timeout"]) {
		const f = await createDeciderRuntime({ maxTurns: kind === "cap" ? 1 : 4 });
		const owner = f.player("owner", [{ name: "sha", suit: "heart", number: 1 }]);
		owner.skills = ["zhiheng"];
		const event = { name: "chooseToUse", player: owner, filterCard: () => false };
		f.queue.push(tool("use_skill", { skill_name: "zhiheng" }));
		if (kind === "timeout") f.queue.push(Object.assign(new Error("LLM decision timed out"), { stage: "fetch" }), Object.assign(new Error("LLM decision timed out"), { stage: "fetch" }));
		if (kind === "invalid") f.queue.push(tool("select_cards", { step_id: "skill:zhiheng:card:0", card_refs: ["stale"] }));
		const outcome = await f.decide(event);
		assert.equal(outcome.handled, false);
		assert.equal(owner.cards.length, 1);
		assert.ok(f.logs.some(log => log[0] === "endFallback"));
	}
});

test("a provider response arriving after the total deadline is never committed", async () => {
	const f = await createDeciderRuntime();
	const owner = f.player("owner");
	f.queue.push(() => {
		f.moduleRuntime.run("Date.now = () => Number.MAX_SAFE_INTEGER;");
		return tool("yes");
	});
	const result = await f.decide({ name: "chooseBool", player: owner });
	assert.equal(result.handled, false);
	assert.ok(f.logs.some(log => log[0] === "endFallback" && log[2] === "timeout"));
});

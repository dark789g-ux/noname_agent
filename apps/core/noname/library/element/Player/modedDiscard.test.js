import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function loadModedDiscard() {
	const source = readFileSync(new URL("../player.js", import.meta.url), "utf8");
	const start = source.indexOf("\tmodedDiscard(params) {");
	const end = source.indexOf("\n\t/**", start);
	assert.notEqual(start, -1, "modedDiscard source should exist");
	assert.notEqual(end, -1, "modedDiscard should end before its next documentation block");
	const method = source.slice(start, end).replace("\tmodedDiscard(params) {", "function modedDiscard(params) {");
	return Function("game", "get", "lib", "_status", `return ${method}`);
}

test("modedDiscard keeps both Mod callback receivers, arities, order, and undefined result", () => {
	const calls = [];
	const card = { id: "card" };
	const discarder = { id: "discarder" };
	const player = {
		getModableSkills() {
			return ["dynamic"];
		},
	};
	const game = {
		createEvent() {
			return {
				resolve() {},
				setContent() {},
			};
		},
	};
	const mods = {
		dynamic: {
			canBeDiscarded(...args) {
				calls.push({ name: "canBeDiscarded", receiver: this, args });
				mods.dynamic = {
					cardDiscardable(...replacementArgs) {
						calls.push({ name: "replacementCardDiscardable", receiver: this, args: replacementArgs });
						return false;
					},
				};
				return undefined;
			},
			cardDiscardable() {
				throw new Error("stale cardDiscardable callback should not run");
			},
		},
	};
	const get = {
		is: {
			object(value) {
				return value !== null && typeof value === "object";
			},
		},
		itemtype() {
			return null;
		},
		info(skill) {
			return { mod: mods[skill] };
		},
		priority() {
			return 0;
		},
	};
	const lib = { skill: { global: [] } };
	const _status = {
		event: {
			next: { remove() {} },
			getParent() {
				return { name: "discardEvent" };
			},
		},
	};
	game.expandSkills = () => {};

	const originalAdd = Array.prototype.add;
	Array.prototype.add = function (value) {
		if (!this.includes(value)) {
			this.push(value);
		}
		return this;
	};
	try {
		const modedDiscard = loadModedDiscard()(game, get, lib, _status);
		const event = modedDiscard.call(player, { cards: [card], discarder, log: false });

		assert.deepEqual(
			calls.map(call => [call.name, call.args.length]),
			[
				["canBeDiscarded", 5],
				["replacementCardDiscardable", 4],
			]
		);
		assert.equal(calls[0].receiver, game);
		assert.equal(calls[1].receiver, game);
		assert.deepEqual(calls[0].args, [card, discarder, player, "discardEvent", "unchanged"]);
		assert.deepEqual(calls[1].args, [card, player, "discardEvent", "unchanged"]);
		assert.deepEqual(event.cards, []);
		assert.deepEqual(event.protected_cards, [card]);
		assert.deepEqual(event.skills, ["dynamic"]);
	} finally {
		if (originalAdd === undefined) {
			delete Array.prototype.add;
		} else {
			Array.prototype.add = originalAdd;
		}
	}
});

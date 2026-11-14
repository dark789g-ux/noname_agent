import assert from "node:assert/strict";
import test from "node:test";
import { field } from "./testing/fixtures.mjs";

function reconnectFixture() {
	let callback;
	const empty = () => {};
	const player = {
		dataset: {},
		classList: { remove: empty },
		node: { name: { dataset: {} } },
		addTempClass() {
			return this;
		},
		setModeState: empty,
		isUnseen: () => true,
		setNickname: empty,
		$syncDisable: empty,
		directgain: empty,
		update: empty,
		isDead: () => false,
	};
	const game = {
		onlineID: "me",
		clearConnect: empty,
		saveConfig: empty,
		finishCards: empty,
		clearArena: empty,
		arrangePlayers: empty,
		loop: empty,
		send: empty,
		showHistory: empty,
		loadModeAsync(_mode, next) {
			callback = next;
		},
		createEvent: () => ({ setContent: empty }),
	};
	const lib = {
		config: {},
		translate: {},
		characterPack: {},
		character: {},
		commonArea: new Map(),
		init: {},
		element: { GameEvent: { initialGameEvent: () => ({}) } },
	};
	const ui = {
		auto: { show: empty },
		pause: { show: empty },
		arena: { setNumber: empty },
		updatej: empty,
		updatehl: empty,
		create: { chat: empty, connecting: empty, player: () => player, me: empty },
	};
	const snapshot = {
		number: 1,
		players: { me: { position: 0, equips: [], judges: [], handcards: [], specials: [], expansions: [] } },
	};
	const reinit = field("message", { game, lib, ui, _status: {}, get: { parsedResult: value => value, groupnature: () => "" } }).client.reinit;
	return {
		run(receiver, onreconnect, postReconnect) {
			reinit({ mode: "identity" }, snapshot, {}, "localhost", false, onreconnect, {}, postReconnect);
			callback.call(receiver, {});
		},
	};
}

for (const name of ["postReconnect", "onreconnect"]) {
	test(`${name} callback keeps reinit receiver, argument order and destructive shift`, () => {
		for (const receiver of [undefined, null, { connection: "restored" }]) {
			const fixture = reconnectFixture();
			const first = { card: "sha" };
			const seen = [];
			const tuple = [
				function (...args) {
					seen.push({ receiver: this, args });
				},
				first,
				3,
			];
			fixture.run(receiver, name === "onreconnect" ? tuple : undefined, name === "postReconnect" ? { extension: tuple } : {});
			assert.deepEqual(seen, [{ receiver, args: [first, 3] }]);
			assert.equal(seen[0].receiver, receiver);
			assert.equal(seen[0].args[0], first);
			assert.deepEqual(tuple, [first, 3]);
		}
	});
}

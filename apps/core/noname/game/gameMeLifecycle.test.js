import { gameMethod, contentMethod } from "./gameMeFixture.mjs";
import assert from "node:assert/strict";
import test from "node:test";

test("getMe 对 null 与 undefined 明确失败，并返回已初始化玩家", () => {
	const getMe = gameMethod("getMe");
	assert.throws(() => getMe.call({ me: null }), /local player has not been initialized/i);
	assert.throws(() => getMe.call({ me: undefined }), /local player has not been initialized/i);
	const player = {};
	assert.equal(getMe.call({ me: player }), player);
});

test("clearArena 使用真实方法清理玩家数组并重置 me", () => {
	const removable = {
		removed: false,
		remove() {
			this.removed = true;
		},
	};
	const canvas = {};
	const control = { innerHTML: "control" };
	const arenalog = { innerHTML: "log" };
	const roundmenu = {};
	const timer = {};
	const autonode = {};
	const ui = {
		canvas,
		control,
		arenalog,
		roundmenu,
		timer,
		autonode,
		arena: { childNodes: [canvas, control, arenalog, roundmenu, timer, autonode, removable] },
		sidebar: { innerHTML: "sidebar" },
		cardPile: { innerHTML: "cards" },
		discardPile: { innerHTML: "discard" },
		special: { innerHTML: "special" },
		ordering: { innerHTML: "ordering" },
		playerids: {
			removed: false,
			remove() {
				this.removed = true;
			},
		},
	};
	const game = { players: [{}], dead: [{}], me: {} };
	const clearArena = gameMethod("clearArena", { game, ui });
	clearArena.call(game);
	assert.equal(game.me, null);
	assert.equal(game.players.length, 0);
	assert.equal(game.dead.length, 0);
	assert.equal(removable.removed, true);
	assert.equal(ui.playerids.removed, true);
});

test("gameDraw 工厂保留未初始化 player，供 noGameDraw 内容早退", async () => {
	const next = {
		setContent(content) {
			this.content = content;
		},
	};
	const game = {
		me: undefined,
		players: [],
		createEvent() {
			return next;
		},
	};
	const gameDraw = gameMethod("gameDraw", { game });
	assert.equal(gameDraw.call(game), next);
	assert.equal("player" in next, true);
	assert.equal(next.player, undefined);
	assert.equal(next.num, 4);
	assert.equal(next.content, "gameDraw");

	const gameDrawContent = await contentMethod("gameDraw", {
		_status: { brawl: { noGameDraw: true } },
		game: {
			getMe() {
				throw new Error("noGameDraw must not read me");
			},
		},
		get: {},
		lib: {},
		ui: {},
	});
	await gameDrawContent({ num: 4, targets: [] }, undefined, undefined);
});

test("replaceHandcards 在没有本地玩家或本地玩家不在列表时保留早退", async () => {
	const game = { me: undefined };
	const replaceHandcards = await contentMethod("replaceHandcards", { _status: {}, game, get: {}, lib: {}, ui: {} });
	await replaceHandcards(
		{
			players: [],
			getPlayers() {
				return this.players;
			},
		},
		undefined,
		undefined
	);

	let invoked = false;
	game.me = {
		chooseBool() {
			invoked = true;
			throw new Error("must not choose");
		},
	};
	await replaceHandcards(
		{
			players: [],
			getPlayers() {
				return this.players;
			},
		},
		undefined,
		undefined
	);
	assert.equal(invoked, false);
});

test("gameDraw 工厂按原顺序写入同一个事件，不依赖 setContent 的返回值", () => {
	const writes = [];
	const next = {
		set player(value) {
			writes.push(["player", value]);
		},
		set num(value) {
			writes.push(["num", value]);
		},
		set targets(value) {
			writes.push(["targets", value]);
		},
		setContent(value) {
			assert.equal(this, next);
			writes.push(["content", value]);
			return undefined;
		},
	};
	const player = {};
	const targets = [player];
	const num = owner => (owner === player ? 2 : 4);
	const game = {
		createEvent(name) {
			assert.equal(name, "gameDraw");
			return next;
		},
	};
	const gameDraw = gameMethod("gameDraw", { game });
	assert.equal(gameDraw.call(game, player, num, targets), next);
	assert.deepEqual(writes, [
		["player", player],
		["num", num],
		["targets", targets],
		["content", "gameDraw"],
	]);
});

test("noGameDraw 保留 num 的先读取，但不读取 targets 或检查缺失玩家", async () => {
	const reads = [];
	const gameDraw = await contentMethod("gameDraw", {
		_status: { brawl: { noGameDraw: true } },
		game: {},
		get: {},
		lib: {},
		ui: {},
	});
	await gameDraw(
		{
			get num() {
				reads.push("num");
				return 4;
			},
			get targets() {
				throw new Error("noGameDraw must not read targets");
			},
			getTargets() {
				throw new Error("noGameDraw must not get targets");
			},
		},
		undefined,
		undefined
	);
	assert.deepEqual(reads, ["num"]);
});

test("gameDraw 捕获数量回调一次，并为每个选中玩家调用一次", async () => {
	const draws = [];
	const players = [0, 1, 2].map(id => ({
		id,
		getTopCards(num) {
			draws.push([id, num]);
			return [];
		},
		directgain() {},
		getCards() {
			return [];
		},
	}));
	players.forEach((player, index) => {
		player.next = players[(index + 1) % players.length];
	});
	const called = [];
	let reads = 0;
	const event = {
		get num() {
			reads++;
			return function (player) {
				assert.equal(this, undefined);
				called.push(player);
				return player.id + 2;
			};
		},
		getTargets() {
			return [players[0], players[2]];
		},
	};
	const gameDraw = await contentMethod("gameDraw", {
		_status: {},
		game: { me: undefined },
		get: {
			config() {
				return "disabled";
			},
		},
		lib: { config: { mode: "identity" } },
		ui: {},
	});
	await gameDraw(event, undefined, players[0]);
	assert.equal(reads, 1);
	assert.deepEqual(called, [players[0], players[2]]);
	assert.deepEqual(draws, [
		[0, 2],
		[2, 4],
	]);
});

test("gameDraw 在等待子事件后重新读取当前 me", async () => {
	let resolveDoubleDraw;
	const oldMe = {
		countCards() {
			throw new Error("stale local player");
		},
	};
	const newMe = {
		countCalls: 0,
		countCards() {
			this.countCalls++;
			return false;
		},
	};
	const player = {
		singleHp: true,
		getCards() {
			return [];
		},
		doubleDraw() {
			return new Promise(resolve => {
				resolveDoubleDraw = resolve;
			});
		},
	};
	player.next = player;
	const game = {
		me: oldMe,
		getMe() {
			if (!this.me) throw new Error("missing me");
			return this.me;
		},
	};
	const gameDraw = await contentMethod("gameDraw", {
		_status: {},
		game,
		get: {
			config() {
				return "once";
			},
			mode() {
				return "identity";
			},
			cards() {
				return [];
			},
		},
		lib: { config: { mode: "identity" } },
		ui: {},
	});
	const pending = gameDraw(
		{
			num: 4,
			targets: [newMe],
			getTargets() {
				return this.targets;
			},
		},
		undefined,
		player
	);
	game.me = newMe;
	resolveDoubleDraw();
	await pending;
	assert.equal(newMe.countCalls, 1);
});

test("gameDraw 的手气卡扣币回调切换 me 后，后续弃置与发牌仍作用于新 me", async () => {
	const discarded = {
		discarded: false,
		removeGaintag() {},
		discard() {
			this.discarded = true;
		},
	};
	const oldMe = {
		playerid: "old",
		singleHp: false,
		getCardsCalls: 0,
		getCards() {
			this.getCardsCalls++;
			return [];
		},
		directgain() {},
		countCards() {
			return true;
		},
	};
	oldMe.next = oldMe;
	const newMe = {
		playerid: "new",
		directgainCalls: 0,
		getCards() {
			return [discarded];
		},
		directgain() {
			this.directgainCalls++;
		},
	};
	const game = {
		me: oldMe,
		getMe() {
			if (!this.me) throw new Error("missing me");
			return this.me;
		},
		changeCoin() {
			this.me = newMe;
		},
		addVideo(type, player) {
			assert.equal(type, "lose");
			assert.equal(player, newMe);
		},
		async pause() {},
	};
	const ui = {
		create: {
			dialog() {
				return { close() {} };
			},
			confirm() {
				ui.confirm = { close() {} };
			},
		},
	};
	const gameDraw = await contentMethod("gameDraw", {
		_status: {},
		game,
		get: {
			config() {
				return "once";
			},
			mode() {
				return "identity";
			},
			cards() {
				return [];
			},
			cardsInfo() {
				return [];
			},
		},
		lib: { config: { mode: "identity" } },
		ui,
	});
	await gameDraw(
		{
			num: 4,
			targets: [oldMe],
			getTargets() {
				return this.targets;
			},
			custom: { replace: {} },
			bool: true,
		},
		undefined,
		oldMe
	);
	assert.equal(discarded.discarded, true);
	assert.equal(oldMe.getCardsCalls, 1);
	assert.equal(newMe.directgainCalls, 1);
	assert.deepEqual(newMe._start_cards, [discarded]);
});

test("replaceHandcards 的专属弃置回调切换 me 后，补牌仍归新 me", async () => {
	const oldCard = { removeGaintag() {} };
	const oldMe = {
		playerid: "old",
		getCards() {
			return [oldCard];
		},
		chooseBool() {
			return {
				async forResult() {
					return { bool: true };
				},
			};
		},
	};
	const newMe = {
		playerid: "new",
		directgainCalls: 0,
		directgain() {
			this.directgainCalls++;
		},
	};
	const game = {
		me: oldMe,
		getMe() {
			if (!this.me) throw new Error("missing me");
			return this.me;
		},
		addVideo(type, player) {
			assert.equal(type, "lose");
			assert.equal(player, oldMe);
		},
	};
	const replaceHandcards = await contentMethod("replaceHandcards", {
		_status: {},
		game,
		get: {
			cards() {
				return [];
			},
			cardsInfo() {
				return [];
			},
		},
		lib: {},
		ui: {},
	});
	await replaceHandcards(
		{
			players: [oldMe],
			getPlayers() {
				return this.players;
			},
			otherPile: {
				old: {
					discard() {
						game.me = newMe;
					},
					getCards() {
						return [];
					},
				},
			},
		},
		undefined,
		undefined
	);
	assert.equal(newMe.directgainCalls, 1);
	assert.deepEqual(Array.from(newMe._start_cards), []);
});

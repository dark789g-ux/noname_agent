import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { itemType } from "../library/experimental/symbol.js";

const source = ts.createSourceFile("get.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Get");
function method(name, dependencies) {
	const node = declaration.members.find(node => node.name?.getText(source) === name);
	return new Function(...Object.keys(dependencies), `return ({${node.getText(source)}})[${JSON.stringify(name)}];`)(...Object.values(dependencies));
}

function fixture() {
	const hand = {};
	const player = { judging: [], node: { handcards1: hand, handcards2: {}, equips: {}, judges: {}, expansions: {} } };
	const card = { [itemType]: "card", name: "sha", nature: "fire", parentNode: hand, classList: { contains: () => false } };
	const calls = [];
	const game = { players: [player], dead: [], checkMod: (...args) => { calls.push(args); return "ice"; } };
	const lib = { element: { Card: class Card {} }, natureSeparator: "|" };
	const get = { itemtype: value => value === player ? "player" : value?.[itemType], position: () => "h" };
	get.owner = method("owner", { game, lib });
	return { card, player, game, lib, get, calls };
}

test("owner retains structurally capable experimental cards without requiring a Card instance", () => {
	const { get, card, player } = fixture();
	assert.equal(get.owner(card), player);
	assert.equal(get.owner({ name: "sha" }), undefined);
	card.parentNode = undefined;
	player.judging.push(card);
	assert.equal(get.owner(card), player);
	assert.equal(get.owner(card, "judge"), undefined);
});

test("nature applies the owner's existing Mod to an experimental marked card", () => {
	const { card, player, game, lib, get, calls } = fixture();
	const nature = method("nature", { game, lib, get });
	assert.equal(nature(card, player), "ice");
	assert.deepEqual(calls, [[card, player, "fire", "cardnature", player]]);
});

test("owner does not read card methods until the original zone or judging path requires them", () => {
	const { get, card, player } = fixture();
	const descriptor = { name: "sha", get classList() { throw new Error("unexpected classList read"); } };
	assert.equal(get.owner(descriptor), undefined);
	player.judging.push(card);
	delete card.classList;
	assert.equal(get.owner(card), player);
	assert.throws(() => get.owner(card, "judge"), TypeError);
	player.judging.length = 0;
	assert.throws(() => get.owner(card), TypeError);
});

test("native cards and destiny-based ownership retain their original zone checks", () => {
	const { get, card, player, lib } = fixture();
	const native = Object.assign(new lib.element.Card(), card);
	assert.equal(get.owner(native), player);
	native.parentNode = undefined;
	native.timeout = true;
	native.destiny = player.node.equips;
	const checked = [];
	native.classListContains = (...names) => { checked.push(names); return false; };
	assert.equal(get.owner(native), player);
	assert.deepEqual(checked, [["removing", "feichu", "emptyequip"]]);
	delete native.classListContains;
	assert.throws(() => get.owner(native), TypeError);
});

test("implicit hand ownership applies nature Mods while player=false keeps the opt-out", () => {
	const { card, player, game, lib, get, calls } = fixture();
	const nature = method("nature", { game, lib, get });
	assert.equal(nature(card), "ice");
	assert.equal(nature(card, false), "fire");
	assert.deepEqual(calls, [[card, player, "fire", "cardnature", player]]);
});

test("ownership checks each original card zone without changing the method receiver", () => {
	for (const temporary of [false, true]) {
		for (const [zone, names] of [["handcards1", ["removing"]], ["handcards2", ["removing"]], ["equips", ["removing", "feichu", "emptyequip"]], ["judges", ["removing", "feichu"]], ["expansions", ["removing"]]]) {
			const { get, card, player } = fixture();
			const checked = [];
			card.classList = { contains(name) { assert.equal(this, card.classList); checked.push([name]); return false; } };
			card.classListContains = function (...values) { assert.equal(this, card); checked.push(values); return false; };
			card.parentNode = temporary ? undefined : player.node[zone];
			card.timeout = temporary;
			card.destiny = temporary ? player.node[zone] : undefined;
			assert.equal(get.owner(card), player);
			assert.deepEqual(checked, [names]);
		}
	}
});

test("owner retains property read order and checks capabilities only after a zone match", () => {
	const { get, card, player } = fixture();
	const reads = [];
	const classList = { get contains() { reads.push("contains"); return function (name) { assert.equal(this, classList); assert.equal(name, "removing"); return false; }; } };
	Object.defineProperties(card, {
		timeout: { get() { reads.push("timeout"); return false; } },
		parentNode: { get() { reads.push("parentNode"); return player.node.handcards1; } },
		classList: { get() { reads.push("classList"); return classList; } },
	});
	assert.equal(get.owner(card), player);
	assert.deepEqual(reads, ["timeout", "parentNode", "classList", "contains"]);
});

test("nature preserves Mod receiver and skips owner and position reads for player=false", () => {
	const { card, player, game, lib, get } = fixture();
	const nature = method("nature", { game, lib, get });
	game.checkMod = function (...args) { assert.equal(this, game); assert.deepEqual(args, [card, player, "fire", "cardnature", player]); return "ice"; };
	assert.equal(nature(card, player), "ice");
	get.owner = () => { throw new Error("owner must not be read"); };
	get.position = () => { throw new Error("position must not be read"); };
	assert.equal(nature(card, false), "fire");
	card.nature = true;
	assert.equal(nature(card, player), true);
});

import { config } from "./testing/fixtures.mjs";
import assert from "node:assert/strict";

import test from "node:test";

function loadThemeClick(game) {
	return config("zhishixian", { game }).onclick;
}

test("line theme changes preserve the initialized original function and theme identity", () => {
	const saved = [];
	const original = () => {};
	const theme = () => {};
	const game = { linexy: original, zsOriginLineXy: original, zsMohuaLineXy: theme, saveConfig: (...args) => saved.push(args) };
	const click = loadThemeClick(game);
	click("Mohua");
	assert.equal(game.linexy, theme);
	click("default");
	assert.equal(game.linexy, original);
	assert.deepEqual(saved, [
		["zhishixian", "Mohua"],
		["zhishixian", "default"],
	]);
});

test("default line theme requires initialization instead of replacing the renderer with undefined", () => {
	const original = () => {};
	const saved = [];
	const game = { linexy: original, saveConfig: (...args) => saved.push(args) };
	assert.throws(() => loadThemeClick(game)("default"), TypeError);
	assert.equal(game.linexy, original);
	assert.deepEqual(saved, [["zhishixian", "default"]]);
});

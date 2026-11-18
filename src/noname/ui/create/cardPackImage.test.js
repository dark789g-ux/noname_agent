import assert from "node:assert/strict";
import test from "node:test";
import { applyFullImageFallbackBackground } from "./methods/cardTempNameBackground.js";

test("temporary card backgrounds preserve mode-pack and default resource paths", () => {
	const seen = [];
	const bg = { setBackground: value => seen.push(value) };
	const get = { mode: () => "chess" };
	applyFullImageFallbackBackground(["sha"], "sha", bg, get);
	applyFullImageFallbackBackground(["sha"], "shan", bg, get);
	applyFullImageFallbackBackground(undefined, "sha", bg, get);
	applyFullImageFallbackBackground(["sha"], undefined, bg, get);
	assert.deepEqual(seen, ["mode/chess/card/sha", "card/shan", "card/sha", "card/undefined"]);
});

import { field, config } from "./testing/fixtures.mjs";
import assert from "node:assert/strict";

import test from "node:test";
import { JSDOM } from "jsdom";

test("character sort keeps dynamic registration identity and extension key aliases", () => {
	const sorts = field("characterSort");
	assert.equal(sorts.shiji, undefined);
	const entries = { history: ["liubei"] };
	sorts.mode_extension_shiji = entries;
	assert.equal(sorts.shiji, entries);
	assert.equal(sorts.mode_extension_shiji, entries);
	const second = { heroes: ["caocao"] };
	Object.defineProperty(sorts, "mode_extension_extra", { value: second, configurable: true });
	assert.equal(sorts.extra, second);
});

test("mobile prefix uses the registered sort and retains missing initialization failure", () => {
	const dom = new JSDOM();
	const lib = { config: { buttoncharacter_prefix: "simple" }, characterPack: { shiji: { liubei: {} } }, characterSort: {} };
	const render = field("namePrefix", { lib, get: { translation: () => "仁君" }, document: dom.window.document }).get("手杀").getSpan;
	assert.throws(() => render("手杀", "liubei"), TypeError);
	lib.characterSort.shiji = { history: ["liubei"] };
	assert.match(render("手杀", "liubei"), /君/);
	assert.match(render("手杀", "caocao"), /手杀/);
	dom.window.close();
});

import assert from "node:assert/strict";
import test from "node:test";
import { createModuleRuntime } from "./testing/module-runtime.mjs";

async function fixture(filterCard) {
	const card = { name: "sha", cardid: "card" };
	const info = { filterCard, selectionSpec: true };
	const player = { getCards: () => [card] };
	const runtime = await createModuleRuntime({ lib: { skill: { example: info } }, get: { translation: value => value.name, filter: filter => card => Object.entries(filter).every(([key, value]) => card[key] === value) } });
	const { getCandidateCards } = await runtime.import("noname/llm/candidates.ts");
	return { card, info, player, run: () => getCandidateCards({ filterCard: () => false }, player, ["example"]) };
}

test("loaded candidate filters preserve receiver, identity and exact true", async () => {
	const f = await fixture(
		/** @this {any} */ function (card, player) {
			assert.equal(this, f.info);
			assert.equal(card, f.card);
			assert.equal(player, f.player);
			return true;
		}
	);
	const result = f.run();
	assert.equal(result.length, 1);
	assert.equal(result[0].card, f.card);
	assert.deepEqual(Array.from(result[0].skills), ["example"]);
	assert.equal((await fixture(true)).run().length, 1);
	assert.equal((await fixture(() => 1)).run().length, 0);
	assert.equal((await fixture(undefined)).run().length, 0);
	assert.equal((await fixture(null)).run().length, 0);
});

test("reviewed boolean and engine-normalized object filters are supported", async () => {
	assert.equal((await fixture(false)).run().length, 0);
	assert.equal((await fixture({ name: "sha" })).run().length, 1);
	assert.equal((await fixture({ name: "shan" })).run().length, 0);
	const f = await fixture(42);
	assert.throws(f.run, /Selection filter must/);
});

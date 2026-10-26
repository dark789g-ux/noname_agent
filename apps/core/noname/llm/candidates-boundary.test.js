import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("candidates.ts", readFileSync(new URL("./candidates.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "getCandidateCards");
assert.ok(declaration);
const code = ts.transpileModule(declaration.getText(source).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;

function fixture(filterCard) {
	const card = { name: "sha", cardid: "card" };
	const info = { filterCard };
	const player = { getCards: () => [card] };
	const candidates = new Function("lib", "get", "getRegisteredSkill", "cardToId", `${code}; return getCandidateCards;`)(
		{ skill: { example: info } },
		{ translation: value => value.name },
		(registry, name) => registry[name],
		value => value.cardid
	);
	return { card, info, player, run: () => candidates({ filterCard: () => false }, player, ["example"]) };
}

test("candidate filters preserve receiver, card identity and exact true result", () => {
	const f = fixture(function (card, player) {
		assert.equal(this, f.info);
		assert.equal(card, f.card);
		assert.equal(player, f.player);
		return true;
	});
	const result = f.run();
	assert.equal(result.length, 1);
	assert.equal(result[0].card, f.card);
	assert.deepEqual(result[0].skills, ["example"]);
	assert.equal(fixture(true).run().length, 1);
	assert.equal(fixture(() => 1).run().length, 0);
	assert.equal(fixture(undefined).run().length, 0);
	assert.equal(fixture(null).run().length, 0);
});

test("unsupported non-callable filters retain the existing failure instead of silently filtering", () => {
	assert.throws(() => fixture(false).run(), TypeError);
	assert.throws(() => fixture({ name: "sha" }).run(), TypeError);
});

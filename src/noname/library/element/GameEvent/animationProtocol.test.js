import { contentTestSource } from "../../../llm/testing/content-runtime.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { playerTestSource } from "../Player/testSource.js";

const realContentSource = await contentTestSource();

function source(path) {
	return path === "../player.js" ? playerTestSource() : ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
}
function evaluate(code, runtime) {
	const javascript = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText;
	return new Function(...Object.keys(runtime), `"use strict"; ${javascript}; return callback;`)(...Object.values(runtime));
}
const playerSource = source("../player.js");
const playerClass = playerSource.statements.find(ts.isClassDeclaration);
function method(name, runtime) {
	const node = playerClass.members.find(node => node.name?.getText(playerSource) === name);
	return evaluate(`const callback = ({${node.getText(playerSource)}}).${name};`, runtime);
}
function producers() {
	const bindings = [];
	const runtime = {
		game: {
			createEvent(name) {
				return {
					name,
					setContent(content) {
						bindings.push({ event: this, content, own: Object.hasOwn(this, "animate"), animate: this.animate, cards: this.cards });
					},
				};
			},
		},
		get: {
			itemtype(value) {
				if (Array.isArray(value)) return "cards";
				return value?.kind ?? null;
			},
			is: { object: value => typeof value === "object" && value !== null && !Array.isArray(value) },
		},
		lib: { config: { mode: "identity" }, commonArea: new Map() },
		_status: { event: {} },
	};
	return { bindings, runtime };
}

test("draw writes boolean animation before binding and deletes nodelay without adding defaults", () => {
	const { runtime, bindings } = producers();
	const draw = method("draw", runtime);
	const player = {};
	const absent = draw.call(player, 2);
	assert.deepEqual(bindings[0], { event: absent, content: "draw", own: false, animate: undefined, cards: undefined });
	const hidden = draw.call(player, 2, false);
	assert.equal(bindings[1].animate, false);
	assert.equal(hidden.player, player);
	const configured = draw.call(player, { num: 2, animate: true, nodelay: true });
	assert.equal(configured.animate, false);
	assert.equal(configured.$draw, true);
	assert.equal(Object.hasOwn(configured, "nodelay"), false);
	assert.equal(bindings[2].animate, false);
});

test("gain and expansion keep arbitrary legacy strings, copied positional arrays and configured callback identity", () => {
	for (const name of ["gain", "addToExpansion"]) {
		const { runtime, bindings } = producers();
		const create = method(name, runtime);
		const card = { kind: "card" };
		const cards = [card];
		const player = {};
		const legacy = create.call(player, cards, "extension-animation");
		assert.equal(legacy.animate, "extension-animation");
		assert.notEqual(legacy.cards, cards);
		assert.equal(legacy.cards[0], card);
		assert.equal(bindings[0].animate, "extension-animation");
		const callback = event => (event === legacy ? 500 : Promise.resolve());
		let reads = 0;
		const configured = create.call(player, {
			cards,
			get animate() {
				reads++;
				return callback;
			},
		});
		assert.equal(reads, 1);
		assert.equal(configured.animate, callback);
		assert.equal(configured.cards, cards);
		assert.equal(bindings[1].animate, callback);
		assert.equal(bindings[1].cards, cards);
	}
});

const contentSource = realContentSource;
const content = contentSource.statements.flatMap(node => (ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])).find(node => node.name.getText(contentSource) === "Content").initializer;
function animationPhase(name, runtime) {
	const entry = content.properties.find(node => node.name?.getText(contentSource) === name);
	const stage = entry.initializer.elements.find(node => node.body.statements.some(statement => statement.getText(contentSource).startsWith("let animateTime")));
	const statements = [...stage.body.statements];
	const start = statements.findIndex(statement => statement.getText(contentSource).startsWith("let animateTime"));
	assert.ok(start >= 0);
	return evaluate(
		`const callback = async (event, player, postAnimate, cards) => { ${statements
			.slice(start)
			.map(statement => statement.getText(contentSource))
			.join("\n")} };`,
		runtime
	);
}

test("gain and expansion animation phases read once, invoke the current callback without a receiver and preserve numeric/promise waiting", async () => {
	for (const name of ["gain", "addToExpansion"]) {
		for (const promiseResult of [false, true]) {
			const sequence = [];
			let release;
			const paused = new Promise(resolve => {
				release = resolve;
			});
			const runtime = {
				get: {
					delayx: (...args) => {
						sequence.push(["delayx", ...args]);
						return args[0];
					},
				},
				delay: time => {
					sequence.push(["delay", time]);
					return Promise.resolve();
				},
				game: {
					pause() {
						sequence.push(["pause"]);
						return paused;
					},
					resume() {
						sequence.push(["resume"]);
						release();
					},
					delayx() {
						sequence.push(["final-delay"]);
					},
				},
			};
			const phase = animationPhase(name, runtime);
			let reads = 0;
			let calls = 0;
			const replacement = () => {
				throw new Error("must not reread within the original animation phase");
			};
			let current = function (received) {
				assert.equal(this, undefined);
				assert.equal(received, event);
				calls++;
				current = replacement;
				sequence.push(["callback"]);
				return promiseResult ? Promise.resolve() : 500;
			};
			const event = {
				get animate() {
					reads++;
					return current;
				},
			};
			await phase(event, {}, () => sequence.push(["post"]), []);
			assert.equal(reads, 1);
			assert.equal(calls, 1);
			assert.equal(current, replacement);
			assert.deepEqual(sequence, promiseResult ? [["callback"], ["pause"], ["post"], ["resume"], ["final-delay"]] : [["callback"], ["delayx", 500, 500], ["delay", 500], ["pause"], ["post"], ["resume"], ["final-delay"]]);
		}
	}
});

test("unrecognized strings and disabled animation preserve the immediate post-animation branch", async () => {
	for (const name of ["gain", "addToExpansion"]) {
		const phase = animationPhase(name, {});
		for (const animate of [undefined, false, true, "extension-animation"]) {
			let calls = 0;
			await phase({ animate }, {}, () => calls++, []);
			assert.equal(calls, 1);
		}
	}
});

function findExpressionInModuleTree(entryRelativePath, predicate) {
	const seen = new Set();
	const queue = [new URL(entryRelativePath, import.meta.url)];
	while (queue.length) {
		const url = queue.shift();
		if (seen.has(url.href)) continue;
		seen.add(url.href);
		const ast = ts.createSourceFile(url.href, readFileSync(url, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
		let match;
		function visit(node) {
			if (!match && predicate(node, ast)) match = { sourceFile: ast, expression: node };
			if (!match) ts.forEachChild(node, visit);
		}
		visit(ast);
		if (match) return match;
		for (const statement of ast.statements) {
			if (ts.isImportDeclaration(statement) && statement.moduleSpecifier.text.startsWith("./")) {
				queue.push(new URL(statement.moduleSpecifier.text, url));
			}
		}
	}
	return null;
}

test("the real huicui animate producer retains giver/card identity and argument order", () => {
	const found = findExpressionInModuleTree(
		"../../../../character/huicui/skill.js",
		(node, skillSource) => ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "set" && node.arguments[0]?.text === "animate" && ts.isFunctionExpression(node.arguments[1]) && node.arguments[1].getText(skillSource).includes("givers[i].$give")
	);
	assert.ok(found, "real skill assignment must remain reachable in the source");
	const expression = found.expression.arguments[1];
	const callback = evaluate(`const callback = ${expression.getText(found.sourceFile)};`, {});
	const cards = [{}, {}];
	const player = {};
	const calls = [];
	const givers = cards.map((card, index) => ({
		$give(actualCard, actualPlayer) {
			calls.push([this, actualCard, actualPlayer, index]);
		},
	}));
	assert.equal(callback({ player, cards, givers }), 500);
	assert.deepEqual(calls, [
		[givers[0], cards[0], player, 0],
		[givers[1], cards[1], player, 1],
	]);
});

test("invalid legacy callback results keep the original waiting failure", async () => {
	for (const name of ["gain", "addToExpansion"]) {
		let calls = 0;
		await assert.rejects(
			animationPhase(name, {})(
				{
					animate: () => {
						calls++;
						return "invalid-waiting";
					},
				},
				{},
				() => {
					throw new Error("must not silently skip the failed waiting branch");
				},
				[]
			),
			TypeError
		);
		assert.equal(calls, 1);
	}
});

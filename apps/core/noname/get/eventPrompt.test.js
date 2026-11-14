import { contentTestSource } from "../llm/testing/content-runtime.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const realContentSource = await contentTestSource();

const source = ts.createSourceFile("get.js", readFileSync(new URL("index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Get");
const method = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === "evtprompt");
assert.ok(method);
const setPrompt = new Function("next", "str", method.body.getText(source));

function eventWithPrompt(prompt) {
	const writes = [];
	const event = {
		prompt,
		set(key, value) {
			writes.push([key, value]);
			this[key] = value;
			return this;
		},
	};
	return { event, writes };
}

test("evtprompt retains text splitting, truthiness and write order", () => {
	for (const [prompt, input, expected] of [
		[undefined, "plain", [["prompt", "plain"]]],
		[false, "plain", [["prompt", "plain"]]],
		["existing", "plain", [["prompt2", "plain"]]],
		[
			undefined,
			"###main###secondary",
			[
				["prompt", "main"],
				["prompt2", "secondary"],
			],
		],
		[undefined, "######secondary", [["prompt2", "secondary"]]],
		[undefined, "###main###", [["prompt", "main"]]],
		["existing", "###main###secondary", [["prompt2", "###main###secondary"]]],
	]) {
		const { event, writes } = eventWithPrompt(prompt);
		setPrompt(event, input);
		assert.deepEqual(writes, expected);
	}
});

const contentSource = realContentSource;
let promptBranch;
function findBranch(node) {
	if (ts.isIfStatement(node) && node.expression.getText(contentSource) === 'typeof info.prompt2 == "function"') promptBranch ??= node;
	ts.forEachChild(node, findBranch);
}
findBranch(contentSource);
assert.ok(promptBranch);
const emitSkillPrompt = new Function("info", "next", "trigger", "player", "event", "lib", "skill", promptBranch.getText(contentSource));

test("Skill secondary prompts are evaluated once; false metadata emits nothing", () => {
	const trigger = {};
	const player = {};
	const event = { triggername: "test", indexedData: 123 };
	const forbidden = new Proxy(
		{},
		{
			get() {
				assert.fail("false metadata must not read translations");
			},
		}
	);
	const disabled = eventWithPrompt("main");
	emitSkillPrompt({ prompt2: false }, disabled.event, trigger, player, event, forbidden, "test");
	assert.deepEqual(disabled.writes, []);
	let calls = 0;
	const info = {
		prompt2(...args) {
			calls++;
			assert.equal(this, info);
			assert.deepEqual(args, [trigger, player, "test", 123]);
			return "rendered";
		},
	};
	const evaluated = eventWithPrompt("main");
	emitSkillPrompt(info, evaluated.event, trigger, player, event, forbidden, "test");
	assert.equal(calls, 1);
	assert.deepEqual(evaluated.writes, [["prompt2", "rendered"]]);
});

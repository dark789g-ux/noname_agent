import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("ContentCompiler.ts", readFileSync(new URL("./ContentCompiler.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "ContentCompiler");
assert.ok(declaration);

function createCompiler() {
	const javascript = ts.transpileModule(`${declaration.getText(source)}\nreturn ContentCompiler;`, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
	const ContentCompiler = new Function("lib", javascript)({ element: { content: {}, contents: {} } });
	return new ContentCompiler();
}

function trackedOutput(calls, input) {
	const output = async () => {};
	Object.defineProperties(output, {
		compiled: {
			configurable: true,
			set(value) {
				calls.push(`compiled:${value}`);
			},
		},
		type: {
			configurable: true,
			set(value) {
				calls.push(`type:${value}`);
			},
		},
		original: {
			configurable: true,
			set(value) {
				calls.push(value === input ? "original:input" : "original:other");
			},
		},
	});
	return output;
}

test("metadata writes retain compiler execution and observable property order", () => {
	const calls = [];
	const input = () => {};
	let stage = "before";
	class OrderedCompiler {
		filter(content) {
			calls.push(content === input ? "filter:input" : "filter:other");
			return true;
		}
		compile(content) {
			calls.push(content === input ? "compile:input" : "compile:other");
			stage = "after";
			return trackedOutput(calls, input);
		}
		get type() {
			calls.push("type:get");
			return stage;
		}
	}
	const compiler = createCompiler();
	compiler.addCompiler(new OrderedCompiler());
	const first = compiler.compile(input);
	const second = compiler.compile(input);
	assert.equal(second, first);
	assert.deepEqual(calls, ["filter:input", "compile:input", "compiled:true", "type:get", "type:after", "original:input"]);
});

test("a failed compile does not write metadata or populate the cache", () => {
	const calls = [];
	const input = () => {};
	class FailingCompiler {
		filter() {
			calls.push("filter");
			return true;
		}
		compile() {
			calls.push("compile");
			throw new Error("compile failed");
		}
		get type() {
			calls.push("type:get");
			return "never";
		}
	}
	const compiler = createCompiler();
	compiler.addCompiler(new FailingCompiler());
	assert.throws(() => compiler.compile(input), /compile failed/);
	assert.throws(() => compiler.compile(input), /compile failed/);
	assert.deepEqual(calls, ["filter", "compile", "filter", "compile"]);
});

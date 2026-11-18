import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { build } from "vite";
import { parse, compileScript, compileTemplate } from "vue/compiler-sfc";

test("身份模式独立构建复用 noname 公共服务，不重复打包 LLM 单例", async () => {
	const root = fileURLToPath(new URL("../../../", import.meta.url));
	const result = await build({
		configFile: false,
		root,
		logLevel: "error",
		build: {
			write: false,
			target: ["chrome91", "safari16.4"],
			minify: false,
			rollupOptions: { preserveEntrySignatures: "strict", input: "mode/identity.js", external: ["noname", "vue", "dedent"] },
		},
	});
	assert.ok(!Array.isArray(result) && "output" in result);
	const chunk = result.output.find(entry => entry.type === "chunk");
	assert.ok(chunk?.type === "chunk");
	assert.ok(chunk.imports.includes("noname"));
	assert.match(chunk.code, /selectOpeningMonarch/);
	assert.doesNotMatch(chunk.code, /class LLMLogger|class SessionRegistry|class CharacterOpeningController/);
	assert.ok(Object.keys(chunk.modules).some(path => path.replaceAll("\\", "/").endsWith("/mode/identity/index.ts")));
	assert.ok(!Object.keys(chunk.modules).some(path => path.replaceAll("\\", "/").includes("/llm/character-selection/")));
});

test("选将日志与选将进度 Vue 模板和脚本可编译", async () => {
	for (const [relativePath, id] of [
		["../../ui/create/llmLog/vue/components/LLMDecisionBlock.vue", "llm-decision-block"],
		["./OpeningProgress.vue", "llm-opening-progress"],
	]) {
		const filename = fileURLToPath(new URL(relativePath, import.meta.url));
		const { descriptor, errors } = parse(await readFile(filename, "utf8"), { filename });
		assert.deepEqual(errors, []);
		const script = compileScript(descriptor, { id });
		const template = compileTemplate({
			filename,
			id,
			source: descriptor.template!.content,
			compilerOptions: { bindingMetadata: script.bindings },
		});
		assert.deepEqual(template.errors, []);
	}
});

test("新增选将实现及测试文件均不超过 500 行", async () => {
	const directory = new URL("./", import.meta.url);
	for (const filename of await readdir(directory)) {
		if (!/\.(?:ts|mjs|vue)$/.test(filename)) continue;
		const source = await readFile(new URL(filename, directory), "utf8");
		assert.ok(source.trimEnd().split("\n").length <= 500, filename);
	}
});

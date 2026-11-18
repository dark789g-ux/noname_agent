import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "vite";

test("Get implementation graph compiles for supported browsers without bundling engine singletons", async () => {
	const root = fileURLToPath(new URL("../../", import.meta.url));
	const result = await build({
		configFile: false,
		root,
		logLevel: "error",
		build: {
			write: false,
			minify: false,
			target: ["chrome91", "safari16.4"],
			rollupOptions: {
				input: "noname/get/index.js",
				preserveEntrySignatures: "strict",
				external: id => id === "noname" || id === "pinyin-pro" || id === "jszip" || id.startsWith("@/") || id === "../library/skillRegistry.js",
			},
		},
	});
	assert.ok(!Array.isArray(result) && "output" in result);
	const chunk = result.output.find(output => output.type === "chunk");
	assert.ok(chunk?.type === "chunk");
	for (const name of ["Get", "get", "setGet", "Is", "Promises"]) assert.ok(chunk.exports.includes(name), name);
	assert.ok(chunk.imports.includes("noname"));
	const modules = Object.keys(chunk.modules).map(path => path.replaceAll("\\", "/"));
	assert.ok(modules.some(path => path.endsWith("/noname/get/Get.ts")));
	assert.ok(modules.some(path => path.endsWith("/noname/get/intro/nodeIntro.ts")));
	assert.ok(!modules.some(path => path.endsWith("/noname.js")));
});

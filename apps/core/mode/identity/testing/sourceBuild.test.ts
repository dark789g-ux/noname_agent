import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "vite";
import { individualSourceTargets } from "../../../scripts/individualSourceTargets.js";

test("the actual source-copy targets contain a recompilable standalone identity mode", async () => {
	const core = fileURLToPath(new URL("../../../", import.meta.url));
	const tempRoot = join(tmpdir(), "opencode");
	await mkdir(tempRoot, { recursive: true });
	const directory = await mkdtemp(join(tempRoot, "identity-source-"));
	try {
		const targets = individualSourceTargets("mode", "mode/identity.js", false);
		assert.deepEqual(targets, [
			{ src: "mode/identity.js", dest: "src/mode" },
			{ src: "mode/identity", dest: "src/mode" },
		]);
		for (const target of targets) {
			const dest = join(directory, target.dest);
			await mkdir(dest, { recursive: true });
			await cp(join(core, target.src), join(dest, basename(target.src)), { recursive: true });
		}
		const result = await build({
			configFile: false,
			root: join(directory, "src"),
			logLevel: "error",
			build: {
				write: false,
				minify: false,
				target: ["chrome91", "safari16.4"],
				rollupOptions: { input: "mode/identity.js", external: ["noname", "dedent"], preserveEntrySignatures: "strict" },
			},
		});
		assert.ok(!Array.isArray(result) && "output" in result);
		const chunk = result.output.find(output => output.type === "chunk");
		assert.ok(chunk?.type === "chunk");
		assert.ok(chunk.imports.includes("noname"));
		assert.deepEqual([...chunk.exports].sort(), ["default", "type"]);
		assert.doesNotMatch(chunk.code, /class CharacterOpeningController/);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

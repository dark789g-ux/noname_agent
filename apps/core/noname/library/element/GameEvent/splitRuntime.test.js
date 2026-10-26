import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("split GameEvent loads as real ES modules and preserves class and lifecycle contracts", () => {
	const result = spawnSync(process.execPath, ["--experimental-vm-modules", fileURLToPath(new URL("./splitRuntimeFixture.mjs", import.meta.url))], { encoding: "utf8" });
	assert.equal(result.status, 0, result.stdout + result.stderr);
	assert.match(result.stdout, /queue verified/);
});

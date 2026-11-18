import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("the real SP card pack loads its registries and preserves their identity and callbacks", () => {
	const result = spawnSync(process.execPath, ["--experimental-vm-modules", fileURLToPath(new URL("./runtimeFixture.mjs", import.meta.url))], { encoding: "utf8" });
	assert.equal(result.status, 0, result.stdout + result.stderr);
	assert.match(result.stdout, /real SP card pack/);
});

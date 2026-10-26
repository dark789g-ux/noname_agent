import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

for (const pack of ["bingshi", "onlyOL"]) {
	test(`the real ${pack} character entry registers its split skills once with original identities`, () => {
		const result = spawnSync(process.execPath, ["--experimental-vm-modules", fileURLToPath(new URL("./characterSkillModulesFixture.mjs", import.meta.url)), pack], { encoding: "utf8" });
		assert.equal(result.status, 0, result.stdout + result.stderr);
		assert.match(result.stdout, new RegExp(`real ${pack} character pack`));
	});
}

import assert from "node:assert/strict";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { isMain } from "./isMain";

const entry = resolve("scripts/build.ts");
const url = pathToFileURL(entry).href;

test("the runtime's explicit main flag has priority", () => {
	assert.equal(isMain({ url, main: false }, entry), false);
	assert.equal(isMain({ url: "file:///different.ts", main: true }, entry), true);
});

test("older runtimes recognize absolute and relative entry paths", () => {
	assert.equal(isMain({ url }, entry), true);
	assert.equal(isMain({ url }, "scripts/build.ts"), true);
	assert.equal(isMain({ url }, "scripts/../scripts/build.ts"), true);
	assert.equal(isMain({ url }, "scripts/isMain.ts"), false);
});

test("a missing entry does not execute the script", () => {
	assert.equal(isMain({ url }, ""), false);
	const meta = { url };
	const previous = process.argv[1];
	try {
		delete process.argv[1];
		assert.equal(isMain(meta), false);
	} finally {
		process.argv[1] = previous;
	}
});

test("importing the actual build script does not run a build", () => {
	const imported = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", `await import(${JSON.stringify(url)}); console.log("build-import-complete");`], { encoding: "utf8" });
	assert.equal(imported.status, 0, imported.stderr);
	assert.equal(imported.stdout.trim(), "build-import-complete");
	assert.doesNotMatch(imported.stdout, /transforming|rendering chunks|built in/);
});

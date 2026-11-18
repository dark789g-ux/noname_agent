import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import test from "node:test";

const core = fileURLToPath(new URL("../../../", import.meta.url));
const files = new Set(JSON.parse(readFileSync(new URL("./code-scope.json", import.meta.url), "utf8")));
const directories = ["noname/library/element/content", "character/refresh/skills", "character/extra/skills", "character/standard/skills", "noname/llm/testing"];

function collect(directory) {
	for (const entry of readdirSync(resolve(core, directory), { withFileTypes: true })) {
		const path = `${directory}/${entry.name}`;
		if (entry.isDirectory()) collect(path);
		else if (/\.(?:[cm]?[jt]s|json|vue)$/.test(entry.name)) files.add(path);
	}
}

test("all task entry points, implementation, types, tests and this checker stay within 500 physical lines", () => {
	for (const directory of directories) collect(directory);
	const failures = [];
	for (const file of files) {
		const text = readFileSync(resolve(core, file), "utf8");
		const lines = text.length ? text.replace(/\n$/, "").split("\n").length : 0;
		if (lines > 500) failures.push(`${file}: ${lines}`);
	}
	assert.deepEqual(failures, [], failures.join("\n"));
});

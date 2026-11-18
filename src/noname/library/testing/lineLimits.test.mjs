import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const directories = ["contracts", "configuration", "registries", "rules", "network", "runtime", "ui", "debug", "testing", "element/Player"];
const tests = ["bossImport", "characterSort", "commonArea", "lineTheme", "menuBlur", "menuBridge", "menuInputPersistence", "nodeLifecycle", "parentFallbackFilter", "playerLimit", "reconnectReceiver", "skillErrors", "skillViewAs", "recastBoundary"];

export function physicalLines(source) {
	if (!source.length) return 0;
	return source.split(/\r\n|\n|\r/).length - (/\r\n$|[\n\r]$/.test(source) ? 1 : 0);
}

function collect(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) return collect(path);
		return /\.(?:[cm]?[jt]s|json)$/.test(entry.name) ? [path] : [];
	});
}

test("split library modules and affected tests contain at most 500 physical lines", () => {
	const files = [resolve(root, "index.js"), resolve(root, "element/player.ts"), ...directories.flatMap(directory => collect(resolve(root, directory))), ...tests.map(name => resolve(root, `${name}.test.js`)), resolve(root, "../llm/target-range.test.ts")];
	const violations = files.map(path => ({ path, lines: physicalLines(readFileSync(path, "utf8")) })).filter(file => file.lines > 500);
	assert.deepEqual(
		violations.map(file => `${relative(root, file.path)}: ${file.lines} lines`),
		[]
	);
});

test("physical line counting includes comments, blank lines and trailing blank lines", () => {
	assert.equal(physicalLines(""), 0);
	assert.equal(physicalLines("// comment\n\n"), 2);
	assert.equal(physicalLines("a\r\nb\r\n"), 2);
	assert.equal(physicalLines("\n".repeat(501)), 501);
});

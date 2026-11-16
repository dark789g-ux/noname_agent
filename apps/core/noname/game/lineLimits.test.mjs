import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)));

export function physicalLines(source) {
	if (!source.length) return 0;
	return source.split(/\r\n|\n|\r/).length - (/\r\n$|[\n\r]$/.test(source) ? 1 : 0);
}

function collect(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) return collect(path);
		return /\.(?:[cm]?[jt]s)$/.test(entry.name) ? [path] : [];
	});
}

test("all game modules and tests contain at most 500 physical lines", () => {
	const files = collect(root);
	const violations = files.map(path => ({ path, lines: physicalLines(readFileSync(path, "utf8")) })).filter(file => file.lines > 500);
	assert.deepEqual(
		violations.map(file => `${relative(root, file.path)}: ${file.lines} lines`),
		[]
	);
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packs = ["sixiang", "clan", "shenhua", "shiji", "yijiang", "huicui", "tw", "sp", "xianding"];

function physicalLines(source) {
	if (!source.length) return 0;
	return source.split(/\r\n|\n|\r/).length - (/\r\n$|[\n\r]$/.test(source) ? 1 : 0);
}

function collectJsFiles(directory) {
	if (!existsSync(directory)) return [];
	return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) return collectJsFiles(path);
		return entry.name.endsWith(".js") ? [path] : [];
	});
}

test("split character skill modules stay within 500 physical lines", () => {
	const files = [
		fileURLToPath(import.meta.url),
		resolve(coreRoot, "test/characterSkillSplitFixture.mjs"),
		resolve(coreRoot, "noname/library/element/GameEvent/animationProtocol.test.js"),
		...packs.flatMap(pack => [resolve(coreRoot, `character/${pack}/skill.js`), ...collectJsFiles(resolve(coreRoot, `character/${pack}/skills`))]),
	];
	const violations = files.map(path => ({ path, lines: physicalLines(readFileSync(path, "utf8")) })).filter(file => file.lines > 500);
	assert.deepEqual(
		violations.map(file => `${relative(coreRoot, file.path)}: ${file.lines} lines`),
		[]
	);
});

for (const pack of packs) {
	test(`the split ${pack} character entry preserves key count, order and references`, () => {
		const result = spawnSync(process.execPath, ["--experimental-vm-modules", fileURLToPath(new URL("./characterSkillSplitFixture.mjs", import.meta.url)), pack], { encoding: "utf8" });
		assert.equal(result.status, 0, result.stdout + result.stderr);
		assert.match(result.stdout, new RegExp(`real ${pack} split pack verified`));
	});
}

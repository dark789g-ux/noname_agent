import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL } from "node:url";
import process from "node:process";
import { createModuleRuntime } from "./module-runtime.mjs";

const baseline = Object.fromEntries(["content", "refresh", "extra"].map(name => [name, JSON.parse(readFileSync(new URL(`./${name}-registration.json`, import.meta.url), "utf8"))]));

test("event registry preserves all entries, step arrays and shared function identities", async () => {
	const runtime = await createModuleRuntime();
	const { Content } = await runtime.import("noname/library/element/content.ts");
	assert.deepEqual(Object.keys(Content), baseline.content);
	assert.equal(Content.useCard.length, 18);
	for (const module of runtime.modules.values()) {
		if (!module.identifier.includes("element/content/") || module.status !== "evaluated") continue;
		for (const [name, group] of Object.entries(module.namespace)) {
			if (!name.endsWith("Content")) continue;
			for (const [key, value] of Object.entries(group)) assert.equal(Content[key], value);
		}
	}
	const seen = [];
	await Content.emptyEvent({
		name: "contract",
		async trigger(name) {
			seen.push([this, name]);
		},
	});
	assert.equal(seen[0][1], "contract");
	const original = Content.emptyEvent;
	Content.emptyEvent = () => seen.push("replacement");
	Content.emptyEvent();
	assert.equal(seen.at(-1), "replacement");
	Content.emptyEvent = original;
});

for (const pack of ["refresh", "extra"]) {
	test(`${pack} preserves skill order, module identity and runtime replacement`, async () => {
		const runtime = await createModuleRuntime({ lib: { filter: { notMe: () => true } } });
		const { default: skills } = await runtime.import(`character/${pack}/skill.js`);
		assert.deepEqual(Object.keys(skills), baseline[pack]);
		const keys = [];
		for (const module of runtime.modules.values()) {
			if (!module.identifier.includes(`/character/${pack}/skills/`.replaceAll("/", process.platform === "win32" ? "\\" : "/"))) continue;
			for (const group of Object.values(module.namespace)) {
				for (const [key, skill] of Object.entries(group)) {
					keys.push(key);
					assert.equal(skills[key], skill);
				}
			}
		}
		assert.deepEqual(keys, Object.keys(skills));
		const first = skills[Object.keys(skills)[0]];
		const original = first.filter;
		first.filter = function () {
			return this;
		};
		assert.equal(first.filter(), first);
		first.filter = original;
	});
}

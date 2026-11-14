import { URL } from "node:url";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadLibraryModules } from "./moduleLoader.mjs";
import { libraryShape } from "./shape.mjs";

const runtime = await loadLibraryModules({}, { liveLibrary: true });
const { Library } = runtime;
const snapshot = JSON.parse(readFileSync(new URL("./shapeSnapshot.json", import.meta.url), "utf8"));

test("entry preserves pre-split data, key order, callback arity and descriptors", () => {
	assert.deepEqual(libraryShape(runtime.lib), snapshot);
	assert.equal(Object.getPrototypeOf(runtime.lib), Library.prototype);
	assert.equal(Object.hasOwn(runtime.lib, "getSkill"), false);
	assert.equal(Object.hasOwn(runtime.lib, "relatedTrigger"), false);
});

test("factories isolate instance state and preserve shared builtin skill definitions", async () => {
	const first = new Library();
	const second = new Library();
	for (const field of ["configMenu", "extensionMenu", "mode", "cheat", "filter", "sort", "message", "card", "cardPack", "characterPack", "characterSort", "namePrefix", "commonArea", "translate", "poptip"]) assert.notEqual(first[field], second[field], field);
	assert.notEqual(first.configMenu.general.config, second.configMenu.general.config);
	assert.equal(first.skill.global, second.skill.global);
	assert.equal(first.skill.aozhan, second.skill.aozhan);
	const skill = {};
	try {
		first.skill.test_library_registration = skill;
		assert.equal(skill.skill_id, "test_library_registration");
		assert.equal(second.skill.test_library_registration, skill);
	} finally {
		delete first.skill.test_library_registration;
	}
	assert.equal(first.zhanfa.lib, first);
	assert.equal(second.zhanfa.lib, second);
	assert.deepEqual(first.cardPack.zhanfa, second.cardPack.zhanfa);
	assert.equal(first.translate.zhanfa_card_config, "战法");
	await Promise.resolve();
});

test("setLibrary stays live inside deferred rules and registry callbacks", () => {
	const original = runtime.lib;
	const replacement = new Library();
	replacement.config = {};
	replacement.phaseName = ["replacementPhase"];
	try {
		runtime.setLibrary(replacement);
		assert.equal(runtime.lib, replacement);
		assert.equal(original.relatedTrigger.phaseAny, replacement.phaseName);
		const sorts = { group: ["test"] };
		replacement.characterSort.mode_extension_dynamic = sorts;
		assert.equal(replacement.characterSort.dynamic, sorts);
		const custom = () => "patched";
		replacement.filter.all = custom;
		assert.equal(replacement.filter.all(), "patched");
	} finally {
		original.config = {};
		runtime.setLibrary(original);
	}
});

test("prototype initialization retains enumerability and copied virtual-card descriptors", () => {
	const { Card, VCard } = runtime.lib.element;
	const descriptor = Object.getOwnPropertyDescriptor(VCard.prototype, "virtualCardMarker");
	assert.ok(descriptor);
	assert.equal(descriptor.enumerable, true);
	assert.deepEqual(Object.getOwnPropertyDescriptor(Card.prototype, "virtualCardMarker"), descriptor);
	const method = Object.getOwnPropertyDescriptor(Library.prototype, "getSkill");
	assert.ok(method);
	assert.equal(method.enumerable, false);
});

test("loader rejects synchronous singleton reads before initialization", async () => {
	await assert.rejects(loadLibraryModules({}, { source: 'import { get } from "noname"; get.value;' }), /Singleton read before initialization: value/);
});

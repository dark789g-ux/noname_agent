import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { loadGet } from "./testing/runtimeFixture.ts";

test("Get retains its public prototype descriptors and instance fields", async () => {
	const { module, dictionary, registrations, Is, Promises, Audio } = await loadGet();
	const { Get } = module;
	assert.equal(registrations.length, 1);
	assert.equal(registrations[0], dictionary);
	assert.equal(Object.getPrototypeOf(module.get), Get.prototype);
	assert.ok(module.get instanceof Get);
	assert.ok(module.get.is instanceof Is);
	assert.ok(module.get.promises instanceof Promises);
	assert.equal(module.get.Audio, Audio);
	assert.equal(module.Is, Is);
	assert.equal(module.Promises, Promises);
	const names = Object.getOwnPropertyNames(Get.prototype)
		.filter(name => name !== "constructor")
		.sort();
	assert.equal(names.length, 233);
	// Baseline of the complete public method-name set before modularization.
	assert.equal(createHash("sha256").update(names.join("\n")).digest("hex"), "09cf7bf872aae7fa850b148bd80aa15aa8ecb90ffd7fd9efcafeae401875d5ae");
	const ordered = Object.getOwnPropertyNames(Get.prototype)
		.filter(name => name !== "constructor")
		.map(name => [name, Get.prototype[name].name, Get.prototype[name].length]);
	assert.equal(createHash("sha256").update(JSON.stringify(ordered)).digest("hex"), "4f29f4ade87f8c24e4d6d3ccb68ba542d1cbd053fe7d2dfa9a394d154e4457a2");
	const locked = new Set(["isFunctionBody", "pureFunctionStr", "funcInfoOL", "infoFuncOL"]);
	for (const name of names) {
		const descriptor = Object.getOwnPropertyDescriptor(Get.prototype, name);
		assert.equal(typeof descriptor.value, "function", name);
		assert.equal(descriptor.enumerable, false, name);
		assert.equal(descriptor.writable, !locked.has(name), name);
		assert.equal(descriptor.configurable, !locked.has(name), name);
	}
	for (const name of locked) assert.ok(Object.hasOwn(Get.prototype, name), name);
	for (const name of ["nodeintro", "info", "autoViewAs", "value", "effect", "translation"]) {
		assert.ok(Object.hasOwn(Get.prototype, name), name);
	}
});

test("setGet updates the live singleton and only publishes it in dev mode", async () => {
	const { module, lib, window } = await loadGet();
	const original = module.get;
	const replacement = new module.Get();
	assert.equal(module.setGet(replacement), undefined);
	assert.equal(module.get, replacement);
	assert.notEqual(module.get, original);
	assert.equal(window.get, undefined);
	lib.config.dev = true;
	module.setGet(original);
	assert.equal(module.get, original);
	assert.equal(window.get, original);
	module.setGet();
	assert.ok(module.get instanceof module.Get);
	assert.notEqual(module.get, original);
	assert.equal(window.get, module.get);
});

test("private function sanitizing and wire methods still share the live Get brand", async () => {
	const { module } = await loadGet();
	for (const get of [module.get, new module.Get()]) {
		module.setGet(get);
		const encoded = get.funcInfoOL((value = 3) => value + 1);
		assert.equal(get.infoFuncOL(encoded)(8), 9);
		assert.equal(get.isFunctionBody("return 1"), true);
		assert.equal(get.isFunctionBody("return }"), false);
		assert.equal(get.pureFunctionStr("not valid remote code"), "function () {}");
	}
});

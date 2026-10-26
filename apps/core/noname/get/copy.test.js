import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { copyValue } from "./copy.js";

const getText = readFileSync(new URL("./index.js", import.meta.url), "utf8");
const getFile = ts.createSourceFile("index.js", getText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);

function getPublicCopy() {
	for (const statement of getFile.statements) {
		if (!ts.isClassDeclaration(statement) || statement.name?.text !== "Get") continue;
		const method = statement.members.find(member => ts.isMethodDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === "copy");
		assert.ok(method?.body, "Get.copy should have a body");
		assert.match(method.getFullText(getFile), /@overload/);
		const source = ts.transpileModule(`function ${method.getText(getFile)}`, {
			compilerOptions: { target: ts.ScriptTarget.ESNext },
		}).outputText;
		return Function("copyValue", `${source}; return copy;`)(copyValue);
	}
	assert.fail("Get should exist");
}

function withWindow(callback) {
	const previous = globalThis.window;
	globalThis.window = { Date };
	try {
		return callback();
	} finally {
		globalThis.window = previous;
	}
}

function getArguments() {
	return arguments;
}

test("Get.copy 保留循环、共享引用、描述符和 symbol getter", () => {
	const copy = getPublicCopy();
	const symbol = Symbol("data");
	let getterCalls = 0;
	const shared = { nested: true };
	const source = { first: shared, second: shared };
	source.self = source;
	Object.defineProperty(source, "readonly", { value: { deep: true }, enumerable: false, configurable: false, writable: false });
	Object.defineProperty(source, symbol, {
		enumerable: true,
		get() {
			getterCalls++;
			return { copied: true };
		},
	});
	const result = copy(source);
	assert.notEqual(result, source);
	assert.equal(result.self, result);
	assert.equal(result.first, result.second);
	assert.notEqual(result.first, shared);
	const descriptor = Object.getOwnPropertyDescriptor(result, "readonly");
	assert.equal(descriptor.enumerable, false);
	assert.equal(descriptor.configurable, false);
	assert.equal(descriptor.writable, false);
	assert.notEqual(descriptor.value, source.readonly);
	assert.equal(getterCalls, 1);
	assert.deepEqual(result[symbol], { copied: true });
});

test("Get.copy 保留 Map/Set 子类、键深拷贝、Date、Arguments 和 NullObject", () => {
	withWindow(() => {
		const copy = getPublicCopy();
		class CustomMap extends Map {}
		class CustomSet extends Set {}
		const key = { id: 1 };
		const map = new CustomMap([[key, { value: 1 }]]);
		const set = new CustomSet([{ value: 2 }]);
		const shallowMap = copy(map);
		const deepMap = copy(map, true);
		const copiedSet = copy(set);
		assert.equal(shallowMap instanceof CustomMap, true);
		assert.equal(deepMap instanceof CustomMap, true);
		assert.equal(copiedSet instanceof CustomSet, true);
		assert.equal([...shallowMap.keys()][0], key);
		assert.notEqual([...deepMap.keys()][0], key);
		assert.notEqual(shallowMap.get(key), map.get(key));
		assert.notEqual([...copiedSet][0], [...set][0]);

		const date = new Date(1234);
		const copiedDate = copy(date);
		assert.equal(copiedDate instanceof Date, true);
		assert.equal(copiedDate.getTime(), date.getTime());

		const copiedArguments = copy(getArguments("a", "b"));
		assert.equal(Object.getPrototypeOf(copiedArguments), Object.prototype);
		assert.deepEqual(Array.from(copiedArguments), ["a", "b"]);

		const nullObject = Object.create(null);
		nullObject.value = { deep: true };
		const copiedNullObject = copy(nullObject);
		assert.equal(Object.getPrototypeOf(copiedNullObject), null);
		assert.notEqual(copiedNullObject.value, nullObject.value);
	});
});

test("Get.copy 延后读取 Map/Set 写入方法，并保留鸭子构造结果", () => {
	const copy = getPublicCopy();
	const mapWrites = [];
	let mapGetterCalls = 0;
	function set(key, value) {
		mapWrites.push([key, value, this]);
	}
	set.call = () => assert.fail("copy should not use an overridable method.call");
	const mapTarget = {
		get set() {
			mapGetterCalls++;
			return set;
		},
	};
	function DuckMap() {
		return mapTarget;
	}
	const map = new Map([["key", { deep: true }]]);
	map.constructor = DuckMap;
	const copiedMap = copy(map);
	assert.equal(copiedMap, mapTarget);
	assert.equal(mapGetterCalls, 1);
	assert.equal(mapWrites[0][0], "key");
	assert.notEqual(mapWrites[0][1], map.get("key"));
	assert.equal(mapWrites[0][2], mapTarget);

	const setWrites = [];
	let setGetterCalls = 0;
	function add(value) {
		setWrites.push([value, this]);
	}
	add.call = () => assert.fail("copy should not use an overridable method.call");
	const setTarget = {
		get add() {
			setGetterCalls++;
			return add;
		},
	};
	function DuckSet() {
		return setTarget;
	}
	const setSource = new Set([{ deep: true }]);
	setSource.constructor = DuckSet;
	const copiedSet = copy(setSource);
	assert.equal(copiedSet, setTarget);
	assert.equal(setGetterCalls, 1);
	assert.notEqual(setWrites[0][0], [...setSource][0]);
	assert.equal(setWrites[0][1], setTarget);

	const emptyTarget = {
		get set() {
			assert.fail("empty Map should not read target.set");
			return undefined;
		},
	};
	function EmptyDuckMap() {
		return emptyTarget;
	}
	const emptyMap = new Map();
	emptyMap.constructor = EmptyDuckMap;
	assert.equal(copy(emptyMap), emptyTarget);
});

test("Get.copy 在 Map 写入失败前仍完成原有参数深拷贝", () => {
	const copy = getPublicCopy();
	const order = [];
	const target = {
		get set() {
			order.push("get set");
			return undefined;
		},
	};
	function MissingSetMap() {
		return target;
	}
	const value = {};
	Object.defineProperty(value, "constructor", {
		get() {
			order.push("copy value");
			return Object;
		},
	});
	const map = new Map([["key", value]]);
	map.constructor = MissingSetMap;
	assert.throws(() => copy(map), /Map copy target must provide set/);
	assert.deepEqual(order, ["get set", "copy value"]);
});

test("Get.copy 保留 symbol 严格赋值失败和非遍历值原样返回", () => {
	const copy = getPublicCopy();
	const symbol = Symbol("locked");
	function LockedArray() {
		Object.defineProperty(this, symbol, { value: "locked", writable: false });
	}
	const array = ["source"];
	array.constructor = LockedArray;
	array[symbol] = "source";
	assert.throws(() => copy(array), /Cannot assign copied symbol property/);

	const callback = () => "same";
	const pattern = /copy/;
	assert.equal(copy(callback), callback);
	assert.equal(copy(pattern), pattern);
});

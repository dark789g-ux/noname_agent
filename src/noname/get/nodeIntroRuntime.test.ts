import assert from "node:assert/strict";
import test from "node:test";
import { loadGet } from "./testing/runtimeFixture.js";

function node(classes: string[] = []) {
	return {
		classList: { contains: (name: string) => classes.includes(name) },
		parentNode: { classList: { contains: () => false } },
	};
}

function dialog() {
	const output: unknown[] = [];
	const attributes: [string, string][] = [];
	return {
		output,
		attributes,
		content: { firstChild: { style: {} } },
		contentContainer: {},
		setAttribute(name: string, value: string) {
			attributes.push([name, value]);
		},
		add(value: unknown) {
			output.push(value);
			return { style: {} };
		},
		addText(value: unknown) {
			output.push(value);
		},
		addSmall(value: unknown) {
			output.push(value);
		},
		hide() {
			output.push("hide");
		},
		show() {
			output.push("show");
		},
	};
}

async function fixture() {
	let scrolls = 0;
	const lib = {
		config: { touchscreen: true, show_sex: false, show_group: false, show_sortPack: false },
		characterTitle: {},
		characterAppend: {},
		characterPack: {},
		character: { hero: [] },
		translate: { sample_info: "card description" },
		card: { sample: { type: "basic" } },
		setScroll() {
			scrolls++;
		},
		placePoppedDialog() {},
	};
	const game = { filterSkills: (skills: string[]) => skills };
	const ui = { arena: node(), create: { dialog, div: () => "placeholder" } };
	const loaded = await loadGet({ lib, game, ui });
	const get = loaded.module.get;
	get.translation = value => String(value);
	get.character = () => ["male", "wei", 4, []];
	get.characterInitFilter = () => undefined;
	get.mode = () => "identity";
	get.position = () => "h";
	get.owner = () => undefined;
	get.is.phoneLayout = () => false;
	get.is.yingbianConditional = () => false;
	return { ...loaded, get, lib, game, ui, scrolls: () => scrolls };
}

test("nodeintro preserves early-return precedence, including an unnamed player's dialog", async () => {
	const f = await fixture();
	const d = dialog();
	assert.equal(f.get.nodeintro({ ...node(["player"]), _nointro: true }, false, undefined, d), d);
	assert.equal(f.get.nodeintro({ ...node(), _nointro: true }, false, undefined, d), undefined);
	assert.equal(f.get.nodeintro({ ...node(), _customintro: () => false }, false, undefined, d), undefined);
	assert.equal(f.scrolls(), 0);
	assert.deepEqual(d.attributes, [
		["id", "nodeintro"],
		["id", "nodeintro"],
		["id", "nodeintro"],
	]);
});

test("custom and character branches preserve caption order, dialog identity and scrolling", async () => {
	const f = await fixture();
	const custom = dialog();
	assert.equal(f.get.nodeintro({ ...node(), _customintro: [() => "caption", () => "body"] }, true, undefined, custom), custom);
	assert.deepEqual(custom.output, ["caption", '<div class="text center" style="padding-bottom:5px">body</div>']);
	const character = dialog();
	assert.equal(f.get.nodeintro({ ...node(["character"]), link: "hero" }, true, undefined, character), character);
	assert.deepEqual(character.output, ["hero", "placeholder"]);
	assert.equal(f.scrolls(), 2);
});

test("card rendering retains owner/prompt inputs and cardMod's no-scroll early return", async () => {
	const f = await fixture();
	const d = Object.assign(dialog(), { nosub: true });
	const card = { ...node(["card"]), name: "sample" };
	assert.equal(f.get.nodeintro(card, false, undefined, d), d);
	assert.deepEqual(d.output, ["[object Object]", '<div class="text" style="display:inline">card description</div>', "placeholder"]);
	assert.equal(f.scrolls(), 1);
	const modified = dialog();
	const modded = {
		...card,
		parentNode: {
			cardMod: {
				test: original => {
					assert.equal(original, modded);
					return ["mod caption", "mod body"];
				},
			},
		},
	};
	assert.equal(f.get.nodeintro(modded, false, undefined, modified), modified);
	assert.deepEqual(modified.output, ["mod caption", '<div class="text" style="display:inline">mod body</div>']);
	assert.equal(f.scrolls(), 1);
});

test("async mark content retains its dialog and deferred placement callback", async () => {
	const f = await fixture();
	const d = dialog();
	const promise = f.runtime.run("Promise.resolve()");
	const mark = {
		...node(["mark"]),
		skill: "sample",
		info: { name: "mark caption", mark: () => promise },
		parentNode: { parentNode: { ...node(["player"]), storage: {} } },
	};
	assert.equal(f.get.nodeintro(mark, false, {}, d), d);
	assert.deepEqual(d.output, ["mark caption", "hide", "placeholder"]);
	await promise;
	await Promise.resolve();
	assert.deepEqual(d.output, ["mark caption", "hide", "placeholder", "show"]);
});

test("linked players retain per-call introduction state", async () => {
	const f = await fixture();
	const d = dialog();
	const player = {
		...node(["player"]),
		name: "hero",
		group: "wei",
		getSkills: () => [],
		hiddenSkills: [],
		disabledSkills: {},
	};
	assert.equal(f.get.nodeintro({ ...node(), linkplayer: true, link: player }, true, undefined, d), d);
	assert.deepEqual(d.output, ["hero", "placeholder"]);
	assert.equal(f.scrolls(), 1);
});

test("deferred skin callbacks share a heading only within their own introduction", async () => {
	const callbacks: ((folders: string[], files: string[]) => void)[] = [];
	const game = {
		getFileList(path: string, callback: (folders: string[], files: string[]) => void) {
			assert.equal(this, game);
			assert.ok(path.startsWith("skins/"));
			callbacks.push(callback);
		},
	};
	const button = () => ({ style: {}, setBackground() {}, setBackgroundImage() {} });
	const ui = { create: { div: button, caption: button } };
	const lib = { config: { skin: {} }, characterSubstitute: {}, setMousewheel() {} };
	const { module, runtime } = await loadGet({ game, ui, lib });
	module.get.skinPath = name => `skins/${name}/`;
	module.get.translation = name => name;
	const { skinButtons } = await runtime.import("noname/get/intro/skin.ts");
	const first = dialog(),
		second = dialog();
	const addFirst = skinButtons(first);
	const addSecond = skinButtons(second);
	addFirst("hero", () => {});
	addSecond("hero", () => {});
	addFirst("deputy", () => {});
	callbacks[1]([], ["one.jpg"]);
	callbacks[0]([], ["one.jpg"]);
	callbacks[2]([], ["two.jpg"]);
	const headings = d => d.output.filter(value => value === '<div class="text center">更改皮肤</div>').length;
	assert.equal(headings(first), 1);
	assert.equal(headings(second), 1);
});

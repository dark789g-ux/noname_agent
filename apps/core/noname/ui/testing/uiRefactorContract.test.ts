import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";

const uiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const coreRoot = resolve(uiRoot, "../..");

const EXPECTED_UI_METHODS = [
	"getSpreadOffset", "refresh", "clear", "updatec", "updatex", "updatexr", "updatejm", "updatem",
	"updatej", "updatehl", "updateh", "updatehx", "updated", "updatez", "update", "recycle",
	"updateConnectPlayerPositions", "updatePlayerPositions", "updateRoundNumber", "updateAIModeIndicator",
	"updateLLMLogButtons", "updateLLMLogButton",
];

const EXPECTED_CREATE_METHODS = [
	"identityCard", "cardSpinning", "spinningIdentityCard", "editor", "toast", "showNextToast",
	"cardTempName", "connectRooms", "rarity", "div", "filediv", "node", "iframe", "identitycircle",
	"chat", "exit", "connecting", "roomInfo", "templayer", "selectlist", "statictable", "giveup",
	"groupControl", "cardDialog", "characterDialog2", "characterDialog", "dialog", "line2", "line",
	"switcher", "caption", "control", "confirm", "skills", "skills2", "skills3", "cardChooseAll",
	"buttonChooseAll", "arena", "system", "pause", "prebutton", "button", "buttons", "textbuttons",
	"player", "connectPlayers", "players", "me", "card", "cardsAsync", "cards", "pagination",
	"handcardsContainer",
];

const EXPECTED_CLICK_METHODS = [
	"identitycircle", "connectEvents", "connectClients", "autoskin", "skin", "touchpop", "exit",
	"shortcut", "favouriteCharacter", "buttonnameenter", "buttonnameleave", "dragtouchdialog",
	"identity", "identity2", "roundmenu", "pausehistory", "pauseconfig", "cardPileButton",
	"commonCardPileButton", "chat", "volumn", "volumn_background", "volumn_audio", "hoverpopped",
	"hoverpopped_leave", "leavehoverpopped", "dierevive", "dieswap", "dieswap2", "touchconfirm",
	"windowtouchstart", "windowtouchmove", "windowtouchend", "checkroundtranslate", "checkdialogtranslate",
	"windowmousewheel", "windowmousemove", "windowmousedown", "cardtouchstart", "cardtouchmove",
	"cardmouseenter", "cardmouseleave", "playertouchstart", "playertouchmove", "windowmouseup",
	"mousemove", "mouseenter", "mouseleave", "mousedown", "mouseentercancel", "hoverplayer",
	"longpressdown", "longpresscallback", "longpresscancel", "window", "toggle", "editor",
	"switcher", "choice", "button", "touchintro", "card", "avatar", "avatar2", "connectroom",
	"player", "target", "control2", "control", "dialogcontrol", "skill", "ok", "cancel",
	"logv", "logvleave", "charactercard", "intro", "intro2", "auto", "wuxie", "tempnowuxie",
	"pause", "resume", "config", "swap", "mousewheel", "touchStart", "dialogtouchStart",
	"touchScroll", "autoskill", "skillbutton", "autoskill2", "hiddenskill", "rightplayer",
	"right", "count",
];

function physicalLines(source: string): number {
	if (!source.length) return 0;
	return source.split(/\r\n|\n|\r/).length - (/\r\n$|[\n\r]$/.test(source) ? 1 : 0);
}

function collectFiles(dir: string, exts: RegExp, skipDir?: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
		const fullPath = resolve(dir, entry.name);
		if (entry.isDirectory()) {
			if (skipDir && fullPath === skipDir) return [];
			return collectFiles(fullPath, exts, skipDir);
		}
		return exts.test(entry.name) ? [fullPath] : [];
	});
}

async function loadRealUIModuleGraph() {
	const context = createContext({ WeakMap, Map, Set, Object, Reflect, Error, Array, console });
	const modules = new Map<string, SourceTextModule | SyntheticModule>();
	const synthetic = (id: string, exports: Record<string, any>) => {
		const mod = new SyntheticModule(
			Object.keys(exports),
			function () {
				for (const [k, v] of Object.entries(exports)) this.setExport(k, v);
			},
			{ context, identifier: id }
		);
		modules.set(id, mod);
		return mod;
	};
	synthetic("noname", { lib: { config: {} }, game: {}, get: {}, _status: {}, ui: {}, ai: {} });
	synthetic(resolve(uiRoot, "create/menu/vue/index.js"), { menu: () => {} });
	synthetic("@/ui/create/menu/vue/utils/menuBridge", { menuBridge: {} });
	synthetic("@/util/pagination.js", { Pagination: class {} });
	synthetic(resolve(coreRoot, "noname/library/init/onfree.js"), { requireOnFree: () => [] });
	synthetic(resolve(coreRoot, "noname/library/skillRegistry.js"), { getRegisteredSkill: () => undefined, requireRegisteredSkill: () => ({}) });
	synthetic("@/llm/player-button-state.js", { resolvePlayerButtonState: () => ({ visible: false, highlighted: false, active: false, label: "AI" }) });

	const load = (filePath: string): SourceTextModule | SyntheticModule => {
		let resolved = filePath;
		if (!existsSync(resolved) && resolved.endsWith(".js")) {
			resolved = resolved.slice(0, -3) + ".ts";
		}
		const cached = modules.get(resolved) ?? modules.get(filePath);
		if (cached) return cached;
		const code = ts.transpileModule(readFileSync(resolved, "utf8"), {
			compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
		}).outputText;
		const mod = new SourceTextModule(code, { context, identifier: resolved });
		modules.set(resolved, mod);
		return mod;
	};

	const entry = load(resolve(uiRoot, "index.ts"));
	await entry.link((specifier, parent) => {
		if (modules.has(specifier)) return modules.get(specifier)!;
		const target = specifier.startsWith("@/") ? resolve(coreRoot, "noname", specifier.slice(2)) : resolve(dirname(parent.identifier), specifier);
		return load(target);
	});
	await entry.evaluate();
	return {
		UI: (entry as SourceTextModule).namespace.UI as any,
		Create: (load(resolve(uiRoot, "create/index.ts")) as SourceTextModule).namespace.Create as any,
		Click: (load(resolve(uiRoot, "click/index.ts")) as SourceTextModule).namespace.Click as any,
		installPrototypeMethods: (load(resolve(uiRoot, "installPrototypeMethods.ts")) as SourceTextModule).namespace.installPrototypeMethods as any,
	};
}

test("all split UI TS files, updated tests, and split CSS files stay at most 500 physical lines", () => {
	const menuDir = resolve(uiRoot, "create/menu");
	const files = [
		...collectFiles(uiRoot, /\.(?:[cm]?[jt]s)$/, menuDir),
		resolve(coreRoot, "noname/library/commonArea.test.js"),
		resolve(coreRoot, "layout/default/layout.css"),
		...collectFiles(resolve(coreRoot, "layout/default/layout"), /\.css$/),
		resolve(coreRoot, "layout/newlayout/global.css"),
		...collectFiles(resolve(coreRoot, "layout/newlayout/global"), /\.css$/),
		resolve(coreRoot, "layout/long2/layout.css"),
		...collectFiles(resolve(coreRoot, "layout/long2/layout"), /\.css$/),
	];
	const violations = files
		.map(p => ({ path: relative(coreRoot, p), lines: physicalLines(readFileSync(p, "utf8")) }))
		.filter(item => item.lines > 500);
	assert.deepEqual(
		violations.map(item => `${item.path}: ${item.lines} lines`),
		[]
	);
});

test("UI, Create, and Click prototypes preserve exact method sets, non-enumerable descriptors, and buttonPresets", async () => {
	const { UI, Create, Click, installPrototypeMethods } = await loadRealUIModuleGraph();
	for (const [label, Ctor, expectedMethods] of [
		["UI", UI, EXPECTED_UI_METHODS],
		["Create", Create, EXPECTED_CREATE_METHODS],
		["Click", Click, EXPECTED_CLICK_METHODS],
	] as const) {
		assert.deepEqual(Object.keys(Ctor.prototype), [], `${label}.prototype must have no enumerable methods`);
		for (const name of expectedMethods) {
			const descriptor = Object.getOwnPropertyDescriptor(Ctor.prototype, name);
			assert.ok(descriptor, `${label}.prototype.${name} should exist`);
			assert.equal(descriptor.enumerable, false, `${label}.prototype.${name} must be non-enumerable`);
			assert.equal(typeof descriptor.value, "function", `${label}.prototype.${name} must be a function`);
		}
		const actualMethods = Reflect.ownKeys(Ctor.prototype).filter(k => k !== "constructor");
		assert.deepEqual(new Set(actualMethods), new Set(expectedMethods), `${label} prototype method set drifted`);
	}

	const instance = new UI();
	assert.ok(instance.create instanceof Create);
	assert.ok(instance.click instanceof Click);
	assert.deepEqual(Object.keys(instance.create.buttonPresets), ["tdnodes", "blank", "card", "vcard", "character", "characterx", "player", "skill"]);
	assert.throws(() => installPrototypeMethods("Test", { dup() {} }, [{ dup() {} }]), /Duplicate Test prototype member/);
});

test("split CSS entry points resolve every @import target and every sub-file url() asset on disk", () => {
	const entries = ["layout/default/layout.css", "layout/newlayout/global.css", "layout/long2/layout.css"].map(p => resolve(coreRoot, p));
	for (const entry of entries) {
		const source = readFileSync(entry, "utf8");
		const dir = dirname(entry);
		const imports = Array.from(source.matchAll(/@import\s+["']([^"']+)["'];/g)).map(m => m[1]);
		assert.ok(imports.length > 0, `${relative(coreRoot, entry)} should have @import entries`);
		for (const rel of imports) {
			const target = resolve(dir, rel);
			assert.equal(existsSync(target), true, `Missing @import target: ${rel} in ${relative(coreRoot, entry)}`);
			const subSource = readFileSync(target, "utf8");
			for (const match of subSource.matchAll(/url\((["']?)([^"')]+)\1\)/g)) {
				const urlValue = match[2];
				if (urlValue.startsWith("data:")) continue;
				const asset = resolve(dirname(target), urlValue);
				assert.equal(existsSync(asset), true, `Missing asset ${urlValue} referenced from ${relative(coreRoot, target)}`);
			}
		}
	}
});

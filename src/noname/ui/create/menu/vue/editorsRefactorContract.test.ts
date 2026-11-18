import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse, compileScript, compileTemplate } from "vue/compiler-sfc";
import ts from "typescript";
import { loadLogDetailEntry } from "../../llmLog/vue/llmLogStatus.js";

const vueMenuRoot = dirname(fileURLToPath(import.meta.url));
const editorsRoot = resolve(vueMenuRoot, "components/editors");
const llmLogVueRoot = resolve(vueMenuRoot, "../../llmLog/vue");

function physicalLines(source: string): number {
	if (!source.length) return 0;
	return source.split(/\r\n|\n|\r/).length - (/\r\n$|[\n\r]$/.test(source) ? 1 : 0);
}

function collectFiles(dir: string, exts: RegExp): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
		const fullPath = resolve(dir, entry.name);
		if (entry.isDirectory()) return collectFiles(fullPath, exts);
		return exts.test(entry.name) ? [fullPath] : [];
	});
}

function transpileNamedFunctions<T extends Record<string, any>>(
	filePath: string,
	deps: Record<string, any>,
	exportNames: string[]
): T {
	const srcText = readFileSync(filePath, "utf8");
	const sf = ts.createSourceFile(filePath, srcText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const body = sf.statements
		.filter(st => !ts.isImportDeclaration(st))
		.map(st => st.getText(sf))
		.join("\n");
	const compiled = ts.transpileModule(body, {
		compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
	}).outputText.replace(/export\s+(?=(?:async\s+)?function|const|class|type|interface)/g, "");
	const depNames = Object.keys(deps);
	const depValues = Object.values(deps);
	return new Function(...depNames, `${compiled}\nreturn { ${exportNames.join(", ")} };`)(...depValues) as T;
}

test("editors/ 直接子项总数 <= 10（精确为 9 个预期条目），且已清理旧目录", () => {
	const directChildren = readdirSync(editorsRoot).sort();
	assert.ok(directChildren.length <= 10, `Expected <= 10 items, got ${directChildren.length}: ${directChildren.join(", ")}`);
	assert.deepEqual(directChildren, [
		"BanSkillEditor.vue",
		"InfoPages.vue",
		"VideoManager.vue",
		"card-pile",
		"debug",
		"extension",
		"file-manager",
		"llm",
		"shared",
	]);
	assert.equal(existsSync(resolve(editorsRoot, "extensionMaker")), false);
	assert.equal(existsSync(resolve(editorsRoot, "llm-timeline")), false);
});

test("editors/ 与 ui/create/llmLog/vue/ 下全部源码文件不超过 500 物理行且无禁用 ts 注释", () => {
	const files = [
		...collectFiles(editorsRoot, /\.(?:vue|ts|css)$/),
		...collectFiles(llmLogVueRoot, /\.(?:vue|ts|css)$/),
	];
	assert.ok(files.length >= 25);

	const lineViolations = files
		.map(p => ({ path: relative(vueMenuRoot, p), lines: physicalLines(readFileSync(p, "utf8")) }))
		.filter(item => item.lines > 500);
	assert.deepEqual(
		lineViolations.map(v => `${v.path}: ${v.lines} lines`),
		[]
	);

	const tsIgnoreViolations = files.filter(p => /@ts-(?:ignore|nocheck)\b/.test(readFileSync(p, "utf8")));
	assert.deepEqual(tsIgnoreViolations, []);
});

test("模块单向依赖边界：llmLog/vue 不回引 menu/，editors/shared 不引用业务子域", () => {
	for (const file of collectFiles(llmLogVueRoot, /\.(?:vue|ts)$/)) {
		const content = readFileSync(file, "utf8");
		assert.equal(
			/create\/menu\//.test(content),
			false,
			`${relative(llmLogVueRoot, file)} must not import from create/menu/`
		);
	}
	for (const file of collectFiles(resolve(editorsRoot, "shared"), /\.(?:vue|ts)$/)) {
		const content = readFileSync(file, "utf8");
		assert.equal(
			/(?:\.\.\/(?:card-pile|debug|extension|file-manager|llm)\b|menuBridge)/.test(content),
			false,
			`${relative(editorsRoot, file)} must not depend on editor feature domains`
		);
	}
});

test("全部重构后的 .vue 组件模板与脚本均可通过 vue/compiler-sfc 编译", () => {
	const vueFiles = [
		...collectFiles(editorsRoot, /\.vue$/),
		...collectFiles(llmLogVueRoot, /\.vue$/),
	];
	for (const filename of vueFiles) {
		const source = readFileSync(filename, "utf8");
		const { descriptor, errors } = parse(source, { filename });
		assert.deepEqual(errors, [], `SFC parse errors in ${filename}`);
		const id = relative(vueMenuRoot, filename).replace(/[^a-zA-Z0-9]/g, "-");
		const script = compileScript(descriptor, { id });
		const template = compileTemplate({
			filename,
			id,
			source: descriptor.template!.content,
			compilerOptions: { bindingMetadata: script.bindings },
		});
		assert.deepEqual(template.errors, [], `Template compile errors in ${filename}`);
	}
});

test("shared/entityOptions: sortPairsByIdSuffix 按末段后缀排序且同后缀按全 ID 排序", () => {
	const { sortPairsByIdSuffix } = transpileNamedFunctions<any>(
		resolve(editorsRoot, "shared/entityOptions.ts"),
		{ lib: {}, Character: class {} },
		["sortPairsByIdSuffix"]
	);
	const sorted = sortPairsByIdSuffix([
		["re_zhangliao", "界张辽"],
		["caocao", "曹操"],
		["sp_caocao", "SP曹操"],
		["an_liubei", "刘备"],
	]);
	assert.deepEqual(
		sorted.map((x: [string, string]) => x[0]),
		["caocao", "sp_caocao", "an_liubei", "re_zhangliao"]
	);
});

test("extension/characterModel: 新旧两种武将格式读写往返与标签清理正确", () => {
	const mockGet = {
		infoHp: (v: any) => (typeof v === "number" ? v : parseInt(String(v).split("/")[0], 10)),
		infoMaxHp: (v: any) => (typeof v === "number" ? v : parseInt(String(v).split("/")[1] || String(v), 10)),
		infoHujia: (v: any) => (typeof v === "string" && v.split("/")[2] ? parseInt(v.split("/")[2], 10) : 0),
	};
	const { extractCharacterSnapshot, writeCharacterRecord } = transpileNamedFunctions<any>(
		resolve(editorsRoot, "extension/characterModel.ts"),
		{ game: {}, get: mockGet },
		["extractCharacterSnapshot", "writeCharacterRecord"]
	);

	// 1. 旧数组格式：保留数组形态写回
	const legacyPack: Record<string, any> = {
		hero1: ["male", "wei", "3/4", ["jianxiong"], ["zhu", "des:旧描述"]],
	};
	const snap = extractCharacterSnapshot("hero1", legacyPack.hero1, "曹操");
	assert.equal(snap.charName, "hero1|曹操");
	assert.equal(snap.isZhu, true);
	assert.equal(snap.charDes, "旧描述");

	writeCharacterRecord(legacyPack, {
		id: "hero1",
		sex: "male",
		group: "wei",
		hp: "3/4",
		des: "新描述",
		isZhu: false,
		isBoss: true,
		isForbidAi: false,
		isHiddenSkill: false,
		skills: ["jianxiong", "hujia"],
	});
	assert.equal(Array.isArray(legacyPack.hero1), true);
	assert.deepEqual(legacyPack.hero1[4], ["boss", "bossallowed", "des:新描述"]);

	// 2. 新对象格式：取消勾选项时清理残留字段
	const objPack: Record<string, any> = {
		hero2: { sex: "female", group: "wu", hp: 3, maxHp: 3, hujia: 1, isZhugong: true, trashBin: ["des:初版"] },
	};
	writeCharacterRecord(objPack, {
		id: "hero2",
		sex: "female",
		group: "wu",
		hp: 3,
		des: "",
		isZhu: false,
		isBoss: false,
		isForbidAi: false,
		isHiddenSkill: false,
		skills: [],
	});
	assert.equal("isZhugong" in objPack.hero2, false);
	assert.equal("trashBin" in objPack.hero2, false);
});

test("card-pile/cardPileService: syncCurrentCustomPile 与 removeAddedCardAt 持久化一致性", () => {
	const saved: Array<[string, any]> = [];
	const mockLib = {
		config: {
			customcardpile: {} as Record<string, any>,
			bannedpile: { standard: [1] } as Record<string, number[]>,
			addedpile: { standard: [["heart", 7, "sha"], ["spade", 2, "shan"]] } as Record<string, any[]>,
			cards: [],
		},
		cardPile: {},
		translate: {},
	};
	const mockGame = {
		saveConfig(key: string, val: any) {
			saved.push([key, JSON.parse(JSON.stringify(val))]);
		},
	};
	const { removeAddedCardAt } = transpileNamedFunctions<any>(
		resolve(editorsRoot, "card-pile/cardPileService.ts"),
		{ lib: mockLib, game: mockGame, get: {} },
		["removeAddedCardAt"]
	);
	removeAddedCardAt("standard", 0);
	assert.equal(mockLib.config.addedpile.standard.length, 1);
	assert.equal(mockLib.config.addedpile.standard[0][2], "shan");
	assert.equal(mockLib.config.customcardpile["当前牌堆"][1].standard.length, 1);
	assert.equal(saved.some(([k, v]) => k === "cardpilename" && v === "当前牌堆"), true);
});

test("llmLogStatus: loadLogDetailEntry 在并发切换时通过 isCurrent 丢弃过期加载", async () => {
	let currentId = "log-1";
	const loaded: string[] = [];
	const loadingStates: boolean[] = [];

	let resolveFirst!: (val: any) => void;
	const firstPromise = new Promise<any>(r => {
		resolveFirst = r;
	});

	const p1 = loadLogDetailEntry(
		{ id: "log-1" } as any,
		() => firstPromise,
		v => loadingStates.push(v),
		() => currentId === "log-1",
		full => loaded.push(full.id)
	);
	// 切换选中条目至 log-2
	currentId = "log-2";
	resolveFirst({ id: "log-1", request: { messages: [] } });
	await p1;
	assert.deepEqual(loaded, []);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { compileScript, parse } from "vue/compiler-sfc";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	Node: dom.window.Node,
	Element: dom.window.Element,
	HTMLElement: dom.window.HTMLElement,
	HTMLDivElement: dom.window.HTMLDivElement,
	SVGElement: dom.window.SVGElement,
	Comment: dom.window.Comment,
	Text: dom.window.Text,
});

const vue = await import("vue");

function createNonameMock() {
	let isNewLayout = false;
	let isJun = false;
	return {
		_setNewLayout(v: boolean) {
			isNewLayout = v;
		},
		_setJun(v: boolean) {
			isJun = v;
		},
		_status: {},
		lib: { config: {} },
		game: { layout: "default" },
		ui: { click: { avatar() {}, avatar2() {} } },
		get: {
			is: {
				newLayout: () => isNewLayout,
				jun: () => isJun,
			},
			translation: (id: string) => ({ zhu: "主", zhong: "忠", fan: "反", nei: "内" }[id] ?? id),
			groupnature: (group: string) => group,
			slimName: (name: string) => name,
		},
	};
}

function loadStateModule(nonameMock: ReturnType<typeof createNonameMock>) {
	const raw = readFileSync(new URL("./playerCardState.ts", import.meta.url), "utf8");
	const { outputText } = ts.transpileModule(raw, {
		compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS },
	});
	const mod = { exports: {} as Record<string, any> };
	const customRequire = (id: string) => {
		if (id === "vue") return vue;
		if (id === "noname") return nonameMock;
		throw new Error(`Unexpected import: ${id}`);
	};
	new Function("exports", "require", "module", outputText)(mod.exports, customRequire, mod);
	return mod.exports;
}

function compileSfc(relPath: string, nonameMock: ReturnType<typeof createNonameMock>, deps: Record<string, any> = {}) {
	const source = readFileSync(new URL(relPath, import.meta.url), "utf8");
	const { descriptor } = parse(source, { filename: relPath });
	const id = relPath.replace(/[^a-zA-Z0-9]/g, "_");
	const script = compileScript(descriptor, { id, inlineTemplate: true });

	const scriptJs = ts.transpileModule(script.content, {
		compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
	}).outputText;

	const customRequire = (reqId: string) => {
		if (reqId === "vue") return vue;
		if (reqId === "noname") return nonameMock;
		if (reqId.endsWith("player-button-state.js")) {
			return { resolvePlayerButtonState: () => ({ visible: false, highlighted: false, active: false, label: "AI" }) };
		}
		if (deps[reqId]) return { __esModule: true, default: deps[reqId] };
		throw new Error(`Unexpected SFC import: ${reqId}`);
	};

	const scriptMod = { exports: {} as Record<string, any> };
	new Function("exports", "require", "module", scriptJs)(scriptMod.exports, customRequire, scriptMod);

	return { component: scriptMod.exports.default, styles: descriptor.styles.map(s => s.content).join("\n") };
}

test("PlayerCard.vue Fragment 挂载、node 回填与响应式更新", async () => {
	const nonameMock = createNonameMock();
	const stateMod = loadStateModule(nonameMock);
	const hpBar = compileSfc("./components/PlayerHpBar.vue", nonameMock);
	const idBadge = compileSfc("./components/PlayerIdentityBadge.vue", nonameMock);
	const llmBadge = compileSfc("./components/PlayerLLMBadge.vue", nonameMock);
	const mainSwitchBtn = compileSfc("./components/PlayerMainSwitchBtn.vue", nonameMock);
	const playerCard = compileSfc("./components/PlayerCard.vue", nonameMock, {
		"./PlayerHpBar.vue": hpBar.component,
		"./PlayerIdentityBadge.vue": idBadge.component,
		"./PlayerLLMBadge.vue": llmBadge.component,
		"./PlayerMainSwitchBtn.vue": mainSwitchBtn.component,
	});

	// 验证 AI 徽标样式已内聚到 PlayerLLMBadge.vue
	assert.match(llmBadge.styles, /\.player\s*>\s*\.llm-log-btn/);
	assert.match(llmBadge.styles, /@keyframes\s+llm-log-btn-active-pulse/);

	const playerEl = document.createElement("div") as HTMLDivElement & Record<string, any>;
	playerEl.className = "player";
	document.body.appendChild(playerEl);

	const state = stateMod.createPlayerCardState();
	const nodeMap: Record<string, HTMLDivElement> = {};
	const app = vue.createApp(playerCard.component, {
		player: playerEl,
		state,
		onNodeReady(key: string, el: HTMLDivElement) {
			nodeMap[key] = el;
		},
	});
	app.mount(playerEl);

	// 1. 验证直接子元素结构（无多余包装 div）与关键节点回填
	for (const key of ["avatar", "action", "avatar2", "turnedover", "framebg", "intro", "identity", "hp", "name", "name2", "nameol", "count", "equips", "judges", "marks", "chain", "llmLogBtn"]) {
		assert.ok(nodeMap[key] instanceof HTMLElement, `nodeMap.${key} should be mounted`);
	}
	assert.equal(nodeMap.avatar.parentElement, playerEl);
	assert.equal(nodeMap.action.parentElement, nodeMap.avatar);
	assert.equal(nodeMap.hp.parentElement, playerEl);
	assert.equal(nodeMap.llmLogBtn.parentElement, playerEl);
	assert.equal(nodeMap.avatar.classList.contains("hidden"), true);
	assert.equal(nodeMap.equips.classList.contains("hidden"), true);
	assert.equal(nodeMap.chain.querySelectorAll(".cardbg").length, 64);

	// 2. 验证体力勾玉模式与新旧布局
	playerEl.node = nodeMap;
	playerEl.hp = 3;
	playerEl.maxHp = 4;
	stateMod.syncHpState(state, playerEl);
	await vue.nextTick();
	let hpItems = Array.from(nodeMap.hp.children);
	assert.equal(hpItems.length, 4);
	assert.equal(hpItems.map(el => el.classList.contains("lost")).join(","), "false,false,false,true");
	assert.equal(nodeMap.hp.dataset.condition, "high");

	nonameMock._setNewLayout(true);
	stateMod.syncHpState(state, playerEl);
	await vue.nextTick();
	hpItems = Array.from(nodeMap.hp.children);
	assert.equal(hpItems.map(el => el.classList.contains("lost")).join(","), "true,false,false,false");

	// 3. 验证 maxHp > 5 文本模式与 Infinity
	playerEl.hp = 2;
	playerEl.maxHp = 6;
	stateMod.syncHpState(state, playerEl);
	await vue.nextTick();
	assert.equal(nodeMap.hp.classList.contains("textstyle"), true);
	assert.equal(nodeMap.hp.dataset.condition, "low");
	assert.match(nodeMap.hp.innerHTML, /2<br>\/<br>6/);

	playerEl.hp = Infinity;
	playerEl.maxHp = Infinity;
	stateMod.syncHpState(state, playerEl);
	await vue.nextTick();
	assert.equal(nodeMap.hp.textContent?.trim(), "∞");

	// 4. 验证手牌角标、身份标、武将名与 AI 徽标
	stateMod.syncCountState(state, 5);
	stateMod.syncIdentityState(state, playerEl, "zhu");
	stateMod.syncCharacterName1State(state, "界<br>蔡<br>文<br>姬<br>测试", "wei", true);
	stateMod.syncCharacterName2State(state, "甄<br>姬");
	stateMod.syncLLMBadgeState(state, { label: "deepseek", visible: true, highlighted: true, title: "思考中" });
	await vue.nextTick();

	assert.equal(nodeMap.count.textContent?.trim(), "5");
	assert.equal(nodeMap.count.dataset.condition, "low");
	assert.equal(nodeMap.identity.dataset.color, "zhu");
	assert.equal(nodeMap.identity.firstElementChild?.textContent, "主");
	assert.equal(nodeMap.name.dataset.nature, "wei");
	assert.equal(nodeMap.name.classList.contains("long"), true);
	assert.equal(nodeMap.name2.innerHTML, "甄<br>姬");
	assert.equal(nodeMap.llmLogBtn.textContent?.trim(), "deepseek");
	assert.equal(nodeMap.llmLogBtn.style.display, "");
	assert.equal(nodeMap.llmLogBtn.classList.contains("llm-log-btn-active"), true);

	// 5. 验证君主身份与重置
	nonameMock._setJun(true);
	stateMod.syncIdentityState(state, playerEl, "zhu");
	stateMod.resetPlayerCardState(state);
	await vue.nextTick();
	assert.equal(nodeMap.identity.firstElementChild?.textContent, "君");
	assert.equal(nodeMap.name.innerHTML, "");
	assert.equal(nodeMap.hp.children.length, 0);
	assert.equal(nodeMap.hp.textContent, "");
	assert.equal(nodeMap.count.textContent?.trim(), "0");

	app.unmount();
	playerEl.remove();
});

test("PlayerMainSwitchBtn.vue 挂载、显隐切换、并排偏移与点击切换主角色", async () => {
	const swapCalls: Array<{ player: any; player2: any; options: any }> = [];
	let autoClicks = 0;
	const nonameMock = createNonameMock() as any;
	nonameMock._status = { gameStarted: true, auto: false, llmInitialHumanPlayer: {} };
	nonameMock.game = {
		layout: "default",
		me: null,
		online: false,
		swapPlayer(player: any, player2: any, options: any) {
			swapCalls.push({ player, player2, options });
		},
	};
	nonameMock.ui.click.auto = () => {
		autoClicks++;
		nonameMock._status.auto = true;
	};

	const stateMod = loadStateModule(nonameMock);
	const hpBar = compileSfc("./components/PlayerHpBar.vue", nonameMock);
	const idBadge = compileSfc("./components/PlayerIdentityBadge.vue", nonameMock);
	const llmBadge = compileSfc("./components/PlayerLLMBadge.vue", nonameMock);
	const mainSwitchBtn = compileSfc("./components/PlayerMainSwitchBtn.vue", nonameMock);
	const playerCard = compileSfc("./components/PlayerCard.vue", nonameMock, {
		"./PlayerHpBar.vue": hpBar.component,
		"./PlayerIdentityBadge.vue": idBadge.component,
		"./PlayerLLMBadge.vue": llmBadge.component,
		"./PlayerMainSwitchBtn.vue": mainSwitchBtn.component,
	});

	const playerEl = document.createElement("div") as any;
	playerEl.className = "player";
	playerEl.isDead = () => false;
	document.body.appendChild(playerEl);

	const state = stateMod.createPlayerCardState();
	const nodeMap: Record<string, HTMLDivElement> = {};
	const app = vue.createApp(playerCard.component, {
		player: playerEl,
		state,
		onNodeReady(key: string, el: HTMLDivElement) {
			nodeMap[key] = el;
		},
	});
	app.mount(playerEl);

	assert.ok(nodeMap.mainSwitchBtn);
	assert.equal(nodeMap.mainSwitchBtn.textContent?.trim(), "视角");
	assert.equal(nodeMap.mainSwitchBtn.style.display, "");
	assert.equal(nodeMap.mainSwitchBtn.classList.contains("with-llm-badge"), false);

	stateMod.syncLLMBadgeState(state, { label: "deepseek", visible: true, highlighted: false, title: "" });
	await vue.nextTick();
	assert.equal(nodeMap.mainSwitchBtn.classList.contains("with-llm-badge"), true);

	nodeMap.mainSwitchBtn.click();
	assert.equal(autoClicks, 1);
	assert.equal(swapCalls.length, 1);
	assert.equal(swapCalls[0].player, playerEl);
	assert.equal(swapCalls[0].player2, null);
	assert.deepEqual(swapCalls[0].options, { animate: true, preserveIdentity: true });

	nonameMock.game.me = playerEl;
	stateMod.syncMainPlayerState(state, playerEl);
	await vue.nextTick();
	assert.equal(nodeMap.mainSwitchBtn.style.display, "none");

	app.unmount();
	playerEl.remove();
});

import { fileURLToPath, URL } from "node:url";
import { setInterval, clearInterval, setImmediate } from "node:timers";
import { createModuleRuntime } from "../testing/module-runtime.mjs";

const { AbortController, DOMException } = globalThis;

function node() {
	const listeners = new Map();
	const classes = new Set();
	return {
		style: {},
		dataset: {},
		children: [],
		firstChild: { innerHTML: "" },
		get childNodes() {
			return this.children;
		},
		classList: { add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)), contains: name => classes.has(name) },
		append(...children) {
			this.children.push(...children);
		},
		appendChild(child) {
			child.previousSibling = this.children.at(-1);
			child.parentNode = this;
			this.children.push(child);
			return child;
		},
		querySelector(selector) {
			return this.children.find(child => child.classList?.contains(selector.slice(1)));
		},
		addEventListener: (name, callback) => listeners.set(name, callback),
		click() {
			listeners.get("click")?.({ currentTarget: this });
		},
		remove() {
			this.removed = true;
		},
	};
}

/** 运行实际身份模式选将阶段与实际 controller；仅替换平台与 provider。 */
export async function identityFixture(options = {}) {
	const requests = [],
		logs = [],
		hooks = new Map(),
		roots = [];
	let runtime,
		event,
		openingApi,
		active = 0,
		maximum = 0,
		manual = 0;
	let manualReadyResolve, manualResumeResolve;
	const manualReady = new Promise(resolve => {
		manualReadyResolve = resolve;
	});
	const manualResume = new Promise(resolve => {
		manualResumeResolve = resolve;
	});
	const data = {};
	for (let i = 0; i < 32; i++) {
		const name = `hero${i}`;
		data[name] = { group: i === 0 ? "shen" : "wei", sex: "male", hp: 4, maxHp: 4, skills: ["test_skill"], isZhugong: i < 2 };
	}
	const config = {
		llm_enabled: true,
		llm_control_self: options.controlSelf ?? true,
		llm_default_backend: "codex",
		llm_seat_backends: options.seatBackends || {},
		continue_name: options.continueName,
		llm_url: "http://localhost:11434/v1",
		llm_apikey: "test",
		llm_model: "test",
	};
	const settings = { choice_zhu: 3, choice_fan: 3, choice_zhong: 3, choice_nei: 3, double_character: !!options.double, choose_group: true, limit_zhu: "off", change_identity: !!options.changeIdentity };
	const players = Array.from({ length: 6 }, (_, i) => ({
		dataset: { position: String(i) },
		node: { identity: node(), name: node() },
		hp: 4,
		maxHp: 4,
		initCalls: 0,
		getSeatNum: () => 0,
		getName() {
			return this.name1 || "未选将";
		},
		isUnderControl() {
			return i === 0;
		},
		setIdentity() {},
		uninit() {
			delete this.name;
			delete this.name1;
			delete this.name2;
		},
		update() {},
		isInitFilter: () => false,
		isUnseen: () => false,
		init(...names) {
			this.initCalls++;
			[this.name1, this.name2] = names;
			this.name = this.name1;
			this.group = data[this.name1].group;
		},
		chooseButton(dialog) {
			manual++;
			const groups = Array.isArray(dialog) && dialog[0] === "请选择你的势力";
			if (!groups) event.manualResult = { buttons: dialog.buttons.slice(0, settings.double_character ? 2 : 1) };
			return {
				cancel() {
					manualResumeResolve();
				},
				set() {
					return this;
				},
				forResult: async () => {
					if (groups) return { links: [["", "", "group_wu"]] };
					manualReadyResolve();
					if (options.pauseManual) await manualResume;
					return event.manualResult;
				},
			};
		},
	}));
	const status = { mode: options.mode || "normal", connectMode: !!options.connect, brawl: options.brawl, auto: false };
	const game = {
		players,
		dead: [],
		me: players[0],
		createEvent() {
			let step = 0,
				pendingStep;
			event = {
				name: "chooseCharacter",
				_result: {},
				waitCalls: 0,
				get step() {
					return step;
				},
				set step(value) {
					pendingStep = value;
				},
				updateStep() {
					if (pendingStep !== undefined) {
						step = pendingStep;
						pendingStep = undefined;
					}
				},
				getDefaultHandlerType() {
					return "onNext";
				},
				callHandler() {},
				clearStepCache() {},
				async waitNext() {
					this.waitCalls++;
					return this.manualResult;
				},
				finish() {
					this.finished = true;
				},
				setContent(content) {
					this.contents = content;
				},
			};
			status.event = event;
			return event;
		},
		saveConfig(name) {
			delete config[name];
		},
		addRecentCharacter() {},
		resume() {},
		swapSeat(first, second) {
			[first.dataset.position, second.dataset.position] = [second.dataset.position, first.dataset.position];
		},
	};
	const logger = new Proxy(
		{},
		{
			get:
				(_target, method) =>
				(...args) => {
					logs.push({ method, args });
					return method === "start" ? `log${logs.length}` : undefined;
				},
		}
	);
	const transport = {
		stateful: true,
		resetSession: async () => {},
		async sendTurn(input) {
			active++;
			maximum = Math.max(maximum, active);
			requests.push(input);
			try {
				if (options.request) return await options.request(input, requests.length);
				await new Promise(resolve => setImmediate(resolve));
				return selectionResponse(input);
			} finally {
				active--;
			}
		},
	};
	const lib = {
		config,
		character: data,
		characterReplace: options.replace ? { family: ["hero0", "hero1"] } : {},
		selectGroup: ["shen"],
		group: ["wei", "shu", "wu", "qun"],
		translate: { test_skill_info: "技能说明", zhu2: "主公", zhong2: "忠臣", fan2: "反贼", nei2: "内奸" },
		filter: { characterDisabled: () => false },
		sort: { character: (a, b) => a.localeCompare(b) },
		init: { onfree() {} },
		onfree: [],
		announce: { subscribe: (name, callback) => hooks.set(name, callback) },
	};
	const get = {
		config: name => settings[name],
		identityList: () => runtime.run(options.humanIsMonarch === false ? '["fan","zhu","zhong","fan","nei","fan"]' : '["zhu","zhong","fan","fan","nei","fan"]'),
		sourceCharacter: name => Object.keys(lib.characterReplace).find(source => lib.characterReplace[source].includes(name)) || name,
		character: name => data[name],
		translation: name => lib.translate[name] || name,
		selectGroup: (name, type) => (data[name].group === "shen" ? (type ? "kami" : ["wei", "shu", "wu", "qun"]) : type ? "default" : []),
		groupnature: group => group,
		cnNumber: number => String(number),
		distance: (from, to) => (Number(to.dataset.position) - Number(from.dataset.position) + players.length) % players.length,
		is: { double: () => false, phoneLayout: () => false },
	};
	const ui = {
		window: { appendChild: root => roots.push(root) },
		arena: node(),
		selected: { buttons: [] },
		updateLLMLogButtons() {},
		click: {
			auto() {
				status.auto = true;
			},
		},
		create: {
			div(classes = "") {
				const element = node();
				if (typeof classes === "string") element.classList.add(...classes.split(".").filter(Boolean));
				return element;
			},
			dialog(_title, _hidden, content) {
				const dialog = {
					...node(),
					content: node(),
					buttons: content[0].map(link => ({ link })),
					add() {
						const element = node();
						this.content.appendChild(element);
						return element;
					},
					setCaption() {},
					close() {},
				};
				ui.dialog = dialog;
				return dialog;
			},
			characterDialog() {},
		},
	};
	const path = relative => fileURLToPath(new URL(relative, import.meta.url));
	const openingService = Object.fromEntries(["createIdentityOpening", "selectOpeningMonarch", "selectOpeningSelf", "selectRemainingOpening"].map(name => [name, (...args) => openingApi[name](...args)]));
	runtime = await createModuleRuntime(
		{ game, lib, get, ui, _status: status, ...openingService },
		{
			AbortController,
			DOMException,
			setInterval,
			clearInterval,
			document: { createElement: node },
		},
		{
			dedent: { default: value => value },
			[path("../logger.js")]: { llmLogger: logger },
			[path("../decide.js")]: { tryLLMDecide: async () => ({ handled: false }) },
			[path("../harness/harness.js")]: { resetAllHarnessSessions() {}, selectTransport: () => transport },
			[path("../round-history.js")]: { initRoundHistoryHooks() {}, resetRoundHistory() {} },
		}
	);
	runtime.run(`
		Array.prototype.randomSort = function() { return this; };
		Array.prototype.randomGet = function() { return this[0]; };
		Array.prototype.randomGets = function(n) { return this.slice(0,n); };
		Array.prototype.addArray = function(items) { for (const item of items) if (!this.includes(item)) this.push(item); return this; };
		Array.prototype.remove = function(item) { const i = this.indexOf(item); if (i >= 0) this.splice(i,1); return this; };
	`);
	openingApi = await runtime.import("noname/llm/character-selection/identity.ts");
	const mode = (await runtime.import("mode/identity.js")).default();
	mode.game.chooseCharacter.call(game);
	const llm = await runtime.import("noname/llm/index.ts");
	llm.initLLMGameHooks();
	const { default: ArrayCompiler } = await runtime.import("noname/library/element/GameEvent/compilers/ArrayCompiler.ts");
	return {
		event,
		game,
		status,
		config,
		settings,
		lib,
		ui,
		requests,
		logs,
		roots,
		runtime,
		hooks,
		maximum: () => maximum,
		manual: () => manual,
		waitForManual: () => manualReady,
		resumeManual: () => manualResumeResolve(),
		async run() {
			const contents = typeof event.contents === "function" ? [event.contents] : event.contents;
			await new ArrayCompiler().compile(contents).call(event, event);
		},
		close() {
			event.llmOpening?.close(true);
		},
	};
}

export function selectionResponse(input) {
	const message = String(input.fullTranscript[1].content);
	const candidates = JSON.parse(message.match(/## 冻结候选[^\n]*\n([^\n]+)/)[1]);
	const count = Number(message.match(/请选择 (\d+) 名/)[1]);
	const characters = candidates.slice(0, count).map(candidate => ({ ref: candidate.ref, version: candidate.versions[0].name }));
	const groups = candidates[0].versions[0].groups;
	return {
		toolCall: { id: "call1", name: "select_character", reason: "适合本座位身份", arguments: { characters, ...(groups.length ? { group: groups[groups.length - 1] } : {}) } },
		transport: "stream",
		syncedRemote: true,
	};
}

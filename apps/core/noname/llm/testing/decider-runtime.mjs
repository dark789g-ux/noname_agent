import { fileURLToPath, URL } from "node:url";
import { createSkillRuntime } from "./skill-runtime.mjs";

/** Real orchestrator with a deterministic provider, no network or credentials. */
export async function createDeciderRuntime(configOverrides = {}) {
	let dispatch;
	const requests = [],
		logs = [],
		queue = [];
	const config = { enabled: true, url: "http://localhost:1/v1", apikey: "test-only", model: "mock", timeoutSec: 1, decisionTimeoutSec: 10, multiTurn: true, maxTurns: 4, ...configOverrides };
	const logger = new Proxy(
		{},
		{
			get: (_target, name) =>
				name === "start"
					? (...args) => {
							logs.push([name, ...args]);
							return `log${logs.length}`;
						}
					: (...args) => logs.push([name, ...args]),
		}
	);
	const request = async (messages, tools) => {
		requests.push({ messages, tools });
		const next = queue.shift();
		if (next instanceof Error) throw next;
		if (!next) throw new Error("Mock response queue exhausted");
		return typeof next === "function" ? next(messages, tools) : next;
	};
	const modulePath = file => fileURLToPath(new URL(`../${file}.js`, import.meta.url));
	const f = await createSkillRuntime({
		engine: { _status: { llmEnabledAtGameStart: true } },
		modules: {
			"@/llm/index.js": { tryLLMDecide: event => dispatch(event) },
			[modulePath("index")]: { llmEnabled: () => true, llmConfigured: () => true, getLLMConfig: () => config },
			[modulePath("logger")]: { llmLogger: logger },
			[modulePath("client")]: { callLLMStream: request, callLLMWithTimeout: request },
			[modulePath("context")]: { buildContext: event => ({ messages: [{ role: "user", content: JSON.stringify({ actor: event.player.name, hand: event.player.getCards("h").map(card => card.name) }) }] }) },
		},
	});
	const { tryLLMDecide } = await f.moduleRuntime.import("noname/llm/decide.ts");
	dispatch = tryLLMDecide;
	return { ...f, config, requests, logs, queue, decide: tryLLMDecide };
}

export function choiceEvent(player, name, properties, decide) {
	const event = {
		name,
		player,
		...properties,
		set(key, value) {
			this[key] = value;
			return this;
		},
		setHiddenSkill(skill) {
			this.hsskill = skill;
			return this;
		},
		async forResult() {
			const outcome = await decide(this);
			if (!outcome.handled) throw new Error(`Unexpected native fallback: ${this.name}`);
			return outcome.result;
		},
	};
	return event;
}

export function stageTool(type, refs) {
	return (_messages, tools) => {
		const definition = tools.find(tool => tool.function.name === `select_${type}s`).function;
		const stepId = definition.parameters.properties.step_id.description.split("：")[1];
		return { id: "mock-stage", name: definition.name, arguments: { step_id: stepId, [`${type}_refs`]: refs }, reason: "固定后续选择" };
	};
}

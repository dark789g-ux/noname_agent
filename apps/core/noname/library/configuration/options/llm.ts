import { game } from "noname";
import { ui } from "noname";
import { saveLLMTextInput } from "@/llm/config-input.js";

export function createConfigMenuLlm() {
	return {
		name: "AI / LLM",
		config: {
			llm_enabled: {
				name: "启用 LLM AI 助手",
				init: false,
				intro: "启用后，AI 玩家决策改由 LLM 接管；失败/超时自动回退本地 AI。注意：浏览器模式需自建代理（CORS），Electron 模式可直接使用。",
				onclick(bool) {
					game.saveConfig("llm_enabled", bool);
					try {
						if (typeof ui !== "undefined") {
							ui.updateAIModeIndicator?.();
							ui.updateLLMLogButtons?.();
						}
					} catch (e) {}
				},
			},
			llm_control_self: {
				name: "玩家角色接入 LLM",
				init: false,
				intro: "需同时启用「LLM AI 助手」，并在下一局生效。开启后，开局选将仍由玩家完成，进入对局后玩家角色完全交由 LLM 操控（失败或超时自动回退本地 AI），对局期间不可手动操作。",
				onclick(bool) {
					game.saveConfig("llm_control_self", bool);
					try {
						if (typeof ui !== "undefined") {
							ui.updateLLMLogButtons?.();
						}
					} catch (e) {}
				},
			},
			llm_max_turns: {
				name: "最大决策轮次",
				init: "4",
				item: {
					1: "1 轮",
					2: "2 轮",
					3: "3 轮",
					4: "4 轮",
					5: "5 轮",
					6: "6 轮",
					7: "7 轮",
					8: "8 轮",
				} as Record<string, string>,
				intro: "启用 LLM 后自动允许多轮选择。此处限制单次决策的最多请求次数；预算不足时回退当前选择的本地 AI。",
			},
			llm_decision_timeout: {
				name: "决策总超时（秒）",
				init: "60",
				input: true,
				intro: "多轮决策允许使用的总时长；单轮请求仍受「超时（秒）」限制。",
				/** @type {(this: HTMLDivElement) => void} */
				onblur: function (this: import("@/library/contracts/menu.js").MenuCallbackNode): void {
					let val = parseInt(this.innerHTML.replace(/<br>/g, ""));
					if (isNaN(val) || val < 10) val = 60;
					if (val > 300) val = 300;
					this.innerHTML = String(val);
					game.saveConfig("llm_decision_timeout", val);
				} as (this: HTMLDivElement) => void,
			},
			llm_url: {
				name: "API 地址",
				init: "",
				input: true,
				intro: "OpenAI 兼容的 API baseURL（SDK 会自动拼接 /chat/completions）。如 https://api.openai.com/v1 或 http://localhost:11434/v1。浏览器模式需自建代理（CORS），Electron 模式可直接使用。",
				/** @type {(this: HTMLDivElement) => void} */
				onblur: function (this: import("@/library/contracts/menu.js").MenuCallbackNode): void {
					saveLLMTextInput(this, "llm_url", (key, value) => game.saveConfig(key, value));
				} as (this: HTMLDivElement) => void,
			},
			llm_apikey: {
				name: "API 密钥",
				init: "",
				input: true,
				intro: "API Key。敏感信息，仅存本地 IndexedDB，不会上传 git或任何远端。",
				/** @type {(this: HTMLDivElement) => void} */
				onblur: function (this: import("@/library/contracts/menu.js").MenuCallbackNode): void {
					saveLLMTextInput(this, "llm_apikey", (key, value) => game.saveConfig(key, value));
				} as (this: HTMLDivElement) => void,
			},
			llm_model: {
				name: "模型名称",
				init: "",
				input: true,
				intro: "要调用的模型，如 gpt-4o-mini、deepseek-chat 等",
				/** @type {(this: HTMLDivElement) => void} */
				onblur: function (this: import("@/library/contracts/menu.js").MenuCallbackNode): void {
					saveLLMTextInput(this, "llm_model", (key, value) => game.saveConfig(key, value));
				} as (this: HTMLDivElement) => void,
			},
			llm_thinking_effort: {
				name: "思考深度",
				init: "medium",
				item: {
					none: "无",
					low: "低",
					medium: "中",
					high: "高",
				} as Record<string, string>,
				intro: "推理模型的思考投入程度（reasoning_effort）。非推理模型选「无」。",
			},
			llm_max_retries: {
				name: "最大重试次数",
				init: "0",
				item: {
					0: "0（不重试）",
					1: "1 次",
					2: "2 次",
					3: "3 次",
				} as Record<string, string>,
				intro: "LLM 请求失败时的自动重试次数（由 openai SDK 执行）。0 表示不重试，与旧版行为一致。",
			},
			llm_timeout: {
				name: "超时（秒）",
				init: "30",
				input: true,
				intro: "LLM 请求超时秒数，超时自动回退本地 AI",
				/** @type {(this: HTMLDivElement) => void} */
				onblur: function (this: import("@/library/contracts/menu.js").MenuCallbackNode): void {
					let val = parseInt(this.innerHTML.replace(/<br>/g, ""));
					if (isNaN(val) || val < 1) val = 30;
					if (val > 300) val = 300;
					this.innerHTML = String(val);
					game.saveConfig("llm_timeout", val);
				} as (this: HTMLDivElement) => void,
			},
		},
	};
}

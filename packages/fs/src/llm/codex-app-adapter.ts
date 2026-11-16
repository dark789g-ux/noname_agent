import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { splitCliArgs, stagedError } from "./cli-runner.js";
import { RpcProtocolError, RpcStdioClient } from "./rpc-stdio.js";
import {
	mergeSessionUsage,
	sessionLostError,
	type PersistentSessionAdapter,
	type SessionStreamUsage,
	type SessionTurnCallbacks,
	type SessionTurnRequest,
	type SessionTurnResult,
} from "./session-types.js";

const CODEX_HEADLESS_INSTRUCTIONS =
	"【无头执行约束】请严格仅依据提供的牌局信息与可用工具定义进行决策，严格按照 outputSchema 输出合法 JSON；禁止调用任何本地工具、读写文件或执行命令。";

interface ActiveCodexTurn {
	threadId: string;
	turnId?: string;
	thoughtBuffer: string;
	textBuffer: string;
	usage?: SessionStreamUsage;
	sawChunk: boolean;
	sawToken: boolean;
	callbacks: SessionTurnCallbacks;
	resolve: (res: { status: string; errorMessage?: string }) => void;
	reject: (err: Error) => void;
}

function asNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function extractCodexUsage(params: unknown): SessionStreamUsage | undefined {
	if (!params || typeof params !== "object") return undefined;
	const root = params as Record<string, unknown>;
	const rawUsage = (root.tokenUsage ?? root.usage ?? root) as Record<string, unknown>;
	const last = (rawUsage.last ?? rawUsage.last_token_usage ?? rawUsage) as Record<string, unknown>;
	const total = (rawUsage.total ?? rawUsage.total_token_usage ?? rawUsage) as Record<string, unknown>;

	const out: SessionStreamUsage = {};
	const inputTokens = asNumber(last.inputTokens ?? last.input_tokens);
	const outputTokens = asNumber(last.outputTokens ?? last.output_tokens);
	const thoughtTokens = asNumber(
		last.reasoningOutputTokens ?? last.reasoning_output_tokens ?? last.thoughtTokens ?? last.thought_tokens
	);
	const contextUsed = asNumber(
		total.totalTokens ?? total.total_tokens ?? rawUsage.contextUsed ?? rawUsage.used
	);
	const contextSize = asNumber(
		rawUsage.modelContextWindow ?? rawUsage.model_context_window ?? rawUsage.contextSize ?? rawUsage.size
	);

	if (inputTokens !== undefined) out.inputTokens = inputTokens;
	if (outputTokens !== undefined) out.outputTokens = outputTokens;
	if (thoughtTokens !== undefined) out.thoughtTokens = thoughtTokens;
	if (contextUsed !== undefined) out.contextUsed = contextUsed;
	if (contextSize !== undefined) out.contextSize = contextSize;
	return Object.keys(out).length ? out : undefined;
}

function extractCompletedText(item: Record<string, unknown>): string {
	if (typeof item.text === "string") return item.text;
	if (Array.isArray(item.summary)) {
		return item.summary
			.map(part => (typeof part === "string" ? part : typeof (part as any)?.text === "string" ? (part as any).text : ""))
			.join("\n");
	}
	if (Array.isArray(item.content)) {
		return item.content
			.map(part => (typeof part === "string" ? part : typeof (part as any)?.text === "string" ? (part as any).text : ""))
			.join("");
	}
	return "";
}

export class CodexAppSessionAdapter implements PersistentSessionAdapter {
	readonly provider = "codex" as const;
	private readonly command: string;
	private readonly extraArgs: string;
	private client: RpcStdioClient | null = null;
	private sandboxDir: string | null = null;
	private initialized = false;
	private threadId: string | null = null;
	private activeTurn: ActiveCodexTurn | null = null;
	private ignoredTurnIds = new Set<string>();
	private disposed = false;

	constructor(req: Pick<SessionTurnRequest, "command" | "extraArgs">) {
		this.command = req.command || "codex";
		this.extraArgs = req.extraArgs || "";
	}

	isAlive(): boolean {
		return !this.disposed && Boolean(this.client?.isAlive()) && Boolean(this.threadId);
	}

	matchesConfig(req: SessionTurnRequest): boolean {
		return (
			req.provider === "codex" &&
			(req.command || "codex") === this.command &&
			(req.extraArgs || "") === this.extraArgs
		);
	}

	async runTurn(req: SessionTurnRequest, callbacks: SessionTurnCallbacks): Promise<SessionTurnResult> {
		if (this.disposed) throw sessionLostError();
		if (!req.reset && !this.isAlive()) {
			throw sessionLostError("codex app-server 会话尚未建立或已中断");
		}

		const timeoutMs = Math.max(5, Math.min(300, req.timeoutSec || 60)) * 1000;
		const deadline = Date.now() + timeoutMs;
		await this.ensureInitialized(Math.min(15000, timeoutMs), callbacks.signal);

		const hadThread = Boolean(this.threadId);
		const shouldStartThread = req.reset || !this.threadId;
		if (shouldStartThread) {
			const remaining = Math.max(1000, deadline - Date.now());
			const threadRes = await this.client!.request<{ thread?: { id?: string }; threadId?: string }>(
				"thread/start",
				{
					cwd: this.sandboxDir!,
					approvalPolicy: "never",
					sandbox: "read-only",
					model: req.model || undefined,
					baseInstructions: CODEX_HEADLESS_INSTRUCTIONS,
				},
				{ timeoutMs: remaining, signal: callbacks.signal }
			);
			const id = threadRes?.thread?.id || threadRes?.threadId;
			if (!id) {
				throw stagedError("fetch", "codex app-server 未返回有效的 threadId");
			}
			this.threadId = id;
		}

		const rebuilt = Boolean(req.reset && hadThread);
		callbacks.onSessionInfo?.({ sessionId: this.threadId!, rebuilt });

		let resolveCompletion!: (res: { status: string; errorMessage?: string }) => void;
		let rejectCompletion!: (err: Error) => void;
		const completionPromise = new Promise<{ status: string; errorMessage?: string }>((resolve, reject) => {
			resolveCompletion = resolve;
			rejectCompletion = reject;
		});
		// 防止在 turn/start 阶段提前抛错跳出时，completionPromise 被 reject 触发 UnhandledPromiseRejection 导致进程崩溃
		completionPromise.catch(() => {});

		const turn: ActiveCodexTurn = {
			threadId: this.threadId!,
			thoughtBuffer: "",
			textBuffer: "",
			sawChunk: false,
			sawToken: false,
			callbacks,
			resolve: resolveCompletion,
			reject: rejectCompletion,
		};
		this.activeTurn = turn;

		let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
		const sendInterrupt = () => {
			if (turn.turnId) this.ignoredTurnIds.add(turn.turnId);
			if (this.threadId && turn.turnId && this.client?.isAlive()) {
				this.client.notify("turn/interrupt", { threadId: this.threadId, turnId: turn.turnId });
			}
		};
		const onAbort = () => {
			sendInterrupt();
			turn.reject(stagedError("fetch", "codex app-server 会话请求已取消"));
		};
		callbacks.signal?.addEventListener("abort", onAbort, { once: true });

		try {
			const remaining = Math.max(1000, deadline - Date.now());
			timeoutHandle = setTimeout(() => {
				sendInterrupt();
				turn.reject(stagedError("fetch", `codex app-server 请求超时 (${req.timeoutSec}s)`));
			}, remaining);

			const effort =
				req.thinkingEffort && req.thinkingEffort !== "default" ? req.thinkingEffort : undefined;
			const startRes = await this.client!.request<{ turn?: { id?: string }; turnId?: string }>(
				"turn/start",
				{
					threadId: this.threadId,
					input: [{ type: "text", text: req.prompt }],
					model: req.model || undefined,
					effort,
					outputSchema: req.jsonSchema,
				},
				{ timeoutMs: Math.max(1000, deadline - Date.now()), signal: callbacks.signal }
			);
			turn.turnId = startRes?.turn?.id || startRes?.turnId;

			const completed = await completionPromise;
			if (completed.status === "failed") {
				throw stagedError("fetch", completed.errorMessage || "codex app-server 决策执行失败");
			}
			if (completed.status === "interrupted") {
				throw stagedError("fetch", "codex app-server 会话请求已取消");
			}
			if (!turn.textBuffer.trim()) {
				throw stagedError("parse", "codex app-server 未返回决策内容");
			}

			return {
				rawOutput: turn.textBuffer,
				reasoningContent: turn.thoughtBuffer || undefined,
				usage: turn.usage,
				sessionId: this.threadId!,
				rebuilt,
			};
		} finally {
			if (timeoutHandle) clearTimeout(timeoutHandle);
			callbacks.signal?.removeEventListener("abort", onAbort);
			if (this.activeTurn === turn) this.activeTurn = null;
		}
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		if (this.activeTurn) {
			this.activeTurn.reject(sessionLostError("codex app-server 会话已关闭"));
			this.activeTurn = null;
		}
		this.threadId = null;
		this.initialized = false;
		if (this.client) {
			this.client.dispose();
			this.client = null;
		}
		if (this.sandboxDir) {
			const dir = this.sandboxDir;
			this.sandboxDir = null;
			void fs.rm(dir, { recursive: true, force: true }).catch(() => {});
		}
	}

	private async ensureInitialized(timeoutMs: number, signal?: AbortSignal): Promise<void> {
		if (this.initialized && this.client?.isAlive()) return;
		if (!this.sandboxDir) {
			this.sandboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "noname-codex-"));
		}
		if (!this.client || !this.client.isAlive()) {
			this.initialized = false;
			this.threadId = null;
			const extra = splitCliArgs(this.extraArgs);
			this.client = new RpcStdioClient({
				command: this.command,
				args: ["app-server", ...extra],
				cwd: this.sandboxDir,
				includeJsonRpcHeader: false,
				onNotification: (method, params) => this.handleNotification(method, params),
				onRequest: async (_id, method) => this.handleIncomingRequest(method),
				onExit: info => {
					this.initialized = false;
					this.threadId = null;
					if (this.activeTurn) {
						this.activeTurn.reject(info.error ?? sessionLostError("codex app-server 进程已退出"));
					}
				},
			});
			this.client.start();
		}

		await this.client.request(
			"initialize",
			{
				clientInfo: { name: "noname", title: "noname LLM Harness", version: "1.0.0" },
				capabilities: {},
			},
			{ timeoutMs, signal }
		);
		this.client.notify("initialized", {});
		this.initialized = true;
	}

	private handleIncomingRequest(method: string): unknown {
		if (method.includes("Approval") || method.includes("approval")) {
			return { decision: "decline" };
		}
		throw new RpcProtocolError(`Headless sandbox prohibits method: ${method}`, { code: -32601 });
	}

	private handleNotification(method: string, params: unknown): void {
		const turn = this.activeTurn;
		if (!turn || !params || typeof params !== "object") return;
		const rec = params as Record<string, unknown>;
		if (typeof rec.threadId === "string" && rec.threadId !== turn.threadId) return;
		const turnObjRaw = rec.turn && typeof rec.turn === "object" ? (rec.turn as Record<string, unknown>) : null;
		const msgTurnId =
			typeof rec.turnId === "string"
				? rec.turnId
				: typeof turnObjRaw?.id === "string"
					? turnObjRaw.id
					: undefined;
		if (msgTurnId && this.ignoredTurnIds.has(msgTurnId)) return;
		if (msgTurnId && turn.turnId && msgTurnId !== turn.turnId) return;

		const markChunk = () => {
			if (!turn.sawChunk) {
				turn.sawChunk = true;
				turn.callbacks.onFirstChunk?.();
			}
		};
		const markToken = () => {
			markChunk();
			if (!turn.sawToken) {
				turn.sawToken = true;
				turn.callbacks.onFirstToken?.();
			}
		};

		if (method === "item/reasoning/summaryTextDelta" || method === "item/reasoning/textDelta") {
			const delta = typeof rec.delta === "string" ? rec.delta : typeof rec.textDelta === "string" ? rec.textDelta : "";
			if (!delta) return;
			markToken();
			turn.thoughtBuffer += delta;
			turn.callbacks.onThoughtDelta?.(delta);
			return;
		}

		if (method === "item/agentMessage/delta" || method === "item/message/delta") {
			const delta = typeof rec.delta === "string" ? rec.delta : typeof rec.textDelta === "string" ? rec.textDelta : "";
			if (!delta) return;
			markToken();
			turn.textBuffer += delta;
			turn.callbacks.onTextDelta?.(delta);
			return;
		}

		if (method === "item/completed" && rec.item && typeof rec.item === "object") {
			const item = rec.item as Record<string, unknown>;
			const itemType = String(item.type || "");
			if (itemType === "reasoning" && !turn.thoughtBuffer) {
				const full = extractCompletedText(item);
				if (full) {
					markToken();
					turn.thoughtBuffer = full;
					turn.callbacks.onThoughtSnapshot?.(full);
				}
			} else if ((itemType === "agentMessage" || itemType === "agent_message") && !turn.textBuffer) {
				const full = extractCompletedText(item);
				if (full) {
					markToken();
					turn.textBuffer = full;
					turn.callbacks.onTextDelta?.(full);
				}
			}
			return;
		}

		if (method === "thread/tokenUsage/updated" || method === "turn/tokenUsage/updated") {
			const nextUsage = extractCodexUsage(rec);
			const merged = mergeSessionUsage(turn.usage, nextUsage);
			if (merged) {
				turn.usage = merged;
				markChunk();
				turn.callbacks.onUsage?.(merged);
			}
			return;
		}

		if (method === "turn/completed") {
			const turnObj = (rec.turn && typeof rec.turn === "object" ? rec.turn : rec) as Record<string, unknown>;
			const status = typeof turnObj.status === "string" ? turnObj.status : "completed";
			const errObj = (turnObj.error && typeof turnObj.error === "object" ? turnObj.error : null) as Record<string, unknown> | null;
			const errorMessage = typeof errObj?.message === "string" ? errObj.message : undefined;
			turn.resolve({ status, errorMessage });
		}
	}
}

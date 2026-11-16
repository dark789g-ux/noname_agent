import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AGY_HEADLESS_INSTRUCTION, splitCliArgs, stagedError } from "./cli-runner.js";
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

interface ActiveAcpTurn {
	sessionId: string;
	thoughtBuffer: string;
	textBuffer: string;
	usage?: SessionStreamUsage;
	sawChunk: boolean;
	sawToken: boolean;
	callbacks: SessionTurnCallbacks;
}

function extractAcpText(content: unknown): string {
	if (!content) return "";
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content.map(part => extractAcpText(part)).join("");
	}
	if (typeof content === "object") {
		const record = content as Record<string, unknown>;
		if (record.type === "text" && typeof record.text === "string") return record.text;
		if (typeof record.text === "string") return record.text;
	}
	return "";
}

function extractAcpUsage(raw: unknown): SessionStreamUsage | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const obj = raw as Record<string, unknown>;
	const out: SessionStreamUsage = {};
	const inputTokens = obj.inputTokens ?? obj.input_tokens;
	const outputTokens = obj.outputTokens ?? obj.output_tokens;
	const thoughtTokens = obj.thoughtTokens ?? obj.thought_tokens;
	const used = obj.used ?? obj.contextUsed;
	const size = obj.size ?? obj.contextSize;

	if (typeof inputTokens === "number") out.inputTokens = inputTokens;
	if (typeof outputTokens === "number") out.outputTokens = outputTokens;
	if (typeof thoughtTokens === "number") out.thoughtTokens = thoughtTokens;
	if (typeof used === "number") out.contextUsed = used;
	if (typeof size === "number") out.contextSize = size;

	return Object.keys(out).length ? out : undefined;
}

export class AcpSessionAdapter implements PersistentSessionAdapter {
	readonly provider = "agy" as const;
	private readonly command: string;
	private readonly extraArgs: string;
	private client: RpcStdioClient | null = null;
	private sandboxDir: string | null = null;
	private initialized = false;
	private sessionId: string | null = null;
	private currentModel = "";
	private activeTurn: ActiveAcpTurn | null = null;
	private disposed = false;

	constructor(req: Pick<SessionTurnRequest, "command" | "extraArgs">) {
		this.command = req.command || "agy";
		this.extraArgs = req.extraArgs || "";
	}

	isAlive(): boolean {
		return !this.disposed && Boolean(this.client?.isAlive()) && Boolean(this.sessionId);
	}

	matchesConfig(req: SessionTurnRequest): boolean {
		return (
			req.provider === "agy" &&
			(req.command || "agy") === this.command &&
			(req.extraArgs || "") === this.extraArgs
		);
	}

	async runTurn(req: SessionTurnRequest, callbacks: SessionTurnCallbacks): Promise<SessionTurnResult> {
		if (this.disposed) throw sessionLostError();
		if (!req.reset && !this.isAlive()) {
			throw sessionLostError("agy acp 会话尚未建立或已中断");
		}

		const timeoutMs = Math.max(5, Math.min(300, req.timeoutSec || 60)) * 1000;
		const deadline = Date.now() + timeoutMs;
		await this.ensureInitialized(Math.min(15000, timeoutMs), callbacks.signal);

		const hadSession = Boolean(this.sessionId);
		const shouldCreateSession = req.reset || !this.sessionId;
		if (shouldCreateSession) {
			const remaining = Math.max(1000, deadline - Date.now());
			const created = await this.client!.request<{ sessionId?: string }>(
				"session/new",
				{ cwd: this.sandboxDir!, mcpServers: [] },
				{ timeoutMs: remaining, signal: callbacks.signal }
			);
			if (!created?.sessionId) {
				throw stagedError("fetch", "agy acp 未返回有效的 sessionId");
			}
			this.sessionId = created.sessionId;
			this.currentModel = "";
		}

		const targetModel = (req.model || "").trim();
		if (targetModel && targetModel !== this.currentModel) {
			const remaining = Math.max(1000, deadline - Date.now());
			await this.client!.request(
				"session/set_model",
				{ sessionId: this.sessionId, modelId: targetModel },
				{ timeoutMs: remaining, signal: callbacks.signal }
			);
			this.currentModel = targetModel;
		}

		const rebuilt = Boolean(req.reset && hadSession);
		callbacks.onSessionInfo?.({ sessionId: this.sessionId!, rebuilt });

		const turn: ActiveAcpTurn = {
			sessionId: this.sessionId!,
			thoughtBuffer: "",
			textBuffer: "",
			sawChunk: false,
			sawToken: false,
			callbacks,
		};
		this.activeTurn = turn;

		const onAbort = () => {
			if (this.sessionId && this.client?.isAlive()) {
				this.client.notify("session/cancel", { sessionId: this.sessionId });
			}
		};
		callbacks.signal?.addEventListener("abort", onAbort, { once: true });

		try {
			const promptText = shouldCreateSession ? `${AGY_HEADLESS_INSTRUCTION}\n\n${req.prompt}` : req.prompt;
			const remaining = Math.max(1000, deadline - Date.now());
			const response = await this.client!.request<{ stopReason?: string; usage?: unknown }>(
				"session/prompt",
				{
					sessionId: this.sessionId,
					prompt: [{ type: "text", text: promptText }],
				},
				{ timeoutMs: remaining, signal: callbacks.signal }
			);

			const finalUsage = mergeSessionUsage(turn.usage, extractAcpUsage(response?.usage));
			if (finalUsage) {
				turn.usage = finalUsage;
				callbacks.onUsage?.(finalUsage);
			}

			if (response?.stopReason === "cancelled") {
				throw stagedError("fetch", "agy acp 会话请求已取消");
			}
			if (!turn.textBuffer.trim()) {
				throw stagedError("parse", "agy acp 未返回决策内容");
			}

			return {
				rawOutput: turn.textBuffer,
				reasoningContent: turn.thoughtBuffer || undefined,
				usage: finalUsage,
				sessionId: this.sessionId!,
				rebuilt,
			};
		} finally {
			callbacks.signal?.removeEventListener("abort", onAbort);
			if (this.activeTurn === turn) this.activeTurn = null;
		}
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.activeTurn = null;
		this.sessionId = null;
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
			this.sandboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "noname-acp-"));
		}
		if (!this.client || !this.client.isAlive()) {
			this.initialized = false;
			this.sessionId = null;
			const extra = splitCliArgs(this.extraArgs).filter(arg => arg !== "--effort");
			this.client = new RpcStdioClient({
				command: this.command,
				args: ["acp", ...extra],
				cwd: this.sandboxDir,
				includeJsonRpcHeader: true,
				onNotification: (method, params) => this.handleNotification(method, params),
				onRequest: async (_id, method, params) => this.handleIncomingRequest(method, params),
				onExit: () => {
					this.initialized = false;
					this.sessionId = null;
				},
			});
			this.client.start();
		}

		await this.client.request(
			"initialize",
			{
				protocolVersion: 1,
				clientCapabilities: {},
			},
			{ timeoutMs, signal }
		);
		this.initialized = true;
	}

	private handleIncomingRequest(method: string, params: unknown): unknown {
		if (method === "session/request_permission") {
			const obj = (params && typeof params === "object" ? params : {}) as Record<string, unknown>;
			const options = Array.isArray(obj.options) ? obj.options : [];
			const rejectOption = options.find((opt: any) => opt?.kind === "reject_always" || opt?.kind === "reject_once");
			if (rejectOption && typeof (rejectOption as any).optionId === "string") {
				return { outcome: { outcome: "selected", optionId: (rejectOption as any).optionId } };
			}
			return { outcome: { outcome: "cancelled" } };
		}
		throw new RpcProtocolError(`Headless sandbox prohibits method: ${method}`, { code: -32601 });
	}

	private handleNotification(method: string, params: unknown): void {
		if (method !== "session/update" || !this.activeTurn) return;
		if (!params || typeof params !== "object") return;
		const record = params as Record<string, unknown>;
		if (typeof record.sessionId === "string" && record.sessionId !== this.activeTurn.sessionId) return;
		const update = record.update;
		if (!update || typeof update !== "object") return;
		const upd = update as Record<string, unknown>;
		const turn = this.activeTurn;

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

		if (upd.sessionUpdate === "agent_thought_chunk") {
			const delta = extractAcpText(upd.content);
			if (!delta) return;
			markToken();
			turn.thoughtBuffer += delta;
			turn.callbacks.onThoughtDelta?.(delta);
		} else if (upd.sessionUpdate === "agent_message_chunk") {
			const delta = extractAcpText(upd.content);
			if (!delta) return;
			markToken();
			turn.textBuffer += delta;
			turn.callbacks.onTextDelta?.(delta);
		} else if (upd.sessionUpdate === "usage_update") {
			const nextUsage = extractAcpUsage(upd);
			const merged = mergeSessionUsage(turn.usage, nextUsage);
			if (merged) {
				turn.usage = merged;
				markChunk();
				turn.callbacks.onUsage?.(merged);
			}
		}
	}
}

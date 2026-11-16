import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import { buildSpawnSpec, resolveCommandTarget } from "./cli-command.js";
import { stagedError, terminateChildTree } from "./cli-runner.js";

const MAX_STDERR_CHARS = 16384;

export class RpcProtocolError extends Error {
	code?: number;
	data?: unknown;
	stage: "config" | "fetch" | "parse";

	constructor(
		message: string,
		options?: { code?: number; data?: unknown; stage?: "config" | "fetch" | "parse" }
	) {
		super(message);
		this.name = "RpcProtocolError";
		this.code = options?.code;
		this.data = options?.data;
		this.stage = options?.stage ?? "fetch";
	}
}

export interface RpcExitInfo {
	code: number | null;
	signal: string | null;
	stderr: string;
	error?: Error;
}

export interface RpcStdioOptions {
	command: string;
	args: string[];
	cwd?: string;
	env?: NodeJS.ProcessEnv;
	includeJsonRpcHeader?: boolean;
	onNotification?: (method: string, params: unknown) => void;
	onRequest?: (id: string | number, method: string, params: unknown) => Promise<unknown>;
	onExit?: (info: RpcExitInfo) => void;
}

interface PendingRequest {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	timer?: ReturnType<typeof setTimeout>;
	onAbort?: () => void;
	signal?: AbortSignal;
}

export class RpcStdioClient {
	private readonly options: RpcStdioOptions;
	private child: ChildProcessByStdio<Writable, Readable, Readable> | null = null;
	private nextId = 1;
	private pending = new Map<string, PendingRequest>();
	private stdoutBuffer = "";
	private stderrTail = "";
	private closed = false;
	private disposed = false;
	private spawnError: Error | null = null;

	constructor(options: RpcStdioOptions) {
		this.options = options;
	}

	start(): void {
		if (this.child || this.disposed) return;
		const target = resolveCommandTarget(this.options.command);
		const spec = buildSpawnSpec(target, this.options.args);
		const child = spawn(spec.file, spec.args, {
			cwd: this.options.cwd,
			env: this.options.env ?? process.env,
			shell: false,
			detached: spec.useDetachedGroup,
			windowsHide: true,
			windowsVerbatimArguments: spec.windowsVerbatimArguments,
			stdio: ["pipe", "pipe", "pipe"],
		});
		this.child = child;
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");

		child.stdout.on("error", () => {});
		child.stderr.on("error", () => {});
		child.stdout.on("data", (chunk: string) => this.handleStdoutChunk(chunk));
		child.stderr.on("data", (chunk: string) => {
			this.stderrTail = (this.stderrTail + chunk).slice(-MAX_STDERR_CHARS);
		});
		child.stdin.on("error", () => {});

		child.on("error", err => {
			const mapped = this.mapSpawnFailure(err);
			this.spawnError = mapped;
			this.handleProcessClosed(null, null, mapped);
		});

		child.on("close", (code, signal) => {
			this.handleProcessClosed(code, signal, this.spawnError ?? undefined);
		});
	}

	isAlive(): boolean {
		return Boolean(this.child && !this.closed && !this.disposed);
	}

	getStderrTail(): string {
		return this.stderrTail.trim();
	}

	async request<T = unknown>(
		method: string,
		params?: unknown,
		options?: { timeoutMs?: number; signal?: AbortSignal }
	): Promise<T> {
		if (this.disposed || this.closed) {
			throw this.buildClosedError("会话进程已关闭");
		}
		if (!this.child) this.start();
		if (this.disposed || this.closed) {
			throw this.buildClosedError("会话进程启动失败或已退出");
		}

		const id = this.nextId++;
		const key = String(id);
		const payload: Record<string, unknown> = { id, method };
		if (this.options.includeJsonRpcHeader !== false) payload.jsonrpc = "2.0";
		if (params !== undefined) payload.params = params;

		return await new Promise<T>((resolve, reject) => {
			if (options?.signal?.aborted) {
				reject(stagedError("fetch", "请求已取消"));
				return;
			}

			const entry: PendingRequest = {
				resolve: value => resolve(value as T),
				reject,
				signal: options?.signal,
			};

			if (options?.timeoutMs && options.timeoutMs > 0) {
				entry.timer = setTimeout(() => {
					this.removePending(key);
					reject(stagedError("fetch", `RPC 请求超时 (${method}, ${options.timeoutMs}ms)`));
				}, options.timeoutMs);
			}

			if (options?.signal) {
				entry.onAbort = () => {
					this.removePending(key);
					reject(stagedError("fetch", "请求已取消"));
				};
				options.signal.addEventListener("abort", entry.onAbort, { once: true });
			}

			this.pending.set(key, entry);
			try {
				this.writeLine(payload);
			} catch (err) {
				this.removePending(key);
				reject(err instanceof Error ? err : stagedError("fetch", String(err)));
			}
		});
	}

	notify(method: string, params?: unknown): void {
		if (this.disposed || this.closed || !this.child) return;
		const payload: Record<string, unknown> = { method };
		if (this.options.includeJsonRpcHeader !== false) payload.jsonrpc = "2.0";
		if (params !== undefined) payload.params = params;
		try {
			this.writeLine(payload);
		} catch {}
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.closed = true;
		this.failAllPending(stagedError("fetch", "本地会话已关闭"));
		if (this.child) {
			try {
				this.child.stdin.end();
			} catch {}
			terminateChildTree(this.child);
			this.child = null;
		}
	}

	private writeLine(payload: Record<string, unknown>): void {
		if (!this.child || this.closed || this.disposed) {
			throw this.buildClosedError("会话通道不可用");
		}
		this.child.stdin.write(`${JSON.stringify(payload)}\n`);
	}

	private handleStdoutChunk(chunk: string): void {
		this.stdoutBuffer += chunk;
		while (true) {
			const newlineIndex = this.stdoutBuffer.indexOf("\n");
			if (newlineIndex === -1) break;
			const rawLine = this.stdoutBuffer.slice(0, newlineIndex).replace(/\r$/, "").trim();
			this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
			if (!rawLine) continue;
			this.handleMessageLine(rawLine);
		}
	}

	private handleMessageLine(rawLine: string): void {
		let msg: Record<string, unknown>;
		try {
			const parsed = JSON.parse(rawLine);
			if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
			msg = parsed as Record<string, unknown>;
		} catch {
			return;
		}

		const hasId = msg.id !== undefined && msg.id !== null;
		const method = typeof msg.method === "string" ? msg.method : "";

		if (hasId && !method) {
			const entry = this.removePending(String(msg.id));
			if (!entry) return;
			if (msg.error && typeof msg.error === "object") {
				const errObj = msg.error as { code?: unknown; message?: unknown; data?: unknown };
				entry.reject(
					new RpcProtocolError(
						typeof errObj.message === "string" ? errObj.message : "RPC 请求失败",
						{
							code: typeof errObj.code === "number" ? errObj.code : undefined,
							data: errObj.data,
							stage: "fetch",
						}
					)
				);
			} else {
				entry.resolve(msg.result);
			}
			return;
		}

		if (hasId && method) {
			void this.handleIncomingRequest(msg.id as string | number, method, msg.params);
			return;
		}

		if (method) {
			try {
				this.options.onNotification?.(method, msg.params);
			} catch {}
		}
	}

	private async handleIncomingRequest(id: string | number, method: string, params: unknown): Promise<void> {
		if (!this.options.onRequest) {
			this.sendErrorResponse(id, -32601, `Method not allowed: ${method}`);
			return;
		}
		try {
			const result = await this.options.onRequest(id, method, params);
			if (this.disposed || this.closed) return;
			const payload: Record<string, unknown> = { id, result: result ?? null };
			if (this.options.includeJsonRpcHeader !== false) payload.jsonrpc = "2.0";
			this.writeLine(payload);
		} catch (err) {
			if (this.disposed || this.closed) return;
			const code = err instanceof RpcProtocolError && err.code != null ? err.code : -32000;
			const message = err instanceof Error ? err.message : String(err);
			this.sendErrorResponse(id, code, message);
		}
	}

	private sendErrorResponse(id: string | number, code: number, message: string): void {
		if (this.disposed || this.closed) return;
		const payload: Record<string, unknown> = { id, error: { code, message } };
		if (this.options.includeJsonRpcHeader !== false) payload.jsonrpc = "2.0";
		try {
			this.writeLine(payload);
		} catch {}
	}

	private handleProcessClosed(code: number | null, signal: string | null, err?: Error): void {
		if (this.closed) return;
		this.closed = true;
		const exitError =
			err ??
			stagedError(
				"fetch",
				`本地 CLI 会话进程退出 (code=${code ?? "null"}, signal=${signal ?? "null"})${this.stderrTail ? `: ${this.stderrTail.slice(-400).trim()}` : ""}`
			);
		this.failAllPending(exitError);
		this.child = null;
		try {
			this.options.onExit?.({
				code,
				signal,
				stderr: this.stderrTail,
				error: exitError,
			});
		} catch {}
	}

	private removePending(key: string): PendingRequest | undefined {
		const entry = this.pending.get(key);
		if (!entry) return undefined;
		this.pending.delete(key);
		if (entry.timer) clearTimeout(entry.timer);
		if (entry.signal && entry.onAbort) {
			entry.signal.removeEventListener("abort", entry.onAbort);
		}
		return entry;
	}

	private failAllPending(error: Error): void {
		for (const key of Array.from(this.pending.keys())) {
			const entry = this.removePending(key);
			entry?.reject(error);
		}
	}

	private mapSpawnFailure(error: unknown): Error {
		const err = error as { stage?: "config" | "fetch" | "parse"; code?: string; message?: string };
		if (err?.stage) return error as Error;
		if (err?.code === "ENOENT") {
			return stagedError("config", `未找到 CLI 命令: ${this.options.command}`);
		}
		return stagedError("fetch", `启动 CLI 会话失败: ${err?.message || String(error)}`);
	}

	private buildClosedError(fallback: string): Error {
		return this.spawnError ?? stagedError("fetch", fallback);
	}
}

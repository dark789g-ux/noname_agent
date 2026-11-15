import { spawn, type ChildProcessByStdio } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Readable, Writable } from "node:stream";
import { buildSpawnSpec, resolveCommandTarget, type SpawnSpec } from "./cli-command.js";
import { extractAgyEventUpdate, recoverAgyNdjsonResult } from "./agy-stream.js";

export type CliProvider = "agy" | "codex";
export type CliThinkingEffort = "default" | "none" | "low" | "medium" | "high";

export interface CliRunOptions {
	provider: CliProvider;
	command: string;
	model?: string;
	thinkingEffort?: CliThinkingEffort;
	extraArgs?: string;
	timeoutSec: number;
	prompt: string;
	jsonSchema: Record<string, unknown>;
	stream: boolean;
	signal?: AbortSignal;
	onFirstChunk?: () => void;
	onFirstToken?: () => void;
	onChunk?: (previewText: string) => void;
}

export interface CliRunResult {
	rawOutput: unknown;
	reasoningContent?: string;
}

const AGY_HEADLESS_INSTRUCTION = "【无头执行约束】请严格仅依据以下牌局信息与可用工具定义，直接返回符合 JSON Schema 的唯一决策 JSON，禁止读取文件、检索目录或执行任何终端命令。";

/** 将用户填写的附加 CLI 参数拆分为独立参数数组，不经过 shell 展开。 */
export function splitCliArgs(input?: string): string[] {
	const text = (input || "").trim();
	if (!text) return [];
	const args: string[] = [];
	let current = "";
	let quote: "'" | '"' | null = null;
	let hasToken = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (quote) {
			if (ch === "\\" && quote === '"' && i + 1 < text.length && ['"', "\\"].includes(text[i + 1])) {
				current += text[++i];
			} else if (ch === quote) {
				quote = null;
			} else {
				current += ch;
			}
			continue;
		}
		if (ch === '"' || ch === "'") {
			quote = ch;
			hasToken = true;
			continue;
		}
		if (/\s/.test(ch)) {
			if (hasToken) {
				args.push(current);
				current = "";
				hasToken = false;
			}
			continue;
		}
		current += ch;
		hasToken = true;
	}
	if (hasToken) args.push(current);
	return args;
}

/** 在空临时目录沙箱中以非交互方式执行 agy / codex CLI。 */
export async function runCliDecision(options: CliRunOptions): Promise<CliRunResult> {
	if (options.signal?.aborted) {
		throw stagedError("fetch", "LLM stream request was aborted");
	}
	const target = resolveCommandTarget(options.command);
	const sandboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "noname-llm-cli-"));
	const schemaPath = path.join(sandboxDir, "schema.json");
	const outPath = path.join(sandboxDir, "last-message.json");
	await fs.writeFile(schemaPath, JSON.stringify(options.jsonSchema, null, 2), "utf8");

	try {
		const cliArgs = buildProviderArgs(options, schemaPath, outPath);
		const spawnSpec = buildSpawnSpec(target, cliArgs);
		return await executeCliProcess(spawnSpec, sandboxDir, outPath, options);
	} finally {
		await fs.rm(sandboxDir, { recursive: true, force: true }).catch(() => {});
	}
}

function buildProviderArgs(options: CliRunOptions, schemaPath: string, outPath: string): string[] {
	const model = options.model?.trim() || "";
	const effort = options.thinkingEffort || "default";
	const extra = splitCliArgs(options.extraArgs);
	if (options.provider === "agy") {
		const args = ["--disable-slash-commands", "--output-format", options.stream ? "stream-json" : "json", "--json-schema", schemaPath];
		if (model) args.push("--model", model);
		return [...args, ...extra];
	}
	const args = ["exec", "-", "--skip-git-repo-check", "--sandbox", "read-only", "--ephemeral", "--output-schema", schemaPath, "-o", outPath];
	if (options.stream) args.push("--json");
	if (model) args.push("-m", model);
	if (effort === "none") args.push("-c", "model_reasoning_effort='minimal'");
	else if (effort === "low" || effort === "medium" || effort === "high") args.push("-c", `model_reasoning_effort='${effort}'`);
	return [...args, ...extra];
}

function buildStdinPrompt(options: CliRunOptions): string {
	if (options.provider === "agy") {
		return `${AGY_HEADLESS_INSTRUCTION}\n\n${options.prompt}`;
	}
	return options.prompt;
}

async function executeCliProcess(spec: SpawnSpec, cwd: string, outPath: string, options: CliRunOptions): Promise<CliRunResult> {
	return new Promise<CliRunResult>((resolve, reject) => {
		let child: ChildProcessByStdio<Writable, Readable, Readable>;
		try {
			child = spawn(spec.file, spec.args, {
				cwd,
				shell: false,
				detached: spec.useDetachedGroup,
				windowsHide: true,
				windowsVerbatimArguments: spec.windowsVerbatimArguments,
				stdio: ["pipe", "pipe", "pipe"],
			});
		} catch (error: any) {
			reject(mapSpawnError(error, options.command));
			return;
		}

		let settled = false;
		let timedOut = false;
		let aborted = false;
		let stdoutAll = "";
		let stderrAll = "";
		let lineBuffer = "";
		let reasoningBuffer = "";
		let messageBuffer = "";
		let structuredOutput: unknown;
		let hasStructuredOutput = false;
		let agyResultError = "";
		let firstChunkSent = false;
		let firstTokenSent = false;

		const emitFirstChunk = () => {
			if (firstChunkSent) return;
			firstChunkSent = true;
			safeCall(() => options.onFirstChunk?.());
		};
		const emitFirstToken = () => {
			emitFirstChunk();
			if (firstTokenSent) return;
			firstTokenSent = true;
			safeCall(() => options.onFirstToken?.());
		};
		const emitPreview = () => {
			if (!reasoningBuffer && !messageBuffer) return;
			const preview = reasoningBuffer && messageBuffer ? `${reasoningBuffer}\n\n[tool_call]\n${messageBuffer}` : reasoningBuffer || messageBuffer;
			safeCall(() => options.onChunk?.(preview));
		};

		const handleStreamLine = (line: string) => {
			const trimmed = line.trim();
			if (!trimmed) return;
			emitFirstChunk();
			let parsed: any;
			try {
				parsed = JSON.parse(trimmed);
			} catch {
				return;
			}
			if (options.provider === "codex") {
				const item = parsed?.item;
				if (item && typeof item === "object") {
					if (item.type === "reasoning" && typeof item.text === "string" && item.text) {
						reasoningBuffer = appendStreamSegment(reasoningBuffer, item.text);
						emitFirstToken();
						emitPreview();
					} else if (item.type === "agent_message" && typeof item.text === "string" && item.text) {
						messageBuffer = item.text;
						emitFirstToken();
						emitPreview();
					}
				} else if (typeof parsed?.delta === "string" && parsed.delta) {
					if (String(parsed?.type || "").includes("reasoning")) reasoningBuffer += parsed.delta;
					else messageBuffer += parsed.delta;
					emitFirstToken();
					emitPreview();
				}
				return;
			}
			const agyUpdate = extractAgyEventUpdate(parsed);
			if (agyUpdate.error) agyResultError = agyUpdate.error;
			if (agyUpdate.reasoning) {
				reasoningBuffer = appendStreamSegment(reasoningBuffer, agyUpdate.reasoning, agyUpdate.reasoningIsDelta);
				emitFirstToken();
				emitPreview();
			}
			if (agyUpdate.hasStructured) {
				structuredOutput = agyUpdate.structured;
				hasStructuredOutput = true;
				messageBuffer = typeof agyUpdate.structured === "string" ? agyUpdate.structured : JSON.stringify(agyUpdate.structured);
				emitFirstToken();
				emitPreview();
			} else if (agyUpdate.text) {
				messageBuffer = agyUpdate.textIsDelta ? messageBuffer + agyUpdate.text : agyUpdate.text;
				emitFirstToken();
				emitPreview();
			}
		};

		const onAbort = () => {
			aborted = true;
			terminateChildTree(child);
		};
		const timeoutMs = Math.max(1, Number(options.timeoutSec) || 30) * 1000;
		const timer = setTimeout(() => {
			timedOut = true;
			terminateChildTree(child);
		}, timeoutMs);
		options.signal?.addEventListener("abort", onAbort, { once: true });

		const cleanup = () => {
			clearTimeout(timer);
			options.signal?.removeEventListener("abort", onAbort);
		};

		child.on("error", error => {
			if (settled) return;
			settled = true;
			cleanup();
			reject(mapSpawnError(error, options.command));
		});

		child.stdout.setEncoding("utf8");
		child.stdout.on("data", (chunk: string) => {
			stdoutAll += chunk;
			if (!options.stream) return;
			lineBuffer += chunk;
			const lines = lineBuffer.split(/\r?\n/);
			lineBuffer = lines.pop() ?? "";
			for (const line of lines) handleStreamLine(line);
		});

		child.stderr.setEncoding("utf8");
		child.stderr.on("data", (chunk: string) => {
			stderrAll += chunk;
		});

		child.on("close", async code => {
			if (settled) return;
			settled = true;
			cleanup();
			if (options.stream && lineBuffer.trim()) handleStreamLine(lineBuffer);
			if (timedOut) {
				reject(stagedError("fetch", "LLM request timed out"));
				return;
			}
			if (aborted || options.signal?.aborted) {
				reject(stagedError("fetch", "LLM stream request was aborted"));
				return;
			}
			if (code !== 0) {
				const detail = stderrAll.trim() || stdoutAll.trim();
				reject(stagedError("fetch", `CLI (${options.provider}) exited with code ${code}: ${detail.slice(0, 240)}`));
				return;
			}
			try {
				const finalResult = await collectFinalResult(
					options,
					outPath,
					stdoutAll,
					messageBuffer,
					reasoningBuffer,
					hasStructuredOutput ? structuredOutput : undefined,
					agyResultError
				);
				resolve(finalResult);
			} catch (err: any) {
				reject(err);
			}
		});

		child.stdin.on("error", () => {});
		child.stdin.write(buildStdinPrompt(options), "utf8");
		child.stdin.end();
	});
}

async function collectFinalResult(
	options: CliRunOptions,
	outPath: string,
	stdoutAll: string,
	messageBuffer: string,
	reasoningBuffer: string,
	structuredOutput: unknown,
	agyResultError = ""
): Promise<CliRunResult> {
	if (options.provider === "codex") {
		let fileContent = "";
		try {
			fileContent = (await fs.readFile(outPath, "utf8")).trim();
		} catch {}
		const rawOutput = fileContent || messageBuffer.trim() || stdoutAll.trim();
		if (!rawOutput) throw stagedError("parse", "codex CLI 未返回任何输出");
		return {
			rawOutput,
			...(reasoningBuffer ? { reasoningContent: reasoningBuffer } : {}),
		};
	}
	if (structuredOutput !== undefined) {
		return {
			rawOutput: structuredOutput,
			...(reasoningBuffer ? { reasoningContent: reasoningBuffer } : {}),
		};
	}
	if (agyResultError) {
		throw stagedError("fetch", `agy CLI 返回错误: ${agyResultError}`);
	}
	const trimmedStdout = stdoutAll.trim();
	if (!options.stream && trimmedStdout) {
		try {
			const parsed = JSON.parse(trimmedStdout);
			const agy = extractAgyEventUpdate(parsed);
			if (agy.error) throw stagedError("fetch", `agy CLI 返回错误: ${agy.error}`);
			const reasoning = agy.reasoning || reasoningBuffer;
			return {
				rawOutput: agy.hasStructured ? agy.structured : agy.text || parsed,
				...(reasoning ? { reasoningContent: reasoning } : {}),
			};
		} catch (err: any) {
			if (err?.stage) throw err;
			return {
				rawOutput: trimmedStdout,
				...(reasoningBuffer ? { reasoningContent: reasoningBuffer } : {}),
			};
		}
	}
	if (options.stream && trimmedStdout) {
		const recovered = recoverAgyNdjsonResult(trimmedStdout, reasoningBuffer);
		if (recovered) return recovered;
	}
	const fallback = messageBuffer.trim() || trimmedStdout;
	if (!fallback) throw stagedError("parse", "agy CLI 未返回任何输出");
	return {
		rawOutput: fallback,
		...(reasoningBuffer ? { reasoningContent: reasoningBuffer } : {}),
	};
}

function appendStreamSegment(existing: string, next: string, isDelta = false): string {
	if (!next) return existing;
	if (isDelta) return existing + next;
	if (!existing) return next;
	if (next.startsWith(existing)) return next;
	return `${existing}\n${next}`;
}

function terminateChildTree(child: ChildProcessByStdio<Writable, Readable, Readable>): void {
	const pid = child.pid;
	if (!pid) return;
	if (process.platform === "win32") {
		try {
			const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { shell: false, windowsHide: true, stdio: "ignore" });
			killer.unref();
		} catch {
			try {
				child.kill("SIGKILL");
			} catch {}
		}
		return;
	}
	try {
		process.kill(-pid, "SIGKILL");
	} catch {
		try {
			child.kill("SIGKILL");
		} catch {}
	}
}

function mapSpawnError(error: any, command: string): Error {
	if (error?.stage) return error;
	if (error?.code === "ENOENT") return stagedError("config", `未找到 CLI 命令: ${command}`);
	return stagedError("fetch", `启动 CLI 失败: ${error?.message || String(error)}`);
}

function stagedError(stage: "config" | "fetch" | "parse", message: string): Error {
	return Object.assign(new Error(message), { stage });
}

function safeCall(fn: () => void): void {
	try {
		fn();
	} catch {}
}

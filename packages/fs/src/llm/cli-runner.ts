import { spawn, type ChildProcessByStdio } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Readable, Writable } from "node:stream";

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

interface CommandTarget {
	kind: "node-script" | "cmd" | "exe";
	resolved: string;
}

interface SpawnSpec {
	file: string;
	args: string[];
	useDetachedGroup: boolean;
	windowsVerbatimArguments: boolean;
}

const AGY_HEADLESS_INSTRUCTION = "请严格根据标准输入（stdin）中的三国杀牌局信息与工具约束，直接返回符合 JSON Schema 的唯一决策 JSON，不要访问任何文件或执行命令。";

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
		const args = ["-p", AGY_HEADLESS_INSTRUCTION, "--mode", "plan", "--output-format", options.stream ? "stream-json" : "json", "--json-schema", schemaPath];
		if (model) args.push("--model", model);
		if (effort === "low" || effort === "medium" || effort === "high") args.push("--effort", effort);
		return [...args, ...extra];
	}
	const args = ["exec", "-", "--skip-git-repo-check", "--sandbox", "read-only", "--ephemeral", "--output-schema", schemaPath, "-o", outPath];
	if (options.stream) args.push("--json");
	if (model) args.push("-m", model);
	if (effort === "none") args.push("-c", "model_reasoning_effort='minimal'");
	else if (effort === "low" || effort === "medium" || effort === "high") args.push("-c", `model_reasoning_effort='${effort}'`);
	return [...args, ...extra];
}

function resolveCommandTarget(command: string): CommandTarget {
	const trimmed = String(command || "").trim();
	if (!trimmed) throw stagedError("config", "CLI 命令不能为空");
	if (/\.(mjs|cjs|js)$/i.test(trimmed)) return { kind: "node-script", resolved: trimmed };
	if (process.platform !== "win32") return { kind: "exe", resolved: trimmed };

	const resolved = findWindowsExecutable(trimmed);
	const lower = resolved.toLowerCase();
	if (lower.endsWith(".cmd") || lower.endsWith(".bat")) return { kind: "cmd", resolved };
	return { kind: "exe", resolved };
}

function findWindowsExecutable(command: string): string {
	const pathExts = (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD")
		.split(";")
		.map(ext => ext.trim())
		.filter(Boolean);
	const hasExt = /\.[a-z0-9]+$/i.test(path.basename(command));
	const probeExts = hasExt ? [""] : [...pathExts, ""];
	const dirs = /[\\/:]/.test(command)
		? [""]
		: (process.env.PATH || "")
				.split(path.delimiter)
				.map(dir => dir.trim())
				.filter(Boolean);

	for (const dir of dirs) {
		const base = dir ? path.join(dir, command) : command;
		for (const ext of probeExts) {
			const candidate = ext ? `${base}${ext}` : base;
			if (existsSync(candidate)) return candidate;
		}
	}
	return command;
}

function buildSpawnSpec(target: CommandTarget, cliArgs: string[]): SpawnSpec {
	if (target.kind === "node-script") {
		return { file: process.execPath, args: [target.resolved, ...cliArgs], useDetachedGroup: process.platform !== "win32", windowsVerbatimArguments: false };
	}
	if (target.kind === "cmd") {
		const comspec = process.env.ComSpec || "cmd.exe";
		const commandLine = `"${[target.resolved, ...cliArgs].map(quoteCmdArg).join(" ")}"`;
		return { file: comspec, args: ["/d", "/s", "/c", commandLine], useDetachedGroup: false, windowsVerbatimArguments: true };
	}
	return { file: target.resolved, args: cliArgs, useDetachedGroup: process.platform !== "win32", windowsVerbatimArguments: false };
}

function quoteCmdArg(arg: string): string {
	if (arg === "") return '""';
	if (!/[\s"&|<>()^%!]/.test(arg)) return arg;
	return `"${arg.replace(/"/g, "")}"`;
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
				const finalResult = await collectFinalResult(options, outPath, stdoutAll, messageBuffer, reasoningBuffer, hasStructuredOutput ? structuredOutput : undefined);
				resolve(finalResult);
			} catch (err: any) {
				reject(err);
			}
		});

		child.stdin.on("error", () => {});
		child.stdin.write(options.prompt, "utf8");
		child.stdin.end();
	});
}

async function collectFinalResult(
	options: CliRunOptions,
	outPath: string,
	stdoutAll: string,
	messageBuffer: string,
	reasoningBuffer: string,
	structuredOutput: unknown
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
	const trimmedStdout = stdoutAll.trim();
	if (!options.stream && trimmedStdout) {
		try {
			const parsed = JSON.parse(trimmedStdout);
			const agy = extractAgyEventUpdate(parsed);
			const reasoning = agy.reasoning || reasoningBuffer;
			return {
				rawOutput: agy.hasStructured ? agy.structured : parsed,
				...(reasoning ? { reasoningContent: reasoning } : {}),
			};
		} catch {
			return {
				rawOutput: trimmedStdout,
				...(reasoningBuffer ? { reasoningContent: reasoningBuffer } : {}),
			};
		}
	}
	const fallback = messageBuffer.trim() || trimmedStdout;
	if (!fallback) throw stagedError("parse", "agy CLI 未返回任何输出");
	return {
		rawOutput: fallback,
		...(reasoningBuffer ? { reasoningContent: reasoningBuffer } : {}),
	};
}

function extractAgyEventUpdate(event: any): {
	reasoning: string;
	reasoningIsDelta: boolean;
	text: string;
	textIsDelta: boolean;
	hasStructured: boolean;
	structured: unknown;
} {
	if (!event || typeof event !== "object") {
		return { reasoning: "", reasoningIsDelta: false, text: "", textIsDelta: false, hasStructured: false, structured: undefined };
	}
	let reasoning = "";
	let reasoningIsDelta = false;
	if (typeof event.thinking === "string") reasoning = event.thinking;
	else if (typeof event.reasoning_content === "string") reasoning = event.reasoning_content;
	else if (typeof event.reasoning === "string") reasoning = event.reasoning;
	else if (typeof event.step?.thinking === "string") reasoning = event.step.thinking;
	else if (event.item?.type === "reasoning" && typeof event.item?.text === "string") reasoning = event.item.text;
	else if (typeof event.delta?.thinking === "string") {
		reasoning = event.delta.thinking;
		reasoningIsDelta = true;
	} else if (typeof event.delta?.reasoning_content === "string") {
		reasoning = event.delta.reasoning_content;
		reasoningIsDelta = true;
	}

	if (event.structured_output !== undefined) {
		return { reasoning, reasoningIsDelta, text: "", textIsDelta: false, hasStructured: true, structured: event.structured_output };
	}
	if (event.type === "result" && event.result !== undefined) {
		return { reasoning, reasoningIsDelta, text: "", textIsDelta: false, hasStructured: true, structured: event.result };
	}
	let text = "";
	let textIsDelta = false;
	if (typeof event.result === "string") text = event.result;
	else if (typeof event.response === "string") text = event.response;
	else if (typeof event.content === "string") text = event.content;
	else if (typeof event.message?.content === "string") text = event.message.content;
	else if (typeof event.delta?.text === "string") {
		text = event.delta.text;
		textIsDelta = true;
	} else if (typeof event.delta?.content === "string") {
		text = event.delta.content;
		textIsDelta = true;
	}
	return { reasoning, reasoningIsDelta, text, textIsDelta, hasStructured: false, structured: undefined };
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

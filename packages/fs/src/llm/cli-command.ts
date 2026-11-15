import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export type CliProviderKind = "agy" | "codex";

export interface CommandTarget {
	kind: "node-script" | "cmd" | "exe";
	resolved: string;
}

export interface SpawnSpec {
	file: string;
	args: string[];
	useDetachedGroup: boolean;
	windowsVerbatimArguments: boolean;
}

export interface ResolveCommandEnv {
	platform?: NodeJS.Platform;
	pathEnv?: string;
	pathExtEnv?: string;
	homeDir?: string;
	appDataDir?: string;
}

function readCodexConfiguredPath(homeDir: string): string | null {
	if (!homeDir) return null;
	const configPath = path.join(homeDir, ".codex", "config.toml");
	if (!existsSync(configPath)) return null;
	try {
		const raw = readFileSync(configPath, "utf8");
		const match = raw.match(/^\s*CODEX_CLI_PATH\s*=\s*(['"])(.+?)\1/m);
		const candidate = match?.[2]?.trim();
		if (candidate && existsSync(candidate)) return candidate;
	} catch {}
	return null;
}

function defaultFallbackDirs(provider: string, homeDir: string, appDataDir: string): string[] {
	if (provider === "agy") {
		return [
			path.join(homeDir, ".gemini", "bin"),
			path.join(homeDir, ".gemini", "antigravity", "bin"),
		];
	}
	if (provider === "codex") {
		const dirs = [
			path.join(homeDir, ".codex", ".sandbox-bin"),
			path.join(homeDir, ".local", "bin"),
		];
		if (appDataDir) dirs.push(path.join(appDataDir, "npm"));
		return dirs;
	}
	return [];
}

function findExecutableInDirs(command: string, dirs: string[], probeExts: string[]): string | null {
	for (const dir of dirs) {
		const base = dir ? path.join(dir, command) : command;
		for (const ext of probeExts) {
			const candidate = ext ? `${base}${ext}` : base;
			if (existsSync(candidate)) return candidate;
		}
	}
	return null;
}

function classifyExecutable(resolved: string): CommandTarget {
	const lower = resolved.toLowerCase();
	if (lower.endsWith(".cmd") || lower.endsWith(".bat")) return { kind: "cmd", resolved };
	return { kind: "exe", resolved };
}

/** 解析 CLI 命令路径：优先匹配 PATH，未命中时回退本机常见安装目录。 */
export function resolveCommandTarget(command: string, env: ResolveCommandEnv = {}): CommandTarget {
	const trimmed = String(command || "").trim();
	if (!trimmed) {
		const err = new Error("CLI 命令不能为空") as Error & { stage?: string };
		err.stage = "config";
		throw err;
	}
	if (/\.(mjs|cjs|js)$/i.test(trimmed)) return { kind: "node-script", resolved: trimmed };

	const platform = env.platform ?? process.platform;
	const hasPathSep = /[\\/:]/.test(trimmed);
	const pathEnv = env.pathEnv ?? (process.env.PATH || "");
	const pathDirs = hasPathSep
		? [""]
		: pathEnv
				.split(path.delimiter)
				.map(dir => dir.trim())
				.filter(Boolean);

	const homeDir = env.homeDir ?? os.homedir();
	const appDataDir = env.appDataDir ?? (process.env.APPDATA || (homeDir ? path.join(homeDir, "AppData", "Roaming") : ""));
	const lowerCmd = trimmed.toLowerCase();
	const fallbackDirs = hasPathSep ? [] : defaultFallbackDirs(lowerCmd, homeDir, appDataDir);
	const probeExts = platform === "win32"
		? (() => {
			const exts = (env.pathExtEnv ?? (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD"))
				.split(";")
				.map(ext => ext.trim())
				.filter(Boolean);
			const hasExt = /\.[a-z0-9]+$/i.test(path.basename(trimmed));
			return hasExt ? [""] : [...exts, ""];
		})()
		: [""];

	const pathMatch = findExecutableInDirs(trimmed, pathDirs, probeExts);
	if (pathMatch) return classifyExecutable(pathMatch);

	if (!hasPathSep && lowerCmd === "codex") {
		const configuredCodex = readCodexConfiguredPath(homeDir);
		if (configuredCodex) return classifyExecutable(configuredCodex);
	}

	const fallbackMatch = findExecutableInDirs(trimmed, fallbackDirs, probeExts);
	return classifyExecutable(fallbackMatch ?? trimmed);
}

function quoteCmdArg(arg: string): string {
	if (arg === "") return '""';
	if (!/[\s"&|<>()^%!]/.test(arg)) return arg;
	return `"${arg.replace(/"/g, "")}"`;
}

export function buildSpawnSpec(target: CommandTarget, cliArgs: string[]): SpawnSpec {
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

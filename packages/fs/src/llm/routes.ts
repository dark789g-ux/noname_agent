import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { runCliDecision, type CliProvider, type CliThinkingEffort } from "./cli-runner";

interface CliRouteBody {
	provider?: unknown;
	command?: unknown;
	model?: unknown;
	thinkingEffort?: unknown;
	extraArgs?: unknown;
	timeoutSec?: unknown;
	prompt?: unknown;
	jsonSchema?: unknown;
	stream?: unknown;
}

export function isLoopbackIp(ip?: string): boolean {
	if (!ip) return false;
	const normalized = ip.trim().toLowerCase();
	return normalized === "127.0.0.1" || normalized.startsWith("127.") || normalized === "::1" || normalized.startsWith("::ffff:127.");
}

export function isAllowedLocalOrigin(origin?: string): boolean {
	if (!origin) return true;
	try {
		const hostname = new URL(origin).hostname.toLowerCase();
		return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname);
	} catch {
		return false;
	}
}

function validateAccess(request: FastifyRequest, reply: FastifyReply): boolean {
	const clientIp = request.ip || request.raw.socket?.remoteAddress;
	if (!isLoopbackIp(clientIp)) {
		reply.code(403).send({ ok: false, stage: "config", message: "仅允许本机回环地址调用本地 CLI 桥接服务" });
		return false;
	}
	if (!isAllowedLocalOrigin(request.headers.origin)) {
		reply.code(403).send({ ok: false, stage: "config", message: "仅允许本机游戏页面调用本地 CLI 桥接服务" });
		return false;
	}
	return true;
}

function parseProvider(value: unknown): CliProvider | null {
	return value === "agy" || value === "codex" ? value : null;
}

function parseThinkingEffort(value: unknown): CliThinkingEffort {
	if (value === "none" || value === "low" || value === "medium" || value === "high") return value;
	return "default";
}

function sendSseEvent(reply: FastifyReply, payload: Record<string, unknown>): void {
	if (reply.raw.writableEnded || reply.raw.destroyed) return;
	reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function registerLlmCliRoutes(app: FastifyInstance): void {
	app.post("/_llm/cli", { bodyLimit: 4 * 1024 * 1024 }, async (request, reply) => {
		if (!validateAccess(request, reply)) return;

		const body = (request.body || {}) as CliRouteBody;
		const provider = parseProvider(body.provider);
		if (!provider) {
			return reply.code(400).send({ ok: false, stage: "config", message: "无效的 CLI provider，仅支持 agy 或 codex" });
		}
		if (typeof body.prompt !== "string" || !body.prompt.trim()) {
			return reply.code(400).send({ ok: false, stage: "config", message: "CLI prompt 不能为空" });
		}
		const command = typeof body.command === "string" && body.command.trim() ? body.command.trim() : provider;
		const timeoutSec = Math.max(1, Math.min(300, Number(body.timeoutSec) || 60));
		const jsonSchema = body.jsonSchema && typeof body.jsonSchema === "object" && !Array.isArray(body.jsonSchema) ? (body.jsonSchema as Record<string, unknown>) : { type: "object" };
		const stream = body.stream === true;

		const abortController = new AbortController();
		const onDisconnect = () => {
			if (!reply.raw.writableEnded) abortController.abort();
		};
		reply.raw.on("close", onDisconnect);
		request.raw.on("aborted", onDisconnect);
		if (reply.raw.destroyed || request.raw.socket?.destroyed) {
			abortController.abort();
		}

		if (stream) {
			reply.hijack();
			reply.raw.writeHead(200, {
				...reply.getHeaders(),
				"Content-Type": "text/event-stream; charset=utf-8",
				"Cache-Control": "no-cache, no-transform",
				Connection: "keep-alive",
				"X-Accel-Buffering": "no",
			});
			reply.raw.flushHeaders();

			try {
				const result = await runCliDecision({
					provider,
					command,
					model: typeof body.model === "string" ? body.model : "",
					thinkingEffort: parseThinkingEffort(body.thinkingEffort),
					extraArgs: typeof body.extraArgs === "string" ? body.extraArgs : "",
					timeoutSec,
					prompt: body.prompt,
					jsonSchema,
					stream: true,
					signal: abortController.signal,
					onFirstChunk: () => sendSseEvent(reply, { type: "first_chunk" }),
					onFirstToken: () => sendSseEvent(reply, { type: "first_token" }),
					onChunk: text => sendSseEvent(reply, { type: "chunk", text }),
				});
				sendSseEvent(reply, { type: "result", ...result });
			} catch (error: any) {
				sendSseEvent(reply, {
					type: "error",
					stage: typeof error?.stage === "string" ? error.stage : "fetch",
					message: error?.message || String(error),
				});
			} finally {
				reply.raw.removeListener("close", onDisconnect);
				request.raw.removeListener("aborted", onDisconnect);
				if (!reply.raw.writableEnded) reply.raw.end();
			}
			return;
		}

		try {
			const result = await runCliDecision({
				provider,
				command,
				model: typeof body.model === "string" ? body.model : "",
				thinkingEffort: parseThinkingEffort(body.thinkingEffort),
				extraArgs: typeof body.extraArgs === "string" ? body.extraArgs : "",
				timeoutSec,
				prompt: body.prompt,
				jsonSchema,
				stream: false,
				signal: abortController.signal,
			});
			return { ok: true, ...result };
		} catch (error: any) {
			return {
				ok: false,
				stage: typeof error?.stage === "string" ? error.stage : "fetch",
				message: error?.message || String(error),
			};
		} finally {
			reply.raw.removeListener("close", onDisconnect);
			request.raw.removeListener("aborted", onDisconnect);
		}
	});
}

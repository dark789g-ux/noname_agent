import type { FastifyInstance } from "fastify";
import { parseProvider, parseThinkingEffort, sendSseEvent, validateAccess } from "./routes.js";
import type { LlmSessionHost } from "./session-host.js";

interface SessionTurnRequestBody {
	sessionKey?: unknown;
	gameId?: unknown;
	seatNum?: unknown;
	provider?: unknown;
	command?: unknown;
	model?: unknown;
	thinkingEffort?: unknown;
	extraArgs?: unknown;
	timeoutSec?: unknown;
	reset?: unknown;
	prompt?: unknown;
	jsonSchema?: unknown;
}

interface ResetGameRequestBody {
	gameId?: unknown;
}

export function registerLlmSessionRoutes(app: FastifyInstance, host: LlmSessionHost): void {
	app.post<{ Body: SessionTurnRequestBody }>("/_llm/session/turn", async (request, reply) => {
		if (!validateAccess(request, reply)) return;
		const body = request.body || {};
		const sessionKey = typeof body.sessionKey === "string" ? body.sessionKey.trim() : "";
		const provider = parseProvider(body.provider);
		const prompt = typeof body.prompt === "string" ? body.prompt : "";
		const jsonSchema =
			body.jsonSchema && typeof body.jsonSchema === "object" && !Array.isArray(body.jsonSchema)
				? (body.jsonSchema as Record<string, unknown>)
				: null;

		if (!sessionKey || !provider || !prompt.trim() || !jsonSchema) {
			return reply.code(400).send({
				ok: false,
				stage: "config",
				message: "缺少 sessionKey、provider、prompt 或 jsonSchema",
			});
		}

		const timeoutRaw = typeof body.timeoutSec === "number" ? body.timeoutSec : Number(body.timeoutSec || 60);
		const timeoutSec = Number.isFinite(timeoutRaw) ? Math.max(5, Math.min(300, Math.round(timeoutRaw))) : 60;
		const command = typeof body.command === "string" && body.command.trim() ? body.command.trim() : provider;

		reply.hijack();
		reply.raw.writeHead(200, {
			"Content-Type": "text/event-stream; charset=utf-8",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
		});

		const controller = new AbortController();
		const abortIfClosed = () => {
			if (!reply.raw.writableEnded) controller.abort();
		};
		request.raw.on("aborted", abortIfClosed);
		reply.raw.on("close", abortIfClosed);

		try {
			const result = await host.runTurn(
				{
					sessionKey,
					gameId: typeof body.gameId === "string" ? body.gameId : undefined,
					seatNum: typeof body.seatNum === "number" ? body.seatNum : undefined,
					provider,
					command,
					model: typeof body.model === "string" ? body.model : "",
					thinkingEffort: parseThinkingEffort(body.thinkingEffort),
					extraArgs: typeof body.extraArgs === "string" ? body.extraArgs : "",
					timeoutSec,
					reset: Boolean(body.reset),
					prompt,
					jsonSchema,
				},
				{
					signal: controller.signal,
					onFirstChunk: () => sendSseEvent(reply, { type: "first_chunk" }),
					onFirstToken: () => sendSseEvent(reply, { type: "first_token" }),
					onThoughtDelta: delta => sendSseEvent(reply, { type: "thought_delta", delta }),
					onThoughtSnapshot: text => sendSseEvent(reply, { type: "thought_snapshot", text }),
					onTextDelta: delta => sendSseEvent(reply, { type: "text_delta", delta }),
					onUsage: usage => sendSseEvent(reply, { type: "usage", usage }),
					onSessionInfo: info => sendSseEvent(reply, { type: "session_info", ...info }),
				}
			);
			if (!controller.signal.aborted && !reply.raw.writableEnded) {
				sendSseEvent(reply, {
					type: "result",
					rawOutput: result.rawOutput,
					reasoningContent: result.reasoningContent,
					usage: result.usage,
				});
			}
		} catch (error: any) {
			if (!controller.signal.aborted && !reply.raw.writableEnded) {
				sendSseEvent(reply, {
					type: "error",
					stage: error?.stage || "fetch",
					code: error?.code,
					message: error?.message || String(error),
				});
			}
		} finally {
			request.raw.off("aborted", abortIfClosed);
			reply.raw.off("close", abortIfClosed);
			if (!reply.raw.writableEnded) reply.raw.end();
		}
	});

	app.delete<{ Params: { key: string } }>("/_llm/session/:key", async (request, reply) => {
		if (!validateAccess(request, reply)) return;
		const key = decodeURIComponent(request.params.key || "");
		const deleted = key ? host.deleteSession(key) : false;
		return { ok: true, deleted };
	});

	app.post<{ Body: ResetGameRequestBody }>("/_llm/session/reset-game", async (request, reply) => {
		if (!validateAccess(request, reply)) return;
		const gameId = typeof request.body?.gameId === "string" ? request.body.gameId.trim() : "";
		const removed = host.resetGame(gameId || undefined);
		return { ok: true, removed };
	});
}

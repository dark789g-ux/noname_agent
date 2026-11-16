import { callLLMStream, callLLMWithTimeout, type StreamCallbacks, type ToolCallResult } from "../../client.js";
import type { LLMConfig } from "../../index.js";
import type { StreamUsage } from "../../logger-types.js";
import { remainingTimeoutSec } from "../../protocol.js";
import type { SeatTransport, TransportCallbacks, TransportTurnInput, TransportTurnResult } from "../types.js";

function toLLMConfig(input: TransportTurnInput): LLMConfig {
	const b = input.backend;
	return {
		enabled: true,
		controlSelf: false,
		url: b.url || "",
		apikey: b.apikey || "",
		model: b.model || "",
		thinkingEffort: (b.thinkingEffort as LLMConfig["thinkingEffort"]) || "medium",
		maxRetries: b.maxRetries || 0,
		timeoutSec: remainingTimeoutSec(b.timeoutSec || 30, input.deadline),
		multiTurn: true,
		maxTurns: 4,
		decisionTimeoutSec: 60,
		defaultBackend: "openai",
		openaiDisplayName: b.label || "",
		openaiContextSize: b.contextSize ?? 128_000,
		agy: { displayName: "agy", command: "agy", model: "", thinkingEffort: "default", timeoutSec: 60, extraArgs: "" },
		codex: { displayName: "codex", command: "codex", model: "", thinkingEffort: "default", timeoutSec: 60, extraArgs: "" },
		seatBackends: {},
	};
}

export class OpenAITransport implements SeatTransport {
	readonly stateful = false;

	async sendTurn(input: TransportTurnInput, callbacks?: TransportCallbacks): Promise<TransportTurnResult> {
		let latestUsage: StreamUsage | undefined;
		const forwardCallbacks: StreamCallbacks = {
			onFirstChunk: () => callbacks?.onFirstChunk?.(),
			onFirstToken: () => callbacks?.onFirstToken?.(),
			onChunk: partial => callbacks?.onChunk?.(partial),
			onStreamProgress: progress => {
				if (progress.usage) latestUsage = progress.usage;
				callbacks?.onStreamProgress?.(progress);
			},
			onUsage: usage => {
				latestUsage = usage;
				callbacks?.onUsage?.(usage);
			},
		};

		let attemptIndex = 0;
		const cfg = toLLMConfig(input);
		if (input.allowStream) {
			callbacks?.onAttemptStart?.(attemptIndex, "stream");
			try {
				const toolCall = await callLLMStream(input.fullTranscript, input.tools, cfg, forwardCallbacks);
				callbacks?.onAttemptFinish?.(attemptIndex, "success");
				return { toolCall, usage: latestUsage, transport: "stream", syncedRemote: false };
			} catch (streamError: any) {
				callbacks?.onAttemptFinish?.(attemptIndex, "error", streamError?.stage);
				if (["parse", "config"].includes(streamError?.stage)) throw streamError;
				attemptIndex++;
			}
		}

		callbacks?.onAttemptStart?.(attemptIndex, "nonstream");
		try {
			const nonstreamCfg = toLLMConfig(input);
			const toolCall: ToolCallResult = await callLLMWithTimeout(input.fullTranscript, input.tools, nonstreamCfg, {
				onUsage: usage => {
					latestUsage = usage;
					callbacks?.onUsage?.(usage);
				},
			});
			callbacks?.onAttemptFinish?.(attemptIndex, "success");
			return { toolCall, usage: latestUsage, transport: "nonstream", syncedRemote: false };
		} catch (error: any) {
			callbacks?.onAttemptFinish?.(attemptIndex, "error", error?.stage);
			throw error;
		}
	}
}

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { lib } from "noname";
import { buildResolvedBackend, resolveSeatBackendKind } from "@/llm/backends.js";
import { llmLogger, type ActiveLogSnapshot, type LogEntry, type StreamProgressPayload } from "@/llm/logger.js";
import { deriveSessionStatusInfo } from "./types.js";

export interface UseLLMSeatTimelineProps {
	playerSeatNum: number;
	gameId: string;
	playerName: string;
}

export function useLLMSeatTimeline(props: UseLLMSeatTimelineProps) {
	const currentCall = ref<LogEntry | null>(null);
	const activeStream = ref<StreamProgressPayload | null>(null);
	const partialArgs = ref("");
	const streamStartedAt = ref<number | null>(null);
	const history = ref<LogEntry[]>([]);
	const elapsedMs = ref(0);
	const liveThinkingMs = ref(0);
	const isLoading = ref(false);
	const isClearing = ref(false);

	const timelineEl = ref<HTMLElement | null>(null);
	const isFollowing = ref(true);
	const hasNewBelow = ref(false);

	let elapsedTimer: number | null = null;
	let historyQueryGeneration = 0;

	const sessionStatus = computed(() => {
		const llmConfig = (lib.config?.llm || {}) as Record<string, any>;
		const resolved = llmConfig.enabled
			? buildResolvedBackend(resolveSeatBackendKind(props.playerSeatNum, llmConfig), llmConfig)
			: undefined;
		return deriveSessionStatusInfo(props.playerName, props.playerSeatNum, currentCall.value, history.value, resolved
			? { backendLabel: resolved.label || resolved.kind, model: resolved.model, configured: resolved.configured }
			: undefined);
	});

	function matchesPlayer(entry: LogEntry): boolean {
		if ((entry.gameId || "game_unknown") !== props.gameId) return false;
		if (entry.playerSeatNum !== undefined) return entry.playerSeatNum === props.playerSeatNum;
		return entry.playerName === props.playerName;
	}

	function mergeHistory(entries: LogEntry[]): void {
		const merged = new Map<string, LogEntry>();
		for (const entry of history.value) merged.set(entry.id, entry);
		for (const entry of entries) merged.set(entry.id, entry);
		history.value = Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp);
	}

	function syncTimers(): void {
		const now = Date.now();
		if (streamStartedAt.value !== null) {
			elapsedMs.value = Math.max(0, now - streamStartedAt.value);
		}
		const stream = activeStream.value;
		if (!stream) {
			liveThinkingMs.value = 0;
			return;
		}
		if (stream.phase === "thinking" && stream.thinkingStartedAt != null) {
			liveThinkingMs.value = Math.max(stream.thinkingMs ?? 0, now - stream.thinkingStartedAt);
		} else {
			liveThinkingMs.value = stream.thinkingMs ?? 0;
		}
	}

	function stopElapsedTimer(): void {
		if (elapsedTimer === null) return;
		window.clearInterval(elapsedTimer);
		elapsedTimer = null;
	}

	function startElapsedTimer(startedAt: number): void {
		stopElapsedTimer();
		streamStartedAt.value = startedAt;
		syncTimers();
		elapsedTimer = window.setInterval(syncTimers, 100);
	}

	async function maybeAutoScroll(notifyIfDetached = true): Promise<void> {
		if (!isFollowing.value) {
			if (notifyIfDetached) hasNewBelow.value = true;
			return;
		}
		await nextTick();
		const el = timelineEl.value;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
		hasNewBelow.value = false;
	}

	function handleScroll(): void {
		const el = timelineEl.value;
		if (!el) return;
		const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		if (distanceToBottom <= 28) {
			isFollowing.value = true;
			hasNewBelow.value = false;
		} else {
			isFollowing.value = false;
		}
	}

	async function scrollToBottom(): Promise<void> {
		isFollowing.value = true;
		hasNewBelow.value = false;
		await nextTick();
		const el = timelineEl.value;
		if (el) el.scrollTop = el.scrollHeight;
	}

	function showActive(snapshot: ActiveLogSnapshot): void {
		currentCall.value = snapshot.entry;
		partialArgs.value = snapshot.partialArgs;
		activeStream.value = snapshot.stream ?? null;
		startElapsedTimer(snapshot.startedAt);
		void maybeAutoScroll(true);
	}

	function clearActive(): void {
		stopElapsedTimer();
		currentCall.value = null;
		activeStream.value = null;
		partialArgs.value = "";
		streamStartedAt.value = null;
		elapsedMs.value = 0;
		liveThinkingMs.value = 0;
	}

	function restoreLatestActive(): void {
		const active = llmLogger.getActiveLogByGameAndPlayer(
			props.gameId,
			props.playerName,
			props.playerSeatNum
		);
		if (active) showActive(active);
		else clearActive();
	}

	const handlers = {
		start(entry: LogEntry) {
			if (!matchesPlayer(entry)) return;
			showActive({ entry, partialArgs: "", startedAt: entry.timestamp });
		},
		stream(payload: StreamProgressPayload) {
			if (!currentCall.value || payload.logId !== currentCall.value.id) return;
			activeStream.value = payload;
			syncTimers();
			void maybeAutoScroll(true);
		},
		chunk(payload: { logId: string; partialArgs: string }) {
			if (!currentCall.value || payload.logId !== currentCall.value.id) return;
			partialArgs.value = payload.partialArgs;
			void maybeAutoScroll(true);
		},
		timing(payload: { logId: string; entry: LogEntry }) {
			if (!currentCall.value || payload.logId !== currentCall.value.id) return;
			currentCall.value = payload.entry;
		},
		end(entry: LogEntry) {
			if (!matchesPlayer(entry)) return;
			mergeHistory([entry]);
			if (!currentCall.value || entry.id === currentCall.value.id) {
				restoreLatestActive();
			}
			void maybeAutoScroll(true);
		},
	};

	async function refresh(): Promise<void> {
		if (isClearing.value) return;
		const generation = ++historyQueryGeneration;
		isLoading.value = true;
		try {
			const logs = await llmLogger.getLogSummariesByGameAndPlayer(
				props.gameId,
				props.playerName,
				props.playerSeatNum
			);
			if (generation !== historyQueryGeneration) return;
			mergeHistory(logs);
			await maybeAutoScroll(false);
		} finally {
			if (generation === historyQueryGeneration) isLoading.value = false;
		}
	}

	async function clearLogs(): Promise<boolean> {
		if (isClearing.value) return false;
		if (
			!confirm(
				"确定清空所有 AI 玩家的全部已完成 LLM 日志吗？\n进行中的调用不会中断，结束后会重新出现在历史中。"
			)
		) {
			return false;
		}
		historyQueryGeneration++;
		isClearing.value = true;
		const clearedIds = new Set(history.value.map(entry => entry.id));
		try {
			await llmLogger.clearLogs();
			history.value = history.value.filter(entry => !clearedIds.has(entry.id));
			hasNewBelow.value = false;
			return true;
		} finally {
			isClearing.value = false;
		}
	}

	watch(
		() => [props.gameId, props.playerSeatNum, props.playerName],
		async () => {
			history.value = [];
			isFollowing.value = true;
			hasNewBelow.value = false;
			restoreLatestActive();
			await refresh();
		}
	);

	onMounted(async () => {
		lib.announce.subscribe("llm_log_start", handlers.start);
		lib.announce.subscribe("llm_log_stream", handlers.stream);
		lib.announce.subscribe("llm_log_chunk", handlers.chunk);
		lib.announce.subscribe("llm_log_timing", handlers.timing);
		lib.announce.subscribe("llm_log_end", handlers.end);
		restoreLatestActive();
		await refresh();
	});

	onUnmounted(() => {
		lib.announce.unsubscribe("llm_log_start", handlers.start);
		lib.announce.unsubscribe("llm_log_stream", handlers.stream);
		lib.announce.unsubscribe("llm_log_chunk", handlers.chunk);
		lib.announce.unsubscribe("llm_log_timing", handlers.timing);
		lib.announce.unsubscribe("llm_log_end", handlers.end);
		stopElapsedTimer();
	});

	return {
		timelineEl,
		currentCall,
		activeStream,
		partialArgs,
		history,
		elapsedMs,
		liveThinkingMs,
		isLoading,
		isClearing,
		isFollowing,
		hasNewBelow,
		sessionStatus,
		handleScroll,
		scrollToBottom,
		refresh,
		clearLogs,
	};
}

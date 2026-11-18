import {
	readBackendsFromRawConfig,
	resolveBackendDisplayName,
	resolvePlayerSeatIndex,
	resolveSeatBackendKind,
	type BackendConfigInput,
	type ExternalBackendKind,
} from "./backends.js";

export interface PlayerButtonLogEntry {
	id: string;
	gameId?: string;
	playerName: string;
	playerSeatNum?: number;
}

export interface PlayerButtonTarget {
	gameId?: string;
	playerName: string;
	playerSeatNum?: number;
}

export interface PlayerButtonOptions {
	enabled: boolean;
	isUnderControl: boolean;
	controlSelf?: boolean;
}

export interface PlayerButtonState {
	active: boolean;
	visible: boolean;
	highlighted: boolean;
	label: string;
	backend?: ExternalBackendKind;
}

export interface PlayerButtonSubject {
	getName(): string;
	getSeatNum(): number;
	isUnderControl(self?: boolean): boolean;
	dataset?: { position?: string };
}

export interface PlayerButtonStatusSnapshot {
	llmGameId?: string;
	llmConfigAtGameStart?: BackendConfigInput;
	llmEnabledAtGameStart?: boolean;
	llmSelfControlledAtGameStart?: boolean;
	llmInitialHumanPlayer?: unknown;
	llmInitialSeatIndices?: WeakMap<object, number>;
}

export interface PlayerButtonConfig {
	llm_enabled?: unknown;
	llm_control_self?: unknown;
	llm_url?: unknown;
	llm_apikey?: unknown;
	llm_model?: unknown;
	llm_default_backend?: unknown;
	llm_openai_display_name?: unknown;
	llm_agy_config?: unknown;
	llm_codex_config?: unknown;
	llm_seat_backends?: unknown;
}

const activeLogs = new Map<string, PlayerButtonLogEntry>();

function gameIdOf(value: { gameId?: string }): string {
	return value.gameId || "game_unknown";
}

function matches(entry: PlayerButtonLogEntry, target: PlayerButtonTarget): boolean {
	if (gameIdOf(entry) !== gameIdOf(target)) return false;
	if (target.playerSeatNum !== undefined && entry.playerSeatNum !== undefined) return entry.playerSeatNum === target.playerSeatNum;
	return entry.playerName === target.playerName;
}

/** Clears all active indicators when a new game starts. */
export function reset(): void {
	activeLogs.clear();
}

/** Registers a started LLM log by its stable log ID. */
export function start(entry: PlayerButtonLogEntry): void {
	activeLogs.set(entry.id, entry);
}

/** Removes a completed LLM log. Unknown IDs intentionally have no effect. */
export function end(entry: Pick<PlayerButtonLogEntry, "id"> | string): void {
	activeLogs.delete(typeof entry === "string" ? entry : entry.id);
}

/** Returns whether any active log belongs to the target player in this game. */
export function isActive(target: PlayerButtonTarget): boolean {
	for (const entry of activeLogs.values()) {
		if (matches(entry, target)) return true;
	}
	return false;
}

/** Derives button visibility independently from the current LLM configuration. */
export function derive(target: PlayerButtonTarget, options: PlayerButtonOptions): Pick<PlayerButtonState, "active" | "visible" | "highlighted"> {
	const active = isActive(target);
	return {
		active,
		visible: active || (options.enabled && (!options.isUnderControl || !!options.controlSelf)),
		highlighted: active,
	};
}

function toBackendInput(status: PlayerButtonStatusSnapshot, config: PlayerButtonConfig, enabled: boolean, controlSelf: boolean): BackendConfigInput {
	if (status.llmConfigAtGameStart) {
		return { ...status.llmConfigAtGameStart, enabled, controlSelf };
	}
	const extra = readBackendsFromRawConfig(config as Record<string, any>);
	return {
		enabled,
		controlSelf,
		url: typeof config.llm_url === "string" ? config.llm_url : "",
		apikey: typeof config.llm_apikey === "string" ? config.llm_apikey : "",
		model: typeof config.llm_model === "string" ? config.llm_model : "",
		...extra,
	};
}

/** Resolves LLM log button state and top AI name badge for a player from snapshot or config. */
export function resolvePlayerButtonState(player: PlayerButtonSubject, status: PlayerButtonStatusSnapshot, config: PlayerButtonConfig): PlayerButtonState {
	const enabled = status.llmEnabledAtGameStart ?? status.llmConfigAtGameStart?.enabled ?? !!config.llm_enabled;
	const controlSelf = status.llmSelfControlledAtGameStart ?? (enabled && (status.llmConfigAtGameStart?.controlSelf ?? !!config.llm_control_self));
	const effectiveConfig = toBackendInput(status, config, enabled, controlSelf);
	const seatIndex = resolvePlayerSeatIndex(player, status);
	const kind = resolveSeatBackendKind(seatIndex, effectiveConfig);
	const isExternal = kind === "openai" || kind === "agy" || kind === "codex";
	const isUnderControl = status.llmInitialHumanPlayer !== undefined ? (player as unknown) === status.llmInitialHumanPlayer : player.isUnderControl(true);

	const base = derive(
		{
			gameId: status.llmGameId,
			playerName: player.getName(),
			playerSeatNum: seatIndex,
		},
		{
			enabled: enabled && isExternal,
			isUnderControl,
			controlSelf,
		}
	);
	const label = isExternal ? resolveBackendDisplayName(kind, effectiveConfig) : base.active ? "AI" : "";
	return {
		...base,
		label,
		...(isExternal ? { backend: kind } : {}),
	};
}

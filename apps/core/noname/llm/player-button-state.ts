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
}

export interface PlayerButtonState {
	active: boolean;
	visible: boolean;
	highlighted: boolean;
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
export function derive(target: PlayerButtonTarget, options: PlayerButtonOptions): PlayerButtonState {
	const active = isActive(target);
	return {
		active,
		visible: active || (options.enabled && !options.isUnderControl),
		highlighted: active,
	};
}

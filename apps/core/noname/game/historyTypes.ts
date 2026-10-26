import type { GameHistory, GameHistoryEventKey } from "./index.js";

/** Preserve the selected key's element type without merging mutable array APIs. */
export function readHistoryEvents<K extends GameHistoryEventKey>(history: GameHistory, key: K): GameHistory[K][number][] {
	return history[key];
}

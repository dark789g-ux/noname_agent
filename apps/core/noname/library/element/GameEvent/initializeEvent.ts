import type { GameEvent } from "../gameEvent.js";
import type { GameEventNumberValue, EventCreationFields, EventCreationFieldInput } from "./eventContracts.js";

/**
 * Refines the same runtime event after an actual producer write.  Unlike a
 * name-based cast, the returned intersection contains only fields supplied by
 * this `Object.assign` call.
 */
export function initializeEvent<N extends GameEventNumberValue, T extends Partial<EventCreationFields<N>>>(event: GameEvent<N>, fields: EventCreationFieldInput<N, T>): GameEvent<N> & T {
	return Object.assign(event, fields);
}

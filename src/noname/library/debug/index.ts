import { createCheatConfiguration } from "./configuration.js";
import { createCheatInspection } from "./inspection.js";
import { createCheatCards } from "./cards.js";
import { createCheatPlayers } from "./players.js";
import { createCheatGame } from "./game.js";
export function createCheat() {
	return {
		...createCheatConfiguration(),
		...createCheatInspection(),
		...createCheatCards(),
		...createCheatPlayers(),
		...createCheatGame(),
	};
}

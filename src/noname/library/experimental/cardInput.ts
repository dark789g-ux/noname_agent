import type { Card } from "../element/card.js";
import { ItemType } from "./symbol.js";

/**
 * The experimental item marker establishes recognition, not DOM or Card
 * capabilities. Operations must check the capabilities they actually use.
 */
export interface ExperimentalCardInput {
	[ItemType]: "card";
	cards?: CardMoveCandidate[];
}

export type CardMoveCandidate = Card | ExperimentalCardInput;

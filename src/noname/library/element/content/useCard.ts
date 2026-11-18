import { prepareUseCard } from "./prepareUseCard.js";
import { resolveUseCard } from "./resolveUseCard.js";

export const useCardContent = {
	useCard: [...prepareUseCard, ...resolveUseCard],
};

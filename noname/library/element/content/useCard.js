import { prepareUseCard } from "./prepareUseCard.js";
import { resolveUseCard } from "./resolveUseCard.js";
const useCardContent = {
  useCard: [...prepareUseCard, ...resolveUseCard]
};
export {
  useCardContent
};

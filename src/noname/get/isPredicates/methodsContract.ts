import type { cardAndContentPredicates } from "./cardAndContent.js";
import type { skillAndTextPredicates } from "./skillAndText.js";
import type { platformAndStatePredicates } from "./platformAndState.js";

type CardAndContentPredicates = typeof cardAndContentPredicates;
type SkillAndTextPredicates = typeof skillAndTextPredicates;
type PlatformAndStatePredicates = typeof platformAndStatePredicates;

declare module "./Is.js" {
	interface Is extends CardAndContentPredicates, SkillAndTextPredicates, PlatformAndStatePredicates {}
}

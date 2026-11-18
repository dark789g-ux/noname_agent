import "./gameContract.js";
import { createStart } from "./startup/start.js";
import { createIdentityStateMethods } from "./game/canReplaceViewpoint.js";
import { createIdentityResultMethods } from "./game/checkResult.js";
import { createPurpleSelectionMethods } from "./game/chooseCharacterPurpleOL.js";
import { createCharacterSelectionMethods } from "./game/chooseCharacterStratagemOL.js";
import { createIdentityTranslations } from "./config/translate.js";
import { createIdentityPlayerActions } from "./player/insightInto.js";
import { createIdentityRevealMethods } from "./player/showIdentity.js";
import { createStratagemContents } from "./content/stratagemInsight.js";
import { createIdentityAttitudeMethods } from "./get/rawAttitude.js";
import { createStratagemAndIdentitySkills } from "./skill/stratagem_gain.js";
import { createSixiangResponseSkills } from "./skill/sixiang_qinglong.js";
import { createIdentityHelp } from "./config/help.js";
/** New mutable mode data is created for each invocation. */
export default function createIdentityMode(): importModeConfig {
	return {
		name: "identity",
		start: createStart(),
		game: { ...createIdentityStateMethods(), ...createIdentityResultMethods(), ...createPurpleSelectionMethods(), ...createCharacterSelectionMethods() },
		translate: createIdentityTranslations(),
		element: { player: { ...createIdentityPlayerActions(), ...createIdentityRevealMethods() }, content: { ...createStratagemContents() } },
		get: { ...createIdentityAttitudeMethods() },
		skill: { ...createStratagemAndIdentitySkills(), ...createSixiangResponseSkills() },
		help: createIdentityHelp(),
	};
}

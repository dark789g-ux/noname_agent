import { menu } from "./menu/vue/index.js";
import { playerCardVueBridge } from "./player/vue/mountPlayerCard.js";
import { installPrototypeMethods } from "../installPrototypeMethods.js";
import "./contracts/createContract.js";
import { createArenaMethods } from "./arena/index.js";
import { characterDialogMethods } from "./characterDialog/index.js";
import { legacyCharacterDialogMethods } from "./characterDialog/legacyDialog.js";
import { cardTempNameMethods } from "./methods/cardTempName.js";
import { editorAndToastMethods } from "./methods/editorAndToast.js";
import { domElementMethods } from "./methods/domElements.js";
import { playersAndConnectMethods } from "./methods/playersAndConnect.js";
import { controlsAndSkillsMethods } from "./methods/controlsAndSkills.js";
import { createButtonPresets } from "./methods/buttonPresets.js";
import { buttonsAndCardsMethods } from "./methods/buttonsAndCards.js";

export type * from "./contracts/createContract.js";

export class Create {
	videoNode?: (video: Videos, before: boolean) => void;
	/** 创建菜单 */
	menu = menu;
	/** 人物卡片 Vue 桥接 */
	playerCard = playerCardVueBridge;
	buttonPresets = createButtonPresets();
}

installPrototypeMethods("Create", Create.prototype, [
	cardTempNameMethods,
	editorAndToastMethods,
	domElementMethods,
	playersAndConnectMethods,
	controlsAndSkillsMethods,
	createArenaMethods,
	characterDialogMethods,
	legacyCharacterDialogMethods,
	buttonsAndCardsMethods,
]);

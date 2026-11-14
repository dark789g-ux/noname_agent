import { createAppearanceLayoutOptions } from "./config/layout.js";
import { createAppearanceBackgroundOptions } from "./config/background.js";
import { createAppearanceCardsOptions } from "./config/cards.js";
import { createAppearanceCardbacksOptions } from "./config/cardbacks.js";
import { createAppearanceHealthOptions } from "./config/health.js";
import { createAppearancePlayersOptions } from "./config/players.js";
import { createAppearanceBordersOptions } from "./config/borders.js";
import { createAppearanceControlsOptions } from "./config/controls.js";
import { createAppearanceButtonsAndAnimationOptions } from "./config/buttonsAndAnimation.js";
import { createAppearanceFontsAndLabelsOptions } from "./config/fontsAndLabels.js";
export function createConfigMenuAppearenceConfig() {
	return {
		...createAppearanceLayoutOptions(),
		...createAppearanceBackgroundOptions(),
		...createAppearanceCardsOptions(),
		...createAppearanceCardbacksOptions(),
		...createAppearanceHealthOptions(),
		...createAppearancePlayersOptions(),
		...createAppearanceBordersOptions(),
		...createAppearanceControlsOptions(),
		...createAppearanceButtonsAndAnimationOptions(),
		...createAppearanceFontsAndLabelsOptions(),
	};
}

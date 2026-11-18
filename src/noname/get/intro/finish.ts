import { lib } from "noname";
export function finishIntro(uiintro) {
	if (lib.config.touchscreen) lib.setScroll(uiintro.contentContainer);
	return uiintro;
}

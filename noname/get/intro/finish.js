import "../../../noname.js";
import { lib } from "../../library/index.js";
function finishIntro(uiintro) {
  if (lib.config.touchscreen) lib.setScroll(uiintro.contentContainer);
  return uiintro;
}
export {
  finishIntro
};

import { installPrototypeMethods } from "../installPrototypeMethods.js";
import "./contracts/clickContract.js";
import { characterCardMethods } from "./charactercard/index.js";
import { connectEventsMethods } from "./methods/connectEvents.js";
import { connectClientsAndRoomMethods } from "./methods/connectClientsAndRoom.js";
import { windowTouchMethods } from "./methods/windowTouch.js";
import { windowMouseMethods } from "./methods/windowMouse.js";
import { pointerAndScrollMethods } from "./methods/pointerAndScroll.js";
import { hoverAndIntroMethods } from "./methods/hoverAndIntro.js";
import { gameplaySelectionMethods } from "./methods/gameplaySelection.js";
import { gameplayControlsMethods } from "./methods/gameplayControls.js";
import { chatAndAudioMethods } from "./methods/chatAndAudio.js";
import { identityAndSystemMethods } from "./methods/identityAndSystem.js";
import { widgetsAndSkinMethods } from "./methods/widgetsAndSkin.js";
class Click {
  consoleMenu;
  menuTab;
  configMenu;
}
installPrototypeMethods("Click", Click.prototype, [
  characterCardMethods,
  connectEventsMethods,
  connectClientsAndRoomMethods,
  windowTouchMethods,
  windowMouseMethods,
  pointerAndScrollMethods,
  hoverAndIntroMethods,
  gameplaySelectionMethods,
  gameplayControlsMethods,
  chatAndAudioMethods,
  identityAndSystemMethods,
  widgetsAndSkinMethods
]);
export {
  Click
};

import "../../noname.js";
import { Click } from "./click/index.js";
import { Create } from "./create/index.js";
import { installPrototypeMethods } from "./installPrototypeMethods.js";
import "./contracts/uiContract.js";
import { controlAndJudgeLayoutMethods } from "./methods/controlAndJudgeLayout.js";
import { handcardsLayoutMethods } from "./methods/handcardsLayout.js";
import { arenaAndPlayerStateMethods } from "./methods/arenaAndPlayerState.js";
import { lib } from "../library/index.js";
class UI {
  updates = [];
  thrown = [];
  touchlines = [];
  todiscard = {};
  _recycle = {};
  playerPositions = [];
  create = new Create();
  click = new Click();
  selected = {
    buttons: [],
    cards: [],
    targets: []
  };
  dialogs;
  dialog;
  system;
  arena;
  controls;
  control;
  confirm;
  skills;
  skills1;
  skills2;
  skills3;
  window;
  pause;
  backgroundMusic;
  special;
  fakeme;
  chess;
  /** 手动在菜单栏中添加一个武将包的ui */
  updateCharacterPackMenu = [];
  /** 手动在菜单栏中添加一个卡牌包的ui */
  updateCardPackMenu = [];
  /** 挑战模式下正在操作的角色 */
  mebg;
  updateUpdate;
  commandnode;
  updateVideoMenu;
  menuContainer;
  auto;
  wuxie;
  tempnowuxie;
  toastQueue = [];
  cardPile;
  discardPile;
  ordering;
  coin;
  css;
  /** PC端悬浮的手牌 */
  _handcardHover = null;
  timer;
}
installPrototypeMethods("UI", UI.prototype, [controlAndJudgeLayoutMethods, handcardsLayoutMethods, arenaAndPlayerStateMethods]);
let ui = new UI();
let setUI = (instance) => {
  ui = instance || new UI();
  if (lib.config.dev) {
    window.ui = ui;
  }
};
export {
  UI,
  setUI,
  ui
};

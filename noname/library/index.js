import "../../noname.js";
import { LibInit } from "./init/index.js";
import { experimental } from "./experimental/index.js";
import { updateURLs } from "./update-urls.js";
import { assetURL, userAgentLowerCase, characterDefaultPicturePath } from "../util/index.js";
import { defaultSplashs } from "../init/onload/index.js";
import { PoptipManager } from "./poptip.js";
import { ZhanfaManager } from "./zhanfa.js";
import { getRegisteredSkill, requireRegisteredSkill } from "./skillRegistry.js";
import { createCharacterPack } from "./registries/characterPack.js";
import { createCharacterSort } from "./registries/characterSort.js";
import { createCardPack } from "./registries/cardPack.js";
import { createDuplicatePrefix } from "./registries/duplicatePrefix.js";
import { createArenaReady } from "./runtime/arenaReady.js";
import { requireNodePlatform, getNodeServer, requireNodeServer, startNodeServer } from "./runtime/node.js";
import { createHooks } from "./registries/hooks.js";
import { createAnnounce } from "./registries/announce.js";
import { createPinyins } from "./registries/pinyins.js";
import { createYingbian } from "./rules/yingbian.js";
import { createStratagemBuff } from "./rules/stratagemBuff.js";
import { createActualCardName } from "./registries/actualCardName.js";
import { createRespondMap } from "./registries/respondMap.js";
import { createCommonArea } from "./rules/commonArea.js";
import { createCharacterDialogGroup } from "./registries/characterDialogGroup.js";
import { listenEnd } from "./ui/listenEnd.js";
import { createConfigMenu } from "./configuration/options/index.js";
import { createExtensionMenu } from "./configuration/extensions.js";
import { createMode } from "./configuration/modes/index.js";
import { createStatus } from "./registries/status.js";
import { createHelp } from "./registries/help.js";
import { getErrorTip } from "./ui/getErrorTip.js";
import { setIntro } from "./ui/setIntro.js";
import { setPopped } from "./ui/setPopped.js";
import { placePoppedDialog } from "./ui/placePoppedDialog.js";
import { setHover } from "./ui/setHover.js";
import { setScroll } from "./ui/setScroll.js";
import { setLongPress } from "./ui/setLongPress.js";
import { updateCanvas } from "./ui/updateCanvas.js";
import { run } from "./ui/run.js";
import { saveVideo } from "./ui/saveVideo.js";
import { createCheat } from "./debug/index.js";
import { createTranslate } from "./registries/translate.js";
import { createElement } from "./runtime/element.js";
import { createCard } from "./registries/card.js";
import { createFilter } from "./rules/filter/index.js";
import { createSort } from "./rules/sort.js";
import { createSkill } from "./registries/skill.js";
import { createCharacter } from "./registries/character.js";
import { createMessage } from "./network/index.js";
import { createNature } from "./registries/nature.js";
import { createNatureAudio } from "./registries/natureAudio.js";
import { createNamePrefix } from "./registries/namePrefix/index.js";
import { createGroupnature } from "./registries/groupnature.js";
import { createLineColor } from "./registries/lineColor.js";
import { createQuickVoice } from "./registries/quickVoice.js";
import { initializeElementPrototypes } from "./runtime/prototypes.js";
import { ui } from "../ui/index.js";
class Library {
  /** @param {string | symbol} name */
  getSkill(name) {
    return getRegisteredSkill(this.skill, name);
  }
  /** @param {string | symbol} name */
  requireSkill(name) {
    return requireRegisteredSkill(this.skill, name);
  }
  configprefix = "noname_0.9_";
  versionOL = 27;
  updateURLS = updateURLs;
  updateURL = updateURLs.github;
  mirrorURL = updateURLs.coding;
  hallURL = "";
  assetURL = assetURL;
  userAgent = userAgentLowerCase;
  characterDefaultPicturePath = characterDefaultPicturePath;
  changeLog = [];
  updates = [];
  canvasUpdates = [];
  /**
   * @type { Video[] }
   */
  video = [];
  skilllist = [];
  connectBanned = [];
  characterIntro = {};
  characterTitle = {};
  /** @type {Record<string, Record<string, Character>>} */
  characterPack = createCharacterPack();
  characterFilter = {};
  /** @type {Record<string, Record<string, string[]> | undefined>} */
  characterSort = createCharacterSort();
  characterReplace = {};
  /** @type {Record<string, [string, string[]][]>} */
  characterSubstitute = {};
  characterAppend = {};
  characterInitFilter = {};
  characterGuozhanFilter = ["mode_guozhan"];
  dynamicTranslate = {};
  /** @type {Record<string, string[]>} */
  cardPack = createCardPack();
  cardBingzhu = {};
  duplicatePrefix = createDuplicatePrefix();
  cardPackInfo = {};
  /**
   * @type { Record<string, number> }
   */
  skin = {};
  onresize = [];
  onphase = [];
  onwash = [];
  /** @type {((event: GameEvent, player?: Player) => boolean)[]} */
  onround = [
    function roundSkillCheck(event) {
      return !event.skill;
    }
  ];
  onover = [];
  ondb = [];
  ondb2 = [];
  chatHistory = [];
  animate = {
    skill: {},
    card: {}
  };
  onload = [];
  onload2 = [];
  onprepare = [];
  /**
   * @type { Function[] | undefined }
   */
  arenaReady = createArenaReady();
  /** @type {Array<() => void> | undefined} */
  onfree = [];
  inpile = [];
  inpile_nature = [];
  extensions = [];
  extensionPack = {};
  /**
   * @type { import("../init/onload/onload-splash.js").OnloadSplash[] }
   */
  onloadSplashes = [...defaultSplashs];
  cardType = {};
  hook = { globalskill: {} };
  /**
   *  @type { Player | undefined }
   */
  tempSortSeat;
  /**
   * @type { 'android' | 'ios' | undefined }
   */
  device;
  /**
   * @type { string }
   */
  version;
  /**
   * @type { Videos[] }
   */
  videos;
  /** @type {NodePlatformRuntime | NodeServerRuntime | NodeRuntimeReset | undefined} */
  node;
  /**
   * @returns {NodePlatformRuntime}
   */
  requireNodePlatform() {
    return requireNodePlatform.call(this);
  }
  /**
   * @returns {NodeServerRuntime | undefined}
   */
  getNodeServer() {
    return getNodeServer.call(this);
  }
  /**
   * @returns {NodeServerRuntime}
   */
  requireNodeServer() {
    return requireNodeServer.call(this);
  }
  /**
   * 在已初始化的 Node 平台上建立联机服务器状态。保留原对象身份，避免断开外部引用。
   * @returns {NodeServerRuntime}
   */
  startNodeServer() {
    return startNodeServer.call(this);
  }
  // 谁写的值类型是string，这也太离谱了喵
  /**
   * @type { { [key: string]: Player } }
   */
  playerOL;
  /**
   * @type { import("../storage/database.js").PersistenceDatabase }
   */
  db;
  //函数钩子
  /**
   * 你可以往这里加入{钩子名:函数数组}，并在数组里增加你的自定义函数
   *
   * 这样当某个地方调用game.callHook(钩子名,[...函数参数])时，就会按顺序将对应数组中的每个函数运行一遍（传参为callHook的第二个参数）。
   *
   * 你可以将hook机制类比为event.trigger()，但是这里只能放同步代码
   */
  hooks = createHooks();
  /**
   * **无名杀消息推送库**
   *
   * 通过`EventTarget`机制，实现消息推送和接收的解耦，
   * 从而使消息接收方无需依赖发布方，发布方也无需考虑接收方
   *
   * > `lib.announce`不是`actor`模型，若不存在订阅者，则消息发送将无意义
   *
   * @example
   * // 甲扩展（如《千幻聆音》）在角色皮肤切换后，调用：
   * lib.announce.publish("skinChange", {
   * 	player,
   * 	playerName: "zhangfei",
   * 	originSkin: "image/xxx.jpg",
   * 	currentSkin: "image/yyy.jpg"
   * });
   *
   * // 乙扩展监听此`skinChange`事件，并修改自己扩展相关界面的图片：
   * const method = lib.announce.subscribe("skinChange", (e) => {
   * 	div.setBackgroundImage(e.currentSkin);
   * });
   *
   * // 若此时乙扩展不想继续订阅`skinChange`事件，可以通过`unsubscribe`解除订阅
   * lib.announce.unsubscribe("skinChange", method);
   */
  announce = createAnnounce();
  objectURL = /* @__PURE__ */ new Map();
  hookmap = {};
  //共联时机的map
  #relatedTrigger = {
    get phaseAny() {
      return lib.phaseName;
    }
    //loseAsync: ["lose", "gain", "addToExpansion", "addJudge", "eqiup"],
  };
  get relatedTrigger() {
    return this.#relatedTrigger;
  }
  /**
   * @type { { character?: Record<string, importCharacterConfig>, card?: Record<string, importCardConfig>, mode?: Record<string, importModeConfig>, player?: Record<string, importPlayerConfig>, extension?: Record<string, importExtensionConfig>, play?: Record<string, importPlayConfig> } }
   */
  imported = {};
  layoutfixed = ["chess", "tafang", "stone"];
  pinyins = createPinyins();
  /**
   * Yingbian
   *
   * 应变
   */
  yingbian = createYingbian();
  /**
   * Stratagem buff
   *
   * 谋攻强化
   */
  stratagemBuff = createStratagemBuff();
  /**
   * The actual card name
   *
   * 实际的卡牌名称
   */
  actualCardName = createActualCardName();
  /**
   * the cards which can respond card
   *
   * 卡牌的可被响应牌（主要是用于player.canRespond函数）
   * 例如可响应杀的主要就是闪，或者本体的草船借箭，以此类推；
   * 类似劝酒这种复杂条件的，可以放函数，但仅检测实体牌
   */
  respondMap = createRespondMap();
  #poptip = new PoptipManager();
  get poptip() {
    return this.#poptip;
  }
  /** @type {Map<string, CommonAreaDefinition>} */
  commonArea = createCommonArea();
  characterDialogGroup = createCharacterDialogGroup();
  listenEnd(node) {
    return listenEnd.call(this, node);
  }
  configMenu = createConfigMenu();
  extensionMenu = createExtensionMenu();
  mode = createMode();
  status = createStatus();
  help = createHelp();
  /**
   * @type {typeof import("path-browserify-esm").default | typeof import("path")}
   */
  path;
  getErrorTip(msg) {
    return getErrorTip.call(this, msg);
  }
  setIntro(node, func, left) {
    return setIntro.call(this, node, func, left);
  }
  setPopped(node, func, width, height, forceclick, paused2) {
    return setPopped.call(this, node, func, width, height, forceclick, paused2);
  }
  placePoppedDialog(dialog, e) {
    return placePoppedDialog.call(this, dialog, e);
  }
  setHover(node, func, hoveration, width) {
    return setHover.call(this, node, func, hoveration, width);
  }
  setScroll(node) {
    return setScroll.call(this, node);
  }
  setMousewheel(node) {
    if (lib.config.mousewheel) {
      node.onmousewheel = ui.click.mousewheel;
    }
  }
  setLongPress(node, func) {
    return setLongPress.call(this, node, func);
  }
  updateCanvas(time) {
    return updateCanvas.call(this, time);
  }
  run(time) {
    return run.call(this, time);
  }
  getUTC(date) {
    return date.getTime();
  }
  saveVideo() {
    return saveVideo.call(this);
  }
  init = new LibInit();
  cheat = createCheat();
  /**
   * @type { Record<string, string | undefined> }
   */
  translate = createTranslate();
  experimental = experimental;
  element = createElement();
  card = createCard();
  filter = createFilter();
  sort = createSort();
  /** @type {import("./skillRegistry.js").SkillRegistry} */
  skill = createSkill();
  /** @type {Object<string, import("@/library/element/character.js").Character>} */
  character = createCharacter();
  perfectPair = {};
  cardPile = {};
  #zhanfa = new ZhanfaManager(this);
  get zhanfa() {
    return this.#zhanfa;
  }
  message = createMessage();
  //为lib.numstrList属性set数字对应花色，即可在get.strNumber和get.numString中获取使用
  numstrList = /* @__PURE__ */ new Map([
    [1, "A"],
    [11, "J"],
    [12, "Q"],
    [13, "K"]
  ]);
  // special翻译被占了，单独给几个区域加个翻译列表
  areaList = /* @__PURE__ */ new Map([
    ["cardPile", "牌堆"],
    ["discardPile", "弃牌堆"],
    ["special", "s区"],
    ["ordering", "处理区"]
  ]);
  suit = ["club", "spade", "diamond", "heart"];
  suits = ["club", "spade", "diamond", "heart", "none"];
  color = {
    black: ["club", "spade"],
    red: ["diamond", "heart"],
    none: ["none"]
  };
  group = ["wei", "shu", "wu", "qun", "jin", "shen"];
  //数值代表各元素在名称中排列的先后顺序
  nature = createNature();
  natureAudio = createNatureAudio();
  linked = ["fire", "thunder", "kami", "ice"];
  natureBg = /* @__PURE__ */ new Map([["stab", "image/card/cisha.png"]]);
  natureSeparator = "|";
  namePrefix = createNamePrefix();
  groupnature = createGroupnature();
  lineColor = createLineColor();
  selectGroup = ["shen", "devil"];
  //"western",
  phaseName = ["phaseZhunbei", "phaseJudge", "phaseDraw", "phaseUse", "phaseDiscard", "phaseJieshu"];
  quickVoice = createQuickVoice();
  InitFilter = {
    noZhuHp: "不享受主公的额外体力上限",
    noZhuSkill: "不享受地主的额外技能"
  };
}
Library.prototype.config = void 0;
Library.prototype.configOL = void 0;
let lib = new Library();
let setLibrary = (instance) => {
  lib = instance || new Library();
  if (lib.config.dev) {
    window.lib = lib;
  }
};
initializeElementPrototypes(lib);
export {
  Library,
  lib,
  setLibrary
};

import "../../../../../../../../noname.js";
import { lib } from "../../../../../../../library/index.js";
import { game } from "../../../../../../../game/index.js";
import { get } from "../../../../../../../get/binding.js";
const PILE_SUIT_OPTIONS = [
  { value: "heart", label: "红桃" },
  { value: "diamond", label: "方片" },
  { value: "club", label: "梅花" },
  { value: "spade", label: "黑桃" }
];
const PILE_NUMBER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
function customCardPileMap() {
  return lib.config.customcardpile;
}
function bannedPileMap() {
  return lib.config.bannedpile;
}
function addedPileMap() {
  return lib.config.addedpile;
}
function syncCurrentCustomPile() {
  customCardPileMap()["当前牌堆"] = [bannedPileMap(), addedPileMap()];
  game.saveConfig("customcardpile", customCardPileMap());
  game.saveConfig("cardpilename", "当前牌堆", true);
}
function ensureModePileConfig(mode) {
  const banned = bannedPileMap();
  if (!banned[mode]) banned[mode] = [];
  const added = addedPileMap();
  if (!added[mode]) added[mode] = [];
}
function formatPileCardLabel(card, useStrNumber = true) {
  const nature = card[2] === "sha" && card[3] ? get.translation(card[3]) : "";
  const numText = useStrNumber ? get.strNumber(card[1]) : String(card[1]);
  return `${nature}${get.translation(card[2])} ${get.translation(card[0])}${numText}`;
}
function loadModeAddedCards(mode) {
  ensureModePileConfig(mode);
  return addedPileMap()[mode].map((card) => ({
    card,
    label: formatPileCardLabel(card, false)
  }));
}
function loadModeDefaultCards(mode) {
  const pile = lib.cardPile[mode];
  if (!Array.isArray(pile)) return [];
  const banned = bannedPileMap()[mode] || [];
  return pile.map((card, index) => ({
    card,
    label: formatPileCardLabel(card, true),
    enabled: !banned.includes(index),
    index
  }));
}
function getAddableCardOptions() {
  const list = [];
  const enabledPacks = lib.config.cards || [];
  for (let i = 0; i < enabledPacks.length; i++) {
    const packName = enabledPacks[i];
    const cards = lib.cardPack[packName];
    if (!cards) continue;
    for (let j = 0; j < cards.length; j++) {
      const cname = cards[j];
      list.push([cname, get.translation(cname)]);
      if (cname === "sha") {
        list.push(["huosha", "火杀"]);
        list.push(["leisha", "雷杀"]);
        list.push(["icesha", "冰杀"]);
        list.push(["cisha", "刺杀"]);
      }
    }
  }
  return list;
}
function setModeCardEnabled(mode, index, enabled) {
  ensureModePileConfig(mode);
  const list = bannedPileMap()[mode];
  if (enabled) {
    list.remove(index);
  } else {
    list.add(index);
  }
  syncCurrentCustomPile();
}
function addCardToModePile(mode, card) {
  ensureModePileConfig(mode);
  addedPileMap()[mode].push(card);
  syncCurrentCustomPile();
  return { card, label: formatPileCardLabel(card, true) };
}
function removeAddedCardAt(mode, index) {
  const list = addedPileMap()[mode];
  if (!list || index < 0 || index >= list.length) return;
  list.splice(index, 1);
  syncCurrentCustomPile();
}
function ensureGlobalPileContainers() {
  if (!lib.config.bannedpile) lib.config.bannedpile = [];
  if (!lib.config.addedpile) lib.config.addedpile = [];
}
function getCustomPileKeys() {
  return Object.keys(customCardPileMap());
}
function getAvailablePileOptions() {
  const options = ["默认牌堆"];
  const map = customCardPileMap();
  if (map["当前牌堆"] && !options.includes("当前牌堆")) {
    options.push("当前牌堆");
  }
  for (const key of Object.keys(map)) {
    if (!options.includes(key)) options.push(key);
  }
  return options;
}
function resolveCurrentPileSelection(options) {
  const current = get.config("cardpilename");
  if (current) return current;
  return options.includes("当前牌堆") ? "当前牌堆" : "默认牌堆";
}
function deleteNamedCustomPile(name) {
  const map = customCardPileMap();
  delete map[name];
  game.saveConfig("customcardpile", map);
  for (const modeName in lib.config.mode_config) {
    if (modeName === "global") continue;
    if (lib.config.mode_config[modeName]?.cardpilename === name) {
      game.saveConfig("cardpilename", null, modeName);
    }
  }
}
function saveNamedCustomPile(rawName) {
  const map = customCardPileMap();
  let name = rawName;
  if (map[name] || name === "默认牌堆" || name === "当前牌堆") {
    for (let i = 1; i <= 1e3; i++) {
      const candidate = `${name}(${i})`;
      if (!map[candidate]) {
        name = candidate;
        break;
      }
    }
  }
  map[name] = [bannedPileMap(), addedPileMap()];
  delete map["当前牌堆"];
  for (const modeName in lib.mode) {
    const cfg = lib.config.mode_config[modeName];
    if (cfg && (cfg.cardpilename === "当前牌堆" || !cfg.cardpilename)) {
      game.saveConfig("cardpilename", name, modeName);
    }
  }
  game.saveConfig("customcardpile", map);
  return name;
}
export {
  PILE_NUMBER_OPTIONS,
  PILE_SUIT_OPTIONS,
  addCardToModePile,
  deleteNamedCustomPile,
  ensureGlobalPileContainers,
  ensureModePileConfig,
  formatPileCardLabel,
  getAddableCardOptions,
  getAvailablePileOptions,
  getCustomPileKeys,
  loadModeAddedCards,
  loadModeDefaultCards,
  removeAddedCardAt,
  resolveCurrentPileSelection,
  saveNamedCustomPile,
  setModeCardEnabled,
  syncCurrentCustomPile
};

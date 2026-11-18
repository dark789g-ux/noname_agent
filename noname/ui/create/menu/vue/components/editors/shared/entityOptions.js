import "../../../../../../../../noname.js";
import "../../../../../../../library/element/index.js";
import { lib } from "../../../../../../../library/index.js";
import { Character } from "../../../../../../../library/element/character.js";
const SUIT_OPTIONS = [
  { value: "heart", label: "♥" },
  { value: "diamond", label: "♦" },
  { value: "club", label: "♣" },
  { value: "spade", label: "♠" }
];
function sortPairsByIdSuffix(list) {
  return [...list].sort((a, b) => {
    const idxA = a[0].lastIndexOf("_");
    const idxB = b[0].lastIndexOf("_");
    const suffixA = idxA >= 0 ? a[0].slice(idxA + 1) : a[0];
    const suffixB = idxB >= 0 ? b[0].slice(idxB + 1) : b[0];
    if (suffixA !== suffixB) return suffixA > suffixB ? 1 : -1;
    if (a[0] === b[0]) return 0;
    return a[0] > b[0] ? 1 : -1;
  });
}
function getCharactersWithSkillsOptions(options) {
  const list = [];
  for (const id in lib.character) {
    const skills = lib.character[id]?.[3];
    if (skills?.length) {
      list.push([id, lib.translate[id]]);
    }
  }
  if (!list.length && options?.ensureFallbackSunce) {
    if (!lib.character["noname_sunce"]) {
      lib.character["noname_sunce"] = new Character({
        sex: "male",
        group: "wu",
        hp: 4,
        skills: ["jiang"],
        isUnseen: true
      });
    }
    if (!lib.translate["noname_sunce"]) {
      lib.translate["noname_sunce"] = "孙策";
    }
    list.push(["noname_sunce", lib.translate["noname_sunce"]]);
  }
  return sortPairsByIdSuffix(list);
}
function getTranslatedCardOptions() {
  const list = [];
  for (const id in lib.card) {
    if (lib.translate[id]) {
      list.push([id, lib.translate[id]]);
    }
  }
  return sortPairsByIdSuffix(list);
}
export {
  SUIT_OPTIONS,
  getCharactersWithSkillsOptions,
  getTranslatedCardOptions,
  sortPairsByIdSuffix
};

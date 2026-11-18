import { nodeIntroMethods } from "./intro/nodeIntro.js";
import { cardAddNewRowListMethods } from "./methods/card/addNewRowList.js";
import { cardSkillsFromEquipsMethods } from "./methods/card/skillsFromEquips.js";
import { cardSelectGroupMethods } from "./methods/card/selectGroup.js";
import { cardColorMethods } from "./methods/card/color.js";
import { characterConvertedCharacterMethods } from "./methods/character/convertedCharacter.js";
import { characterCharacterSurnameMethods } from "./methods/character/characterSurname.js";
import { eventCardsetionMethods } from "./methods/event/cardsetion.js";
import { eventPlayerMethods } from "./methods/event/player.js";
import { serializationParamToCacheKeyMethods } from "./methods/serialization/paramToCacheKey.js";
import { serializationStringifiedResultMethods } from "./methods/serialization/stringifiedResult.js";
import { textPinyinMethods } from "./methods/text/pinyin.js";
import { textTranslationMethods } from "./methods/text/translation.js";
import { platformObjectURLMethods } from "./methods/platform/objectURL.js";
import { utilityDynamicVariableMethods } from "./methods/utility/dynamicVariable.js";
import { uiSkillintroMethods } from "./methods/ui/skillintro.js";
import { uiSelectableButtonsMethods } from "./methods/ui/selectableButtons.js";
import { aiAiStrategyMethods } from "./methods/ai/aiStrategy.js";
import { aiEffect_useMethods } from "./methods/ai/effect_use.js";
import { aiSgnAttitudeMethods } from "./methods/ai/sgnAttitude.js";
import { aiRankMethods } from "./methods/ai/rank.js";
const methodGroups = [nodeIntroMethods, cardAddNewRowListMethods, cardSkillsFromEquipsMethods, cardSelectGroupMethods, cardColorMethods, characterConvertedCharacterMethods, characterCharacterSurnameMethods, eventCardsetionMethods, eventPlayerMethods, serializationParamToCacheKeyMethods, serializationStringifiedResultMethods, textPinyinMethods, textTranslationMethods, platformObjectURLMethods, utilityDynamicVariableMethods, uiSkillintroMethods, uiSelectableButtonsMethods, aiAiStrategyMethods, aiEffect_useMethods, aiSgnAttitudeMethods, aiRankMethods];
const methodOrder = ["addNewRowList", "cardDescription", "cardsetion", "cardTranslation", "skillsFromEquips", "convertedCharacter", "inpileVCardList", "seatTranslation", "identityList", "objectURL", "cardNameLength", "yingbianConditions", "complexYingbianConditions", "simpleYingbianConditions", "yingbianEffects", "defaultYingbianEffect", "priority", "subtypes", "pinyin", "yunmu", "paramToCacheKey", "yunjiao", "skillCategoriesOf", "numOf", "connectNickname", "zhinangs", "characterSurname", "characterTitle", "sourceCharacter", "isLuckyStar", "infoHp", "infoMaxHp", "infoHujia", "bottomCards", "discarded", "cardOffset", "colorspan", "evtprompt", "autoViewAs", "_autoViewAs", "max", "min", "bingzhu", "character", "characterInitFilter", "characterIntro", "bordergroup", "groupnature", "sourceSkillFor", "sgn", "rand", "sort", "sortSeat", "zip", "delayx", "prompt", "prompt2", "url", "round", "playerNumber", "benchmark", "stringify", "copy", "plainText", "inpilefull", "inpile", "inpile2", "typeCard", "libCard", "ip", "modetrans", "charactersOL", "trimip", "mode", "idDialog", "arenaState", "skillState", "id", "zhu", "config", "coinCoeff", "rank", "skillRank", "targetsInfo", "infoTargets", "cardInfo", "cardsInfo", "infoCard", "infoCards", "vcardInfo", "vcardsInfo", "infoVCard", "infoVCards", "cardInfoOL", "infoCardOL", "cardsInfoOL", "infoCardsOL", "playerInfoOL", "infoPlayerOL", "playersInfoOL", "infoPlayersOL", "isFunctionParam", "isFunctionBody", "pureFunctionStr", "funcInfoOL", "infoFuncOL", "eventInfoOL", "infoEventOL", "vcardInfoOL", "vcardsInfoOL", "infoVCardOL", "infoVCardsOL", "mapInfoOL", "setInfoOL", "infoMapOL", "infoSetOL", "stringifiedResult", "parsedResult", "verticalStr", "numStr", "rawName", "rawName2", "slimNameHorizontal", "prefixSpan", "slimName", "time", "utc", "evtDistance", "xyDistance", "itemtype", "equipNum", "objtype", "type", "type2", "subtype", "equiptype", "name", "suit", "color", "number", "nature", "natureList", "canRespond", "hpColor", "cards", "judge", "judge2", "distance", "info", "select", "card", "event", "player", "players", "nameList", "position", "skillTranslation", "skillInfoTranslation", "translation", "menuZoom", "strNumber", "numString", "cnNumber", "iterableChildNodes", "selectableButtons", "selectableCards", "skills", "gainableSkills", "gainableSkillsName", "gainableCharacters", "selectableTargets", "filter", "cardCount", "skillCount", "owner", "noSelected", "population", "totalPopulation", "cardtag", "tag", "sortCard", "difficulty", "cardPile", "cardPile2", "discardPile", "aiStrategy", "skillintro", "intro", "storageintro", "nodeintro", "linkintro", "poptipIntro", "groups", "selectGroup", "types", "links", "threaten", "condition", "attitude", "sgnAttitude", "useful_raw", "useful", "unuseful", "unuseful2", "unuseful3", "value", "equipResult", "equipValue", "equipValueNumber", "disvalue", "disvalue2", "skillthreaten", "cacheOrder", "order", "result", "cacheEffectUse", "effect_use", "cacheEffect", "effect", "damageEffect", "dynamicVariable", "recoverEffect", "buttonValue", "attitude2", "zhuanhuanItemNum", "poptip", "skinPath", "relativePath", "dataUrlAsync", "objectUrlAsync", "blobFromUrl", "checkVersion", "coreInfo"];
export {
  methodGroups,
  methodOrder
};

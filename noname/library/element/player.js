import "../../../noname.js";
import { CacheContext } from "../cache/cacheContext.js";
import { installPlayerMethods } from "./Player/installPlayerMethods.js";
import "./Player/playerMethodsContract.js";
import { lifecycleBuildMethods } from "./Player/lifecycle/build.js";
import { characterInitMethods } from "./Player/lifecycle/characterInit.js";
import { characterReinitUninitMethods } from "./Player/lifecycle/characterReinitUninit.js";
import { showCharacterAndSkinMethods } from "./Player/lifecycle/showCharacterAndSkin.js";
import { onlineAndStateMethods } from "./Player/lifecycle/onlineAndState.js";
import { waitAndTimerMethods } from "./Player/lifecycle/waitAndTimer.js";
import { equipSlotQueryMethods } from "./Player/equip/slotQuery.js";
import { equipSlotControlMethods } from "./Player/equip/slotControl.js";
import { equipAreaMethods } from "./Player/equip/equipArea.js";
import { judgeAreaMethods } from "./Player/equip/judgeArea.js";
import { virtualEquipDomMethods } from "./Player/equip/virtualEquipDom.js";
import { virtualJudgeAndTriggerMethods } from "./Player/equip/virtualJudgeAndTrigger.js";
import { cardZoneQueryMethods } from "./Player/card/zoneQuery.js";
import { cardVisibilityAndConnectMethods } from "./Player/card/visibilityAndConnect.js";
import { cardHandAndSpecialMethods } from "./Player/card/handAndSpecial.js";
import { cardUsabilityMethods } from "./Player/card/usability.js";
import { cardAiEstimationMethods } from "./Player/card/aiEstimation.js";
import { cardUseAndRespondMethods } from "./Player/card/useAndRespond.js";
import { cardDrawAndDiscardMethods } from "./Player/card/drawAndDiscard.js";
import { cardGainAndExpansionMethods } from "./Player/card/gainAndExpansion.js";
import { cardLoseAndDirectMethods } from "./Player/card/loseAndDirect.js";
import { hpAndDamageMethods } from "./Player/status/hpAndDamage.js";
import { survivalAndBuffMethods } from "./Player/status/survivalAndBuff.js";
import { stateAndPredicatesMethods } from "./Player/status/stateAndPredicates.js";
import { identityAndProfileMethods } from "./Player/status/identityAndProfile.js";
import { friendsAndEnemiesMethods } from "./Player/status/friendsAndEnemies.js";
import { formationAndMajorMethods } from "./Player/status/formationAndMajor.js";
import { rangeAndSeatMethods } from "./Player/status/rangeAndSeat.js";
import { phaseMethods } from "./Player/choice/phase.js";
import { chooseActionMethods } from "./Player/choice/chooseAction.js";
import { compareAndCooperationMethods } from "./Player/choice/compareAndCooperation.js";
import { chooseButtonMethods } from "./Player/choice/chooseButton.js";
import { chooseCardAndTargetMethods } from "./Player/choice/chooseCardAndTarget.js";
import { chooseControlAndNumbersMethods } from "./Player/choice/chooseControlAndNumbers.js";
import { choosePlayerCardMethods } from "./Player/choice/choosePlayerCard.js";
import { moveAndMinigameMethods } from "./Player/choice/moveAndMinigame.js";
import { skillWhenMethods } from "./Player/skill/when.js";
import { skillQueryMethods } from "./Player/skill/query.js";
import { skillCoreMutationMethods } from "./Player/skill/coreMutation.js";
import { skillAdditionalAndTempMethods } from "./Player/skill/additionalAndTemp.js";
import { skillStateAndMechanicsMethods } from "./Player/skill/stateAndMechanics.js";
import { skillSubPlayerAndLogMethods } from "./Player/skill/subPlayerAndLog.js";
import { storageAndResourceMethods } from "./Player/storage/storageAndResource.js";
import { markCounterMethods } from "./Player/storage/markCounter.js";
import { markRenderMethods } from "./Player/storage/markRender.js";
import { historyAndStatsMethods } from "./Player/storage/historyAndStats.js";
import { renderAndAvatarMethods } from "./Player/animation/renderAndAvatar.js";
import { chatAndPromptMethods } from "./Player/animation/chatAndPrompt.js";
import { drawAndGainMethods } from "./Player/animation/drawAndGain.js";
import { compareAnimationMethods } from "./Player/animation/compare.js";
import { throwAnimationMethods } from "./Player/animation/throw.js";
import { throwOrderedMethods } from "./Player/animation/throwOrdered.js";
import { giveAndDiceMethods } from "./Player/animation/giveAndDice.js";
import { skillAndFlameMethods } from "./Player/animation/skillAndFlame.js";
import { popupsAndDeathMethods } from "./Player/animation/popupsAndDeath.js";
import { ui } from "../../ui/index.js";
import { lib } from "../index.js";
class Player extends HTMLDivElement {
  // @ts-expect-error Player delegates DOM creation to ui.create.div without calling super()
  constructor(position) {
    let resolvedPosition;
    if (position instanceof Player) {
      [resolvedPosition] = position._args;
    } else {
      resolvedPosition = position;
    }
    const player = ui.create.div(".player", resolvedPosition);
    Object.setPrototypeOf(player, (lib.element.Player || Player).prototype);
    player._args = [resolvedPosition];
    return player;
  }
  node;
  phaseNumber;
  skipList;
  extraEquip;
  skills;
  invisibleSkills;
  initedSkills;
  additionalSkills;
  disabledSkills;
  hiddenSkills;
  awakenedSkills;
  forbiddenSkills;
  popups;
  damagepopups;
  judging;
  stat;
  actionHistory;
  tempSkills;
  storage;
  marks;
  vcardsMap;
  expandedSlots;
  disabledSlots;
  ai;
  queueCount;
  outCount;
  maxHp;
  hp;
  hujia;
  seatNum;
  nextSeat;
  next;
  previousSeat;
  previous;
  name;
  name1;
  name2;
  tempname;
  junName;
  skinPath;
  sex;
  group;
  inits;
  _inits;
  isZhu;
  identity;
  identityShown;
  removed;
  tips;
  ws;
  updates;
}
installPlayerMethods(Player.prototype, [
  lifecycleBuildMethods,
  characterInitMethods,
  characterReinitUninitMethods,
  showCharacterAndSkinMethods,
  onlineAndStateMethods,
  waitAndTimerMethods,
  equipSlotQueryMethods,
  equipSlotControlMethods,
  equipAreaMethods,
  judgeAreaMethods,
  virtualEquipDomMethods,
  virtualJudgeAndTriggerMethods,
  cardZoneQueryMethods,
  cardVisibilityAndConnectMethods,
  cardHandAndSpecialMethods,
  cardUsabilityMethods,
  cardAiEstimationMethods,
  cardUseAndRespondMethods,
  cardDrawAndDiscardMethods,
  cardGainAndExpansionMethods,
  cardLoseAndDirectMethods,
  hpAndDamageMethods,
  survivalAndBuffMethods,
  stateAndPredicatesMethods,
  identityAndProfileMethods,
  friendsAndEnemiesMethods,
  formationAndMajorMethods,
  rangeAndSeatMethods,
  phaseMethods,
  chooseActionMethods,
  compareAndCooperationMethods,
  chooseButtonMethods,
  chooseCardAndTargetMethods,
  chooseControlAndNumbersMethods,
  choosePlayerCardMethods,
  moveAndMinigameMethods,
  skillWhenMethods,
  skillQueryMethods,
  skillCoreMutationMethods,
  skillAdditionalAndTempMethods,
  skillStateAndMechanicsMethods,
  skillSubPlayerAndLogMethods,
  storageAndResourceMethods,
  markCounterMethods,
  markRenderMethods,
  historyAndStatsMethods,
  renderAndAvatarMethods,
  chatAndPromptMethods,
  drawAndGainMethods,
  compareAnimationMethods,
  throwAnimationMethods,
  throwOrderedMethods,
  giveAndDiceMethods,
  skillAndFlameMethods,
  popupsAndDeathMethods
]);
CacheContext.inject(Player.prototype, [
  "hasCard",
  "hasCards",
  "hasDiscardableCards",
  "hasGainableCards",
  "hasConnectedCards",
  "hasShownCards",
  "hasKnownCards",
  "isAllCardsKnown",
  "hasValueTarget",
  "getModableSkills",
  "getCardIndex",
  "countCards",
  "countDiscardableCards",
  "countGainableCards",
  "countConnectedCards",
  "countShownCards",
  "countKnownCards",
  "getSkills",
  "getUseValue",
  "canUse"
]);
export {
  Player
};

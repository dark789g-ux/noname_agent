import "../../../../noname.js";
import { lib } from "../../index.js";
import { get } from "../../../get/binding.js";
import { game } from "../../../game/index.js";
import { ui } from "../../../ui/index.js";
import { _status } from "../../../status/index.js";
function createFilterTargets() {
  return {
    /**
     * 判断一张牌是否应包含在当前事件的AI选择中。
     *
     * @param { Card } card - 需要判断的牌
     * @returns { boolean }
     */
    cardAiIncluded(card) {
      const event = get.event();
      if (event.isMine()) {
        return true;
      }
      return event._aiexclude.includes(card) === false;
    },
    /**
     * 判断一张牌对某角色在指定事件中是否可被选择。
     *
     * @param { Card | VCard | CardBaseUIData } card - 需要判断的牌
     * @param { Player } [player] - 使用/发动此牌的角色。
     * @param { GameEvent } [event] - 当前事件上下文。
     * @returns { boolean }
     */
    filterCard(card, player, event) {
      const info = get.info(card);
      const currentPlayer = player ?? get.player();
      if (!currentPlayer) {
        return false;
      }
      if (!lib.filter.cardEnabled(card, currentPlayer, event) || !lib.filter.cardUsable(card, currentPlayer, event)) {
        return false;
      }
      if (info.notarget) {
        return true;
      }
      let range;
      const select = get.copy(info.selectTarget);
      if (select == null) {
        if (info.filterTarget == null) {
          return true;
        }
        range = [1, 1];
      } else if (typeof select === "number") {
        range = [select, select];
      } else if (get.itemtype(select) === "select") {
        range = select;
      } else if (typeof select === "function") {
        range = select(card, currentPlayer);
        if (typeof range === "number") {
          range = [range, range];
        }
      }
      game.checkMod(card, currentPlayer, range, "selectTarget", currentPlayer);
      if (!range || range[1] !== -1) {
        return true;
      }
      const filterTarget = event?.filterTarget || lib.filter.filterTarget;
      return game.hasPlayer2((current) => filterTarget(card, currentPlayer, current), true);
    },
    /**
     * 判断一张牌在当前选择事件中是否可以指定目标。
     *
     * 此函数在常规目标合法性前，额外校验当前事件中的牌可用性、使用次数和singleCard追加目标规则。
     *
     * @param { Card | VCard | CardBaseUIData } card - 需要判断的牌
     * @param { Player } player - 使用/指定此目标的角色
     * @param { Player } target - 被指定的目标角色
     * @returns { boolean }
     */
    targetEnabledx(card, player, target) {
      if (!card || !target || target.removed) {
        return false;
      }
      const info = get.info(card);
      if (!info?.deadTarget && target.isDead()) {
        return false;
      }
      if (!info?.includeOut && target.isOut()) {
        return false;
      }
      const event = _status.event;
      let evt = event.getParent("chooseToUse");
      if (get.itemtype(evt) !== "event") {
        evt = event;
      }
      if (event._backup && event._backup.filterCard === lib.filter.filterCard && (!lib.filter.cardEnabled(card, player, event) || !lib.filter.cardUsable(card, player, evt))) {
        return false;
      }
      if (event.addCount_extra) {
        const usableTarget = game.checkMod(card, player, target, false, "cardUsableTarget", player);
        if (!lib.filter.cardUsable2(card, player) && !usableTarget) {
          return false;
        }
      }
      if (info.singleCard && info.filterAddedTarget && ui.selected.targets.length) {
        return Boolean(info.filterAddedTarget(card, player, target, ui.selected.targets[ui.selected.targets.length - 1]));
      }
      return lib.filter.targetEnabled(card, player, target);
    },
    /**
     * 判断一张牌是否可以按常规规则指定目标。
     *
     * @param { Card | VCard | CardBaseUIData } card - 需要判断的牌
     * @param { Player } player - 使用/指定此目标的角色
     * @param { Player } target - 被指定的目标角色
     * @returns { boolean }
     */
    targetEnabled(card, player, target) {
      if (!card || !target || target.removed) {
        return false;
      }
      const info = get.info(card);
      if (!info?.deadTarget && target.isDead()) {
        return false;
      }
      if (!info?.includeOut && target.isOut()) {
        return false;
      }
      if (!info.singleCard || ui.selected.targets.length === 0) {
        const playerEnabled = game.checkMod(card, player, target, "unchanged", "playerEnabled", player);
        if (playerEnabled !== "unchanged") {
          return Boolean(playerEnabled);
        }
        const targetEnabled = game.checkMod(card, player, target, "unchanged", "targetEnabled", target);
        if (targetEnabled !== "unchanged") {
          return Boolean(targetEnabled);
        }
      }
      const filterTarget = info.filterTarget;
      if (typeof filterTarget === "boolean") {
        return filterTarget;
      }
      if (typeof filterTarget === "function") {
        return Boolean(filterTarget(card, player, target));
      }
      return false;
    },
    /**
     * 判断一张牌是否可以指定目标，或是否可通过牌的modTarget额外影响目标。
     *
     * @param { Card | VCard | CardBaseUIData } card - 需要判断的牌
     * @param { Player } player - 使用/指定此目标的角色
     * @param { Player } target - 被指定或额外影响的目标角色
     * @returns { boolean }
     */
    targetEnabled2(card, player, target) {
      if (!card || !target || target.removed) {
        return false;
      }
      const info = get.info(card);
      if (!info?.deadTarget && target.isDead()) {
        return false;
      }
      if (!info?.includeOut && target.isOut()) {
        return false;
      }
      if (lib.filter.targetEnabled(card, player, target)) {
        return true;
      }
      const playerEnabled = game.checkMod(card, player, target, "unchanged", "playerEnabled", player);
      if (playerEnabled === false) {
        return false;
      }
      const targetEnabled = game.checkMod(card, player, target, "unchanged", "targetEnabled", target);
      if (targetEnabled === false) {
        return false;
      }
      const modTarget = info.modTarget;
      if (typeof modTarget === "boolean") {
        return modTarget;
      }
      if (typeof modTarget === "function") {
        return Boolean(modTarget(card, player, target));
      }
      return false;
    },
    /**
     * 仅根据牌自身的filterTarget或modTarget定义判断目标是否可被涉及。
     *
     * @param { Card | VCard | CardBaseUIData } card - 需要判断的牌
     * @param { Player } player - 使用/指定此目标的角色
     * @param { Player } target - 被指定或涉及的目标角色
     * @returns { boolean }
     */
    targetEnabled3(card, player, target) {
      if (!card || !target || target.removed) {
        return false;
      }
      const info = get.info(card);
      if (!info?.deadTarget && target.isDead()) {
        return false;
      }
      if (!info?.includeOut && target.isOut()) {
        return false;
      }
      const { filterTarget, modTarget } = info;
      if (filterTarget === true) {
        return true;
      }
      if (typeof filterTarget === "function" && filterTarget(card, player, target)) {
        return true;
      }
      if (modTarget === true) {
        return true;
      }
      if (typeof modTarget === "function") {
        return Boolean(modTarget(card, player, target));
      }
      return false;
    },
    /**
     * 判断目标是否满足一张牌的距离范围限制。
     *
     * @param { Card | VCard | CardBaseUIData } card - 需要判断的牌
     * @param { Player } player - 使用/指定此目标的角色
     * @param { Player } target - 被指定的目标角色
     * @returns { boolean }
     */
    targetInRange(card, player, target) {
      const info = get.info(card);
      const { range, outrange } = info;
      const hasRange = range != null;
      const hasOutrange = outrange != null;
      if (!hasRange && !hasOutrange) {
        return true;
      }
      const mod = game.checkMod(card, player, target, "unchanged", "targetInRange", player);
      let extra = 0;
      if (mod !== "unchanged") {
        if (typeof mod === "boolean") {
          return mod;
        }
        if (typeof mod === "number") {
          extra = mod;
        }
      }
      if (typeof range === "function") {
        return Boolean(range(card, player, target));
      }
      if (player.hasSkill("undist") || target.hasSkill("undist")) {
        return false;
      }
      for (const type in range ?? {}) {
        if (type === "attack") {
          const attackRange = player.getAttackRange();
          if (attackRange <= 0) {
            return false;
          }
          const distance = get.distance(player, target) + extra;
          if (range[type] <= distance - attackRange) {
            return false;
          }
        } else {
          const distance = get.distance(player, target, type) + extra;
          if (range[type] < distance) {
            return false;
          }
        }
      }
      for (const type in outrange ?? {}) {
        if (type === "attack") {
          const attackRange = player.getAttackRange();
          if (attackRange <= 0) {
            return false;
          }
          const distance = get.distance(player, target) + extra;
          if (outrange[type] > distance - attackRange + 1) {
            return false;
          }
        } else {
          const distance = get.distance(player, target, type) + extra;
          if (outrange[type] > distance) {
            return false;
          }
        }
      }
      return true;
    },
    /**
     * 判断是否可指定目标，且目标处于使用距离内。
     *
     * @param { Card | VCard | CardBaseUIData } card - 使用的牌
     * @param { Player } player - 使用牌的角色
     * @param { Player } target - 被指定的目标角色
     * @returns { boolean }
     */
    filterTarget(card, player, target) {
      return lib.filter.targetEnabledx(card, player, target) && lib.filter.targetInRange(card, player, target);
    },
    /**
     * 判断是否可通过常规或额外目标规则指定目标，且目标处于使用距离内。
     *
     * @param { Card | VCard | CardBaseUIData } card - 使用的牌
     * @param { Player } player - 使用牌的角色
     * @param { Player } target - 被指定的目标角色
     * @returns { boolean }
     */
    filterTarget2(card, player, target) {
      return lib.filter.targetEnabled2(card, player, target) && lib.filter.targetInRange(card, player, target);
    },
    /**
     * 判断目标是否不是使用者自身。
     *
     * @param { Card | VCard | CardBaseUIData } card - 当前牌
     * @param { Player } player - 使用牌的角色
     * @param { Player } target - 被判断的目标角色
     * @returns { boolean }
     */
    notMe(card, player, target) {
      return player !== target;
    },
    /**
     * 判断目标是否为使用者自身。
     *
     * @param { Card | VCard | CardBaseUIData } card - 当前牌
     * @param { Player } player - 使用牌的角色
     * @param { Player } target - 被判断的目标角色
     * @returns { boolean }
     */
    isMe(card, player, target) {
      return player === target;
    }
  };
}
export {
  createFilterTargets
};

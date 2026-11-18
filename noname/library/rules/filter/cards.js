import "../../../../noname.js";
import { ui } from "../../../ui/index.js";
import { _status } from "../../../status/index.js";
import { lib } from "../../index.js";
import { game } from "../../../game/index.js";
import { get } from "../../../get/binding.js";
function createFilterCards() {
  return {
    /**
     * 判断目标与使用者的攻击距离是否至多为 1。
     *
     * @param { Card | VCard | CardBaseUIData } card - 当前牌
     * @param { Player } player - 使用牌的角色
     * @param { Player } target - 被判断的目标角色
     * @returns { boolean }
     */
    attackFrom(card, player, target) {
      return get.distance(player, target, "attack") <= 1;
    },
    /**
     * 判断目标与使用者的全局距离是否至多为 1。
     *
     * @param { Card | VCard | CardBaseUIData } card - 当前牌
     * @param { Player } player - 使用牌的角色
     * @param { Player } target - 被判断的目标角色
     * @returns { boolean }
     */
    globalFrom(card, player, target) {
      return get.distance(player, target) <= 1;
    },
    /**
     * 返回默认选牌数量范围。
     *
     * @returns { [number, number] }
     */
    selectCard() {
      return [1, 1];
    },
    /**
     * 返回可选择目标数量的范围。
     *
     * @param { Card | VCard | CardBaseUIData } [card] - 待使用的牌，默认取当前牌
     * @param { Player } [player] - 使用牌的角色，默认取当前角色
     * @returns { [number, number] | undefined }
     */
    selectTarget(card, player) {
      if (!card) {
        card = get.card();
      }
      const currentPlayer = player ?? get.player();
      if (card == null) {
        return;
      }
      if (!currentPlayer) {
        return;
      }
      let range;
      const info = get.info(card);
      const select = get.copy(info.selectTarget);
      if (select === void 0 || select === null) {
        if (info.filterTarget === void 0 || info.filterTarget === null) {
          return [0, 0];
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
      if (info.singleCard && info.filterAddedTarget) {
        return [range[0] * 2, range[1] * 2];
      }
      return range;
    },
    /**
     * 判断一张延时锦囊/判定牌是否可以置入目标判定区。
     *
     * @param { Card | VCard | CardBaseUIData } card - 需要判断的牌
     * @param { Player } player - 使用/置入此牌的角色
     * @param { Player } target - 被置入判定区的目标角色
     * @returns { boolean }
     */
    judge(card, player, target) {
      if (!target.canAddJudge(card, player)) {
        return false;
      }
      const playerEnabled = game.checkMod(card, player, target, "unchanged", "playerEnabled", player);
      if (playerEnabled !== "unchanged") {
        return Boolean(playerEnabled);
      }
      const targetEnabled = game.checkMod(card, player, target, "unchanged", "targetEnabled", target);
      if (targetEnabled !== "unchanged") {
        return Boolean(targetEnabled);
      }
      return true;
    },
    /**
     * 判断当前响应事件是否应自动跳过出杀。
     *
     * @this {{ player: Player }}
     * @returns { boolean }
     */
    autoRespondSha() {
      return !this.player.hasSha("respond");
    },
    /**
     * 判断当前响应事件是否应自动跳过出闪。
     *
     * @this {{ player: Player }}
     * @returns { boolean }
     */
    autoRespondShan() {
      return !this.player.hasShan("respond");
    },
    /**
     * 判断无懈响应事件是否应跳过自动切换控制角色。
     *
     * @param { GameEvent } event - 当前响应事件
     * @returns { boolean }
     */
    wuxieSwap(event) {
      if (event.type !== "wuxie") {
        return false;
      }
      if (ui.wuxie?.classList.contains("glow")) {
        return true;
      }
      if (ui.tempnowuxie?.classList.contains("glow") && event.state > 0) {
        const triggerEvent = event.getTrigger();
        if (triggerEvent) {
          const parent = triggerEvent.parent;
          if (!parent) {
            throw new TypeError("wuxie trigger requires a parent event");
          }
          if (ui.tempnowuxie._origin === parent.id) {
            return true;
          }
        } else if (ui.tempnowuxie._origin === _status.event.id2) {
          return true;
        }
      }
      if (!lib.config.wuxie_self) {
        return false;
      }
      const infoMap = event.info_map;
      return Boolean(infoMap.player && infoMap.player.isUnderControl(true) && !infoMap.player.hasSkillTag("noautowuxie") && (!infoMap.targets || infoMap.targets.length <= 1) && !infoMap.noai);
    }
  };
}
export {
  createFilterCards
};

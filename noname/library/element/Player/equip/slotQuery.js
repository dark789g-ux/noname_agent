import "../../../../../noname.js";
import { get } from "../../../../get/binding.js";
import { lib } from "../../../index.js";
import { game } from "../../../../game/index.js";
const equipSlotQueryMethods = {
  /**
   * 添加视为装备
   * @param skill 视为装备的技能
   * @param equip 视为装备的牌名
   * @param replace 是否清除该skill原有视为装备
   * @param preserve 视为装备的条件,用于八阵类视为装备
   */
  addExtraEquip(skill, equip, replace = false, preserve) {
    const player = this;
    if (replace) {
      player.removeExtraEquip(skill);
    }
    let list;
    if (typeof equip == "string") {
      list = [[skill, equip, preserve]];
    } else {
      list = equip.map((card) => [skill, card, preserve]);
    }
    player.extraEquip.addArray(list);
    player.$handleEquipChange();
    game.broadcast(
      (player2, list2) => {
        player2.extraEquip.addArray(list2);
        player2.$handleEquipChange();
      },
      player,
      list
    );
  },
  /**
   * 移除视为装备
   * @param skill 移除的技能
   * @param equip 移除的装备
   */
  removeExtraEquip(skill, equip = "noequip") {
    const player = this;
    let equips;
    if (equip != "noequip") {
      const equipList = typeof equip == "string" ? [equip] : equip;
      equips = player.extraEquip.filter((info) => info[0] != skill || !equipList.includes(info[1]));
    } else {
      equips = player.extraEquip.filter((info) => info[0] != skill);
    }
    player.extraEquip = equips;
    player.$handleEquipChange();
    game.broadcast(
      (player2, equips2) => {
        player2.extraEquip = equips2;
        player2.$handleEquipChange();
      },
      player,
      equips
    );
  },
  /**
   * 判断一名角色的某个区域是否被废除
   *
   * type为要判断的区域 若为空 则判断玩家是否有任意一个被废除的区域
   */
  hasDisabledSlot(type) {
    if (type == "horse" || type == "equip3_4") {
      return this.hasDisabledSlot(3) && (get.is.mountCombined() || this.hasDisabledSlot(4));
    } else if (get.is.mountCombined() && type == "equip4") {
      return false;
    }
    return this.countDisabledSlot(type) > 0;
  },
  /**
   * 判断一名角色的某个区域被废除的数量
   *
   * 用法同 {@link hasDisabledSlot}
   */
  countDisabledSlot(type) {
    const map = this.disabledSlots || {};
    let num;
    if (type == void 0) {
      num = 0;
      for (let i = 1; i <= 5; i++) {
        num += this.countDisabledSlot(i);
      }
      return num;
    } else {
      if (typeof type == "number") {
        type = "equip" + type;
      }
      if (get.is.mountCombined() && type == "equip4") {
        return 0;
      }
      num = map[type];
      if (typeof num == "number" && num > 0) {
        return num;
      }
      return 0;
    }
  },
  /**
   * 判断一名角色是否有某个装备栏空着
   */
  hasEmptySlot(type) {
    if (type == "horse" || type == "equip3_4") {
      return this.hasEmptySlot(3) && (get.is.mountCombined() || this.hasEmptySlot(4));
    } else if (get.is.mountCombined() && type == "equip4") {
      return false;
    }
    return this.countEmptySlot(type) > 0;
  },
  /**
   * 判断一名角色的某个装备栏空位的数量
   */
  countEmptySlot(type) {
    if (!type) {
      return 0;
    }
    let slotType;
    if (typeof type == "number") {
      slotType = "equip" + type;
    } else if (type == "equip3_4") {
      slotType = "equip3";
    } else {
      slotType = type;
    }
    return Math.max(
      0,
      this.countEnabledSlot(slotType) - this.getVEquips(slotType).reduce((num, card) => {
        const types = get.subtypes(card, false);
        return num + get.numOf(types, slotType);
      }, 0)
    );
  },
  /**
   * 判断一名角色是否有可以用于装备新装备牌的区域（排除金箍棒和六龙等“不可被替换装备”）
   *
   * 用法同 {@link hasEnabledSlot}
   */
  hasEquipableSlot(type) {
    return this.countEquipableSlot(type) > 0;
  },
  /**
   * 统计一名角色有多少个可以用于装备新的装备牌的区域
   *
   * 用法同 {@link hasEnabledSlot}
   */
  countEquipableSlot(type) {
    if (!type) {
      return 0;
    }
    let slotType;
    if (typeof type == "number") {
      slotType = "equip" + type;
    } else if (type == "equip3_4") {
      slotType = "equip3";
    } else if (get.is.mountCombined() && type == "equip4") {
      return 0;
    } else {
      slotType = type;
    }
    return Math.max(
      0,
      this.countEnabledSlot(slotType) - this.getVEquips(slotType).reduce((num, card) => {
        const types = get.subtypes(card, false);
        if (!lib.filter.canBeReplaced(card, this)) {
          num += get.numOf(types, slotType);
        }
        return num;
      }, 0)
    );
  },
  /**
   * 判断一名角色是否拥有未被废除的某个区域
   *
   * type为要判断的区域 若为空 则判断玩家是否有任意一个未被废除的区域
   */
  hasEnabledSlot(type) {
    if (type == "horse" || type == "equip3_4") {
      return this.hasEnabledSlot(3) && (get.is.mountCombined() || this.hasEnabledSlot(4));
    } else if (get.is.mountCombined() && type == "equip4") {
      return false;
    }
    return this.countEnabledSlot(type) > 0;
  },
  /**
   * 判断一名角色的某个区域未被废除的数量
   *
   * 用法同 {@link hasEnabledSlot}
   */
  countEnabledSlot(type) {
    const map = this.expandedSlots || {};
    let num;
    if (!type) {
      num = 0;
      for (let i = 1; i <= 5; i++) {
        num += this.countEnabledSlot(i);
      }
      return num;
    } else {
      if (typeof type == "number") {
        type = "equip" + type;
      }
      if (get.is.mountCombined() && type == "equip4") {
        return 0;
      }
      let slots = 1;
      num = map[type];
      if (typeof num == "number" && num > 0) {
        slots += num;
      }
      slots -= this.countDisabledSlot(type);
      return slots;
    }
  },
  /**
   * @deprecated
   */
  countDisabled() {
    return this.countDisabledSlot(...arguments);
  },
  /**
   * @deprecated
   */
  isDisabled(arg) {
    return this.hasDisabledSlot(arg) && !this.hasEnabledSlot(arg);
  },
  /**
   * @deprecated
   */
  isEmpty(num) {
    return this.countEnabledSlot(num) > this.getVEquips(num).length;
  }
};
export {
  equipSlotQueryMethods
};

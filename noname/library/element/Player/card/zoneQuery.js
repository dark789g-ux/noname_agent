import "../../../../../noname.js";
import "../contracts/cardContract.js";
import { get } from "../../../../get/binding.js";
import { lib } from "../../../index.js";
const cardZoneQueryMethods = {
  *iterableGetVCards(arg1, arg2) {
    if (typeof arg1 != "string") {
      arg1 = "h";
    }
    const getCardName = (card) => {
      return get.name(card, false);
    };
    let filter = () => true;
    if (arg2) {
      if (typeof arg2 == "string") {
        const targetName = arg2;
        filter = (card) => getCardName(card) == targetName;
      } else if (Array.isArray(arg2)) {
        const targetNames = arg2;
        filter = (card) => targetNames.includes(getCardName(card));
      } else if (typeof arg2 == "object") {
        const filterObj = arg2;
        filter = (card) => {
          for (let j in filterObj) {
            let value;
            if (j == "type" || j == "subtype" || j == "color" || j == "suit" || j == "number") {
              value = get[j](card);
            } else if (j == "name") {
              value = getCardName(card);
            } else {
              value = card[j];
            }
            if (typeof filterObj[j] == "string" && value != filterObj[j] || Array.isArray(filterObj[j]) && !filterObj[j].includes(value)) {
              return false;
            }
          }
          return true;
        };
      } else if (typeof arg2 == "function") {
        filter = arg2;
      }
    }
    for (let i = 0; i < arg1.length; i++) {
      if (arg1[i] == "h") {
        for (let card of this.vcardsMap?.handcards ?? []) {
          if (filter(card)) {
            yield card;
          }
        }
      } else if (arg1[i] == "e") {
        for (let card of this.vcardsMap?.equips ?? []) {
          if (filter(card)) {
            yield card;
          }
        }
      } else if (arg1[i] == "j") {
        for (let card of this.vcardsMap?.judges ?? []) {
          if (filter(card)) {
            yield card;
          }
        }
      }
    }
  },
  getVCards(arg1, arg2) {
    return Array.from(this.iterableGetVCards(arg1, arg2));
  },
  countVCards(arg1, arg2) {
    let count = 0;
    for (let item of this.iterableGetVCards(arg1, arg2)) {
      count++;
    }
    return count;
  },
  *iterableGetCards(position, filter) {
    if (typeof position != "string") {
      position = "h";
    }
    const judgesNode = this.node.judges;
    const getCardName = (card) => {
      if (card.parentNode == judgesNode) {
        if (card.viewAs) {
          return card.viewAs;
        }
      }
      return get.name(card);
    };
    let filterCard;
    if (filter) {
      if (typeof filter == "string") {
        const targetName = filter;
        filterCard = (card) => getCardName(card) == targetName;
      } else if (Array.isArray(filter)) {
        const targetNames = filter;
        filterCard = (card) => targetNames.includes(getCardName(card));
      } else if (typeof filter == "object") {
        const entries = [];
        for (const key in filter) {
          let getter;
          if (key == "type" || key == "subtype" || key == "color" || key == "suit" || key == "number") {
            getter = get[key];
          } else if (key == "name") {
            getter = getCardName;
          } else {
            getter = null;
          }
          const filterVal = filter[key];
          entries.push({
            key,
            getter,
            filterVal,
            isArray: Array.isArray(filterVal)
          });
        }
        filterCard = (card) => {
          for (const { key, getter, filterVal, isArray } of entries) {
            const value = getter ? getter(card) : card[key];
            if (!isArray && value != filterVal || isArray && !filterVal.includes(value)) {
              return false;
            }
          }
          return true;
        };
      } else if (typeof filter == "function") {
        filterCard = filter;
      }
    }
    let hasH = false;
    let hasS = false;
    for (const pos of position) {
      switch (pos) {
        case "h":
          hasH = true;
          break;
        case "s":
          hasS = true;
          break;
      }
    }
    const needGlowsCheck = hasH !== hasS;
    let handDone = false;
    let equipDone = false;
    let judgeDone = false;
    let expandDone = false;
    for (const pos of position) {
      switch (pos) {
        case "h":
        case "s": {
          if (handDone) {
            break;
          }
          handDone = true;
          const hc1 = this.node.handcards1;
          const hc2 = this.node.handcards2;
          if (needGlowsCheck) {
            for (const card of get.iterableChildNodes(hc1, hc2)) {
              if (!(card instanceof lib.element.Card)) {
                continue;
              }
              if (card.classList.contains("removing")) {
                continue;
              }
              const glows = card.classList.contains("glows");
              if (hasH && !glows || hasS && glows) {
                if (!filterCard || filterCard(card)) {
                  yield card;
                }
              }
            }
          } else {
            for (const card of get.iterableChildNodes(hc1, hc2)) {
              if (!(card instanceof lib.element.Card)) {
                continue;
              }
              if (card.classList.contains("removing")) {
                continue;
              }
              if (!filterCard || filterCard(card)) {
                yield card;
              }
            }
          }
          break;
        }
        case "e": {
          if (equipDone) {
            break;
          }
          equipDone = true;
          const equips = this.node.equips;
          for (const card of get.iterableChildNodes(equips)) {
            if (!(card instanceof lib.element.Card)) {
              continue;
            }
            if (card.classList.contains("removing") || card.classList.contains("feichu") || card.classList.contains("emptyequip")) {
              continue;
            }
            if (!filterCard || filterCard(card)) {
              yield card;
            }
          }
          break;
        }
        case "j": {
          if (judgeDone) {
            break;
          }
          judgeDone = true;
          for (const card of get.iterableChildNodes(judgesNode)) {
            if (!(card instanceof lib.element.Card)) {
              continue;
            }
            if (card.classList.contains("removing") || card.classList.contains("feichu")) {
              continue;
            }
            if (!filterCard || filterCard(card)) {
              yield card;
            }
          }
          break;
        }
        case "x": {
          if (expandDone) {
            break;
          }
          expandDone = true;
          const expansions = this.node.expansions;
          for (const card of get.iterableChildNodes(expansions)) {
            if (!(card instanceof lib.element.Card)) {
              continue;
            }
            if (card.classList.contains("removing")) {
              continue;
            }
            if (!filterCard || filterCard(card)) {
              yield card;
            }
          }
          break;
        }
      }
    }
  },
  getCards(position, filter) {
    return Array.from(this.iterableGetCards(position, filter));
  },
  *iterableGetDiscardableCards(player, position, filter) {
    for (const card of this.iterableGetCards(position, filter)) {
      if (lib.filter.canBeDiscarded(card, player, this)) {
        yield card;
      }
    }
  },
  getDiscardableCards(player, position, filter) {
    return Array.from(this.iterableGetDiscardableCards(player, position, filter));
  },
  *iterableGetGainableCards(player, position, filter) {
    for (const card of this.iterableGetCards(position, filter)) {
      if (lib.filter.canBeGained(card, player, this)) {
        yield card;
      }
    }
  },
  getGainableCards(player, position, filter) {
    return Array.from(this.iterableGetGainableCards(player, position, filter));
  },
  countCards(position, filter) {
    let count = 0;
    for (const _ of this.iterableGetCards(position, filter)) {
      ++count;
    }
    return count;
  },
  getCardIndex(arg1, name, card, max) {
    let count = 0;
    for (let item of this.iterableGetCards(arg1)) {
      if (get.name(item) == name) {
        if (card == item) {
          return count;
        }
        count++;
        if (max !== void 0 && count >= max) {
          return count;
        }
      }
    }
    return -1;
  },
  countDiscardableCards(player, position, filter) {
    let count = 0;
    for (const _ of this.iterableGetDiscardableCards(player, position, filter)) {
      ++count;
    }
    return count;
  },
  countGainableCards(player, position, filter) {
    let count = 0;
    for (const _ of this.iterableGetGainableCards(player, position, filter)) {
      ++count;
    }
    return count;
  },
  hasCards(position, filter) {
    for (const _ of this.iterableGetCards(position, filter)) {
      return true;
    }
    return false;
  },
  hasDiscardableCards(player, position, filter) {
    for (const _ of this.iterableGetDiscardableCards(player, position, filter)) {
      return true;
    }
    return false;
  },
  hasGainableCards(player, position, filter) {
    for (const _ of this.iterableGetGainableCards(player, position, filter)) {
      return true;
    }
    return false;
  },
  hasCard(pattern, position) {
    for (const _ of this.iterableGetCards(position, pattern)) {
      return true;
    }
    return false;
  },
  hasVCard(name, position) {
    if (typeof name == "function") {
      for (let card of this.iterableGetVCards(position, name)) {
        return true;
      }
    } else {
      if (this.countVCards(position, name)) {
        return true;
      }
    }
    return false;
  }
};
export {
  cardZoneQueryMethods
};

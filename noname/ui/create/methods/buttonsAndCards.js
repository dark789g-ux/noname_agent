import "../../../../noname.js";
import { requireOnFree } from "../../../library/init/onfree.js";
import { ui } from "../../index.js";
import { get } from "../../../get/binding.js";
import { _status } from "../../../status/index.js";
import { lib } from "../../../library/index.js";
import { game } from "../../../game/index.js";
const buttonsAndCardsMethods = {
  prebutton(item, type, position, noclick) {
    const node = Object.assign(ui.create.div(position), { link: item });
    node.style.display = "none";
    node.activate = function() {
      ui.create.button(item, type, position, noclick, node);
      delete node.activate;
    };
    const prebuttons = _status.prebutton;
    if (prebuttons) {
      prebuttons.push(node);
    }
    return node;
  },
  button(item, type, position, noClick, button) {
    return new lib.element.Button(item, type, position, noClick, button);
  },
  buttons(list, type, position, noclick, _zoom) {
    const buttons = [];
    const pre = typeof type == "string" && type.slice(0, 3) == "pre";
    if (pre) {
      if (!_status.prebutton) {
        _status.prebutton = [];
        requireOnFree(lib.onfree).push(function() {
          const prebuttons = _status.prebutton;
          if (!prebuttons) {
            return;
          }
          for (let i = 0; i < prebuttons.length; i++) {
            prebuttons[i].activate?.();
          }
          delete _status.prebutton;
        });
      }
    }
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < list.length; i++) {
      if (pre) {
        buttons.push(ui.create.prebutton(list[i], type.slice(3), fragment, noclick));
      } else {
        buttons.push(ui.create.button(list[i], type, fragment, noclick));
      }
    }
    if (position) {
      position.appendChild(fragment);
    }
    return buttons;
  },
  textbuttons(list, dialog, noclick) {
    for (const item of list) {
      let str;
      let link;
      if (Array.isArray(item)) {
        str = item[1];
        link = item[0];
      } else {
        str = item;
        link = item;
      }
      if (!str.startsWith("<div")) {
        str = '<div class="popup text textbutton">' + str + "</div>";
      }
      const next = dialog.add(str);
      const firstChild = next instanceof HTMLElement ? next.firstChild : null;
      if (firstChild) {
        if (!noclick) {
          firstChild.addEventListener(lib.config.touchscreen ? "touchend" : "click", ui.click.button);
        }
        firstChild.link = link;
      }
      Object.setPrototypeOf(next, lib.element.Button.prototype);
      dialog.buttons.add(firstChild);
    }
  },
  card(position, info, noclick) {
    return new lib.element.Card(position).build(info, noclick);
  },
  cardsAsync(ordered) {
    if (lib.onfree) {
      _status.waitingForCards = [ordered];
      lib.onfree.push(function() {
        if (_status.waitingForCards) {
          ui.create.cards(_status.waitingForCards[0]);
          delete _status.waitingForCards;
        }
      });
    } else {
      ui.create.cards(ordered);
    }
  },
  cards(ordered) {
    if (_status.brawl) {
      if (_status.brawl.cardPile) {
        lib.card.list = _status.brawl.cardPile(lib.card.list);
      }
      if (_status.brawl.orderedPile) {
        ordered = true;
      }
    }
    if (!ordered) {
      lib.card.list.randomSort();
    }
    const isReplaced = (entry) => Boolean(entry._replaced);
    for (let i = 0; i < lib.card.list.length; i++) {
      if (lib.card[lib.card.list[i][2]]) {
        if (!isReplaced(lib.card.list[i])) {
          if (!_status.connectMode) {
            if (lib.config.bannedcards.includes(lib.card.list[i][2])) {
              continue;
            }
          } else {
            if (lib.configOL.bannedcards.includes(lib.card.list[i][2])) {
              continue;
            }
          }
          if (game.bannedcards && game.bannedcards.includes(lib.card.list[i][2])) {
            continue;
          }
        }
        lib.inpile.add(lib.card.list[i][2]);
        const nature = lib.card.list[i].slice(3)[0];
        if (lib.card.list[i][2] == "sha" && nature) {
          lib.inpile_nature.add(nature);
        }
        ui.create.card(ui.cardPile).init(lib.card.list[i]);
      }
    }
    lib.inpile.sort(lib.sort.card);
    const natures = Array.from(lib.nature.keys());
    lib.inpile_nature.sort(function(a, b) {
      return natures.indexOf(a) - natures.indexOf(b);
    });
    for (const i in _status.cardtag) {
      if (!_status.cardtag[i].length) {
        delete _status.cardtag[i];
      }
    }
    game.broadcastAll(
      function(num, pile, top, cardtag, inpile2) {
        if (ui.cardPileNumber) {
          ui.cardPileNumber.innerHTML = "0轮 剩余牌: " + num;
        }
        lib.inpile = pile;
        _status.pileTop = top;
        _status.cardtag = cardtag;
        lib.inpile_nature = inpile2;
      },
      ui.cardPile.childNodes.length,
      lib.inpile,
      ui.cardPile.firstChild,
      _status.cardtag,
      lib.inpile_nature
    );
  },
  /**
   * 创建手牌容器
   */
  handcardsContainer(cards, position, _options) {
    const container = Object.assign(ui.create.div(".handcards-container", position), {
      buttons: new Array(0),
      destroyContainer() {
      },
      clearCards() {
      },
      addCards(_cards, _noClear) {
      },
      removeCards(_cards) {
      }
    });
    const wheelCards = (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };
    container.addEventListener("wheel", wheelCards, { passive: false });
    const activateCards = (e) => {
      const target = e.target;
      const card = target?.closest(".handcards-container > .card");
      if (!card) {
        return;
      }
      const isActive = card.classList.contains("card-active");
      Array.from(container.children).forEach((child) => {
        child.classList.remove("card-active");
      });
      if (!isActive) {
        card.classList.add("card-active");
      }
      e.stopPropagation();
    };
    container.addEventListener("touchstart", activateCards);
    container.destroyContainer = function() {
      this.removeEventListener("wheel", wheelCards);
      this.removeEventListener("touchstart", activateCards);
      this.delete();
    };
    container.clearCards = function() {
      this.buttons = [];
      if (typeof this.replaceChildren == "function") {
        this.replaceChildren();
      } else {
        while (this.firstChild) {
          this.removeChild(this.firstChild);
        }
      }
    };
    container.addCards = function(cards2, noClear) {
      const currentButtons = this.buttons;
      if (currentButtons.length == cards2.length && (cards2.length == 0 || currentButtons.every((button, index) => {
        const card = cards2[index];
        const linkedCard = button.link;
        const tempName = "_tempName" in button && button._tempName && typeof button._tempName == "object" && "tempname" in button._tempName ? button._tempName.tempname : void 0;
        return linkedCard == card && linkedCard.name == card.name && linkedCard.number == card.number && linkedCard.suit == card.suit && linkedCard.node.gaintag.innerHTML == card.node.gaintag.innerHTML && (get.name(card) !== card.name || !get.is.sameNature(get.nature(card), card.nature, true) ? tempName == get.translation(get.nature(card) || "") + get.translation(get.name(card)) : true);
      }))) {
        return;
      }
      if (!noClear) {
        this.clearCards();
      }
      const num = cards2.length;
      if (num) {
        const buttons = ui.create.buttons(cards2, "card", container);
        container.buttons = buttons;
        let marginRight = "0";
        let isShrink = true;
        const cardWidth = (buttons[0].offsetWidth || 90) + 6;
        const minShrinkWidth = 60 * ((buttons[0].offsetWidth || 90) / 90);
        const containerWidth = container.offsetWidth;
        if (num * cardWidth <= containerWidth) {
          marginRight = "0";
          isShrink = false;
        } else {
          const neededWidth = num * (cardWidth - minShrinkWidth) + minShrinkWidth;
          if (neededWidth > containerWidth) {
            marginRight = `-${minShrinkWidth}px`;
          } else {
            marginRight = `-${cardWidth - (containerWidth - cardWidth) / (num - 1)}px`;
          }
        }
        buttons.forEach((button, index) => {
          button.style.setProperty("margin-right", marginRight);
          if (isShrink && "node" in button && button.node && typeof button.node == "object" && "info" in button.node && "name" in button.node) {
            const info = button.node.info;
            const name = button.node.name;
            if (info instanceof HTMLElement && name instanceof HTMLElement) {
              info.style.setProperty("transform", "translateX(-52px) translateY(-3px)", "important");
              name.style.setProperty("transform", "translateY(14px)", "important");
            }
          }
          const card = cards2[index];
          if (get.name(card) !== card.name || !get.is.sameNature(get.nature(card), card.nature, true)) {
            const nature = get.nature(card);
            ui.create.cardTempName({ name: get.name(card), nature }, button);
          }
        });
      } else {
        container.buttons = [];
      }
    };
    container.removeCards = function(cards2) {
      if (!cards2?.length) {
        return;
      }
      for (const button of this.buttons.slice()) {
        if (cards2.includes(button.link)) {
          this.buttons.remove(button);
          button.remove();
        }
      }
    };
    if (cards?.length) {
      container.addCards(cards);
    }
    return container;
  }
};
export {
  buttonsAndCardsMethods
};

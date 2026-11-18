import "../../../../noname.js";
import { fetchDeckMonitorResult } from "./deckMonitorResult.js";
import { get } from "../../../get/binding.js";
import { ui } from "../../index.js";
import { lib } from "../../../library/index.js";
import { _status } from "../../../status/index.js";
import { game } from "../../../game/index.js";
function handleColor(str) {
  const red = `[${get.translation("diamond")}${get.translation("heart")}]`;
  const black = `[${get.translation("club")}${get.translation("spade")}]`;
  return str.replace(new RegExp(red, "g"), '<span style="color:red">$&</span>').replace(new RegExp(black, "g"), '<span style="color:black">$&</span>');
}
function createColumnContainer(contentContainer, result, title, count) {
  const column = ui.create.div(".columnContainer", contentContainer);
  const subtitle = ui.create.div(".subtitle", column);
  subtitle.textContent = `${title}(${count})`;
  const itemContainer = ui.create.div(".itemContainer", column);
  for (const key in result) {
    const list = result[key] || [];
    const item = ui.create.div(".item", itemContainer);
    const tip = ui.create.div(".tip", item);
    tip.innerHTML = handleColor(
      list.reduce((a, c) => {
        return a + `${get.translation(get.suit(c))}${get.number(c)} `;
      }, "")
    );
    item.addEventListener("mouseenter", function() {
      if (tip.innerHTML == "") {
        return;
      }
      tip.style.display = "block";
      const rect = item.getBoundingClientRect();
      if (rect.top < window.innerHeight / 2) {
        tip.style.top = "110%";
      } else {
        tip.style.bottom = "110%";
      }
    });
    item.addEventListener("mouseleave", function() {
      tip.style.display = "none";
    });
    const itemName = ui.create.div(".itemName", item);
    const itemCount = ui.create.div(".itemCount", item);
    itemName.innerHTML = handleColor(get.translation(key));
    itemCount.textContent = `×${list.length}`;
  }
}
function renderNumberColumn(contentContainer, cards) {
  const missingNumber = "__missing_number__";
  const numberResult = Object.groupBy(cards, (card) => {
    const number = get.number(card);
    return number == null ? missingNumber : number;
  });
  delete numberResult[missingNumber];
  for (let i = 1; i <= 13; i++) {
    if (!numberResult[i]) {
      numberResult[i] = [];
    }
  }
  createColumnContainer(contentContainer, numberResult, "点数", cards.length);
}
function renderSuitColumn(contentContainer, cards) {
  const missingSuit = "__missing_suit__";
  const suitResult = Object.groupBy(cards, (card) => {
    const suit = get.suit(card);
    return suit == null ? missingSuit : suit;
  });
  Object.assign(
    suitResult,
    Object.groupBy(cards, (card) => {
      const number = get.number(card);
      if (get.suit(card) == "spade" && typeof number == "number" && number <= 9 && number >= 2) {
        return "♠2-9";
      }
      return missingSuit;
    })
  );
  delete suitResult[missingSuit];
  for (const suit of lib.suit) {
    if (!suitResult[suit]) {
      suitResult[suit] = [];
    }
  }
  createColumnContainer(contentContainer, suitResult, "花色", cards.length);
}
function renderTypeColumns(contentContainer, cards) {
  const typeResult = Object.groupBy(cards, (card) => String(get.type(card)));
  typeResult.basic ??= [];
  typeResult.trick ??= [];
  typeResult.equip ??= [];
  typeResult.delay ??= [];
  const arr = ["basic", "trick", "equip", "delay", "jiqi", "spell", "zhenfa", "food", "jiguan", "land"];
  for (const key of Object.keys(typeResult).sort((a, b) => arr.indexOf(a) - arr.indexOf(b))) {
    const typeCards = typeResult[key];
    if (!typeCards) {
      continue;
    }
    const missingName = "__missing_name__";
    const result = Object.groupBy(typeCards, (card) => {
      const name = get.name(card);
      return name == null ? missingName : name;
    });
    if (key == "basic") {
      Object.assign(
        result,
        Object.groupBy(typeCards, (card) => {
          if (get.name(card) !== "sha") {
            return missingName;
          }
          return get.translation(get.color(card)) + "杀";
        })
      );
      Object.assign(
        result,
        Object.groupBy(typeCards, (card) => {
          if (get.name(card) !== "sha") {
            return missingName;
          }
          let prefix = get.translation(get.nature(card));
          if (prefix == "") {
            prefix = "普通";
          }
          return prefix + "杀";
        })
      );
      delete result[missingName];
      createColumnContainer(contentContainer, result, get.translation(key), typeCards.length);
    } else {
      delete result[missingName];
      createColumnContainer(contentContainer, result, get.translation(key), typeCards.length);
    }
  }
}
function initDeckMonitor() {
  ui.deckMonitor = ui.create.system(
    "记牌器",
    async function() {
      if (!_status.gameStarted) {
        return;
      }
      game.pause2();
      const result = await fetchDeckMonitorResult(game, ui);
      if (!result) {
        return;
      }
      const drawPile = result.drawPile;
      const discardPile = result.discardPile;
      const popupContainer = ui.create.div(".popupContainer.deckMonitor", ui.window, function() {
        this.delete(400);
        game.resume2();
      });
      const container = ui.create.div(".deckMonitor", popupContainer, function(e) {
        e.stopPropagation();
      });
      let flag = true;
      const statistic = (cards, title) => {
        titleContainer.innerHTML = `${title}【${cards.length}张】 <span>(点击切换)</span>`;
        contentContainer.innerHTML = "";
        const cardList = Array.from(cards);
        renderNumberColumn(contentContainer, cardList);
        renderSuitColumn(contentContainer, cardList);
        renderTypeColumns(contentContainer, cardList);
      };
      const titleContainer = ui.create.div(".title", container, function() {
        if (flag) {
          statistic(discardPile, "弃牌牌堆");
        } else {
          statistic(drawPile, "摸牌牌堆");
        }
        flag = !flag;
      });
      const contentContainer = ui.create.div(".contentContainer", container);
      statistic(drawPile, "摸牌牌堆");
    },
    true,
    true
  );
  lib.arenaReady?.push(function() {
    if (lib.config.show_deckMonitor && !_status.connectMode) {
      ui.deckMonitor.style.display = "";
    } else {
      ui.deckMonitor.style.display = "none";
    }
    document.documentElement.style.setProperty("--tip-display", lib.config.show_tip ? "flex" : "none");
  });
}
export {
  initDeckMonitor
};

import "../../../noname.js";
import { lib } from "../../library/index.js";
import { ui } from "../index.js";
import { game } from "../../game/index.js";
function isCardNode(node) {
  return node instanceof lib.element.Card;
}
function layoutHandcardRow(container, handcards) {
  const cards = Array.from(handcards.children).filter(isCardNode).filter((card) => !card.classList.contains("removing"));
  let offset;
  let infoOffset = 0;
  if (!lib.config.fold_card) {
    offset = 112;
    container.classList.add("scrollh");
  } else {
    offset = Math.min(112, (container.offsetWidth - 128) / (cards.length - 1));
    if (cards.length > 1 && offset < 32) {
      offset = 32;
      container.classList.add("scrollh");
    } else {
      container.classList.remove("scrollh");
    }
  }
  if (offset < 100) {
    infoOffset = 100 - offset;
  }
  const spread = ui.getSpreadOffset(cards, { currentMargin: offset });
  for (let i = 0; i < cards.length; i++) {
    let x = i * offset;
    if (spread.spreadLeft || spread.spreadRight) {
      if (i < spread.spreadIndex) x -= spread.spreadLeft;
      else if (i > spread.spreadIndex) x += spread.spreadRight;
    }
    const baseTransform = "translateX(" + x + "px)";
    cards[i]._transform = baseTransform;
    cards[i].style.transform = cards[i].classList.contains("selected") ? baseTransform + " translateY(-20px)" : baseTransform;
    ui.refresh(cards[i]);
    cards[i].classList.remove("drawinghidden");
    if (infoOffset > 40) {
      infoOffset = 90 - cards[i].node.info.offsetWidth;
      const infoSpan = cards[i].node.info.querySelector("span");
      if (infoSpan) {
        infoSpan.style.display = "none";
      }
      if (cards[i].node.name.classList.contains("long")) {
        cards[i].node.name.style.transform = "translateY(16px)  scale(0.85)";
        cards[i].node.name.style.transformOrigin = "top left";
      } else {
        cards[i].node.name.style.transform = "translateY(16px)";
      }
      cards[i].node.info.style.transform = "translateX(-" + infoOffset + "px) translateY(-3px)";
    } else {
      const infoSpan = cards[i].node.info.querySelector("span");
      if (infoSpan) {
        infoSpan.style.display = "";
      }
      cards[i].node.name.style.transform = "";
      cards[i].node.name.style.transformOrigin = "";
      cards[i].node.info.style.transform = "translateX(-" + infoOffset + "px)";
    }
  }
  handcards.style.width = offset * (cards.length - 1) + 118 + (spread.spreadLeft + spread.spreadRight) + "px";
}
const handcardsLayoutMethods = {
  /**
   * 计算手牌展开偏移量
   * - 触屏设备：点击选中时展开
   * - PC端：仅鼠标悬浮时展开
   */
  getSpreadOffset(cards, options = {}) {
    const result = { spreadIndex: -1, spreadLeft: 0, spreadRight: 0 };
    if (!lib.config.spread_card) return result;
    const cardWidth = options.cardWidth || 112;
    const currentMargin = options.currentMargin || cardWidth;
    if (currentMargin >= cardWidth - 2) return result;
    const isTouchscreen = lib.config.touchscreen;
    for (let i = 0; i < cards.length; i++) {
      const shouldSpread = isTouchscreen ? cards[i].classList?.contains("selected") : cards[i] === ui._handcardHover;
      if (shouldSpread) {
        if (result.spreadIndex !== -1) {
          result.spreadIndex = -1;
          break;
        }
        result.spreadIndex = i;
      }
    }
    if (result.spreadIndex !== -1) {
      const spreadOffset = Math.max(0, cardWidth - currentMargin);
      result.spreadLeft = Math.round(spreadOffset * 0.2);
      result.spreadRight = spreadOffset;
    }
    return result;
  },
  updatehl() {
    if (!game.me) {
      return;
    }
    const handcards1Container = ui.handcards1Container;
    const handcards2Container = ui.handcards2Container;
    if (!handcards1Container || !handcards2Container) {
      return;
    }
    const handcards1 = handcards1Container.firstElementChild;
    const handcards2 = handcards2Container.firstElementChild;
    if (!(handcards1 instanceof HTMLDivElement) || !(handcards2 instanceof HTMLDivElement)) {
      return;
    }
    layoutHandcardRow(handcards1Container, handcards1);
    layoutHandcardRow(handcards2Container, handcards2);
  },
  updateh(compute) {
    if (!game.me) {
      return;
    }
    const handcards1Container = ui.handcards1Container;
    const handcards2Container = ui.handcards2Container;
    if (!handcards1Container || !handcards2Container) {
      return;
    }
    if (lib.config.low_performance) {
      if (compute) {
        ui.updatehl();
        setTimeout(ui.updatehl, 1e3);
      }
      return;
    }
    if (compute) {
      handcards1Container._handcardsWidth = handcards1Container.offsetWidth;
      handcards2Container._handcardsWidth = handcards2Container.offsetWidth;
    }
    ui.updatehx(game.me.node.handcards1);
    ui.updatehx(game.me.node.handcards2);
  },
  updatehx(node) {
    const width = node.parentNode._handcardsWidth ?? 0;
    const num = node.childElementCount - node.getElementsByClassName("removing").length;
    node.classList.remove("fold0");
    node.classList.remove("fold1");
    node.classList.remove("fold2");
    node.classList.remove("fold3");
    if (num * 78 + 40 >= width) {
      node.classList.add("fold3");
    } else if (num * 93 + 25 >= width) {
      node.classList.add("fold2");
    } else if (num * 112 + 6 >= width) {
      node.classList.add("fold1");
    } else {
      node.classList.add("fold0");
    }
  }
};
export {
  handcardsLayoutMethods
};

import { defineComponent, computed, ref, watch, nextTick, onMounted, openBlock, createElementBlock, createBlock, Fragment, normalizeClass, createElementVNode, createVNode, createCommentVNode, toDisplayString } from "vue";
import "../../../../../../noname.js";
import "./editors/card-pile/CardPileEditor.vue.js";
import "./editors/card-pile/CardPileManager.vue.js";
import "./NonameToggle.vue.js";
import { lib } from "../../../../../library/index.js";
import { game } from "../../../../../game/index.js";
import { _status } from "../../../../../status/index.js";
import { ui } from "../../../../index.js";
import { get } from "../../../../../get/binding.js";
import _sfc_main$1 from "./editors/card-pile/CardPileManager.vue2.js";
import _sfc_main$2 from "./NonameToggle.vue2.js";
import _sfc_main$3 from "./editors/card-pile/CardPileEditor.vue2.js";
const _hoisted_1 = { class: "menu-buttons leftbutton" };
const _hoisted_2 = ["innerHTML"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "CardPackPane",
  props: {
    ctx: {}
  },
  setup(__props) {
    const props = __props;
    const connectMenu = computed(() => props.ctx.connectMenu);
    const mode = computed(() => props.ctx.item.key);
    const buttonsContainer = ref();
    const showToggle = computed(() => {
      const m = mode.value;
      if (m === "mode_banned") return false;
      const cardPack = lib.cardPackInfo[m];
      if (!m.startsWith("mode_") || cardPack && cardPack.closeable) {
        return true;
      }
      return false;
    });
    const packEnabled = computed(() => {
      const m = mode.value;
      if (m.startsWith("mode_extension")) {
        const extName = m.slice(15);
        if (!game.hasExtension(extName) || !game.hasExtensionLoaded(extName)) {
          return false;
        }
        const key = `extension_${extName}_cards_enable`;
        if (lib.config[key] === void 0) {
          game.saveExtensionConfig(extName, "cards_enable", true);
        }
        return lib.config[key] === true;
      }
      if (connectMenu.value) {
        return !lib.config.connect_cards.includes(m);
      }
      return lib.config.cards.includes(m);
    });
    function onTogglePack() {
      const m = mode.value;
      const isOn = packEnabled.value;
      if (m.startsWith("mode_extension")) {
        const extName = m.slice(15);
        if (!game.hasExtension(extName) || !game.hasExtensionLoaded(extName)) {
          return;
        }
        game.saveExtensionConfig(extName, "cards_enable", !isOn);
      } else {
        if (connectMenu.value) {
          if (isOn) {
            lib.config.connect_cards.add(m);
          } else {
            lib.config.connect_cards.remove(m);
          }
          game.saveConfig("connect_cards", lib.config.connect_cards);
        } else {
          if (isOn) {
            lib.config.cards.remove(m);
          } else {
            lib.config.cards.add(m);
          }
          game.saveConfig("cards", lib.config.cards);
        }
      }
    }
    const modeInfoText = computed(() => {
      const m = mode.value;
      const info = lib.translate[m + "_cardsInfo"];
      if (!info) return "";
      return info;
    });
    function sortCard(card) {
      const cardData = lib.card[card[2]];
      if (!cardData) return 6;
      const type = cardData.type;
      const subtype = cardData.subtype;
      if (lib.cardType[subtype]) {
        return lib.cardType[subtype];
      }
      if (lib.cardType[type]) {
        return lib.cardType[type];
      }
      switch (type) {
        case "basic":
          return 0;
        case "chess":
          return 1.5;
        case "trick":
          return 2;
        case "delay":
          return 3;
        case "equip": {
          const st = cardData.subtype;
          switch (st) {
            case "equip1":
              return 4.1;
            case "equip2":
              return 4.2;
            case "equip3":
              return 4.3;
            case "equip4":
              return 4.4;
            case "equip5":
              return 4.5;
            default:
              return 4;
          }
        }
        case "zhenfa":
          return 5;
        default:
          return 6;
      }
    }
    function banCard(e) {
      if (_status.clicked) {
        _status.clicked = false;
        return;
      }
      const m = mode.value;
      if (m.startsWith("mode_") && !m.startsWith("mode_extension_") && m !== "mode_banned") {
        return;
      }
      ui.click.touchpop();
      this._banning = connectMenu.value ? "online" : "offline";
      ui.click.intro.call(this, e);
      _status.clicked = false;
      delete this._banning;
    }
    function updateBanned() {
      let list;
      if (!connectMenu.value) {
        list = lib.config[get.mode() + "_bannedcards"];
      }
      if (list && list.includes(this.link[2])) {
        this.classList.add("banned");
      } else {
        this.classList.remove("banned");
      }
    }
    function renderButtons() {
      const container = buttonsContainer.value;
      if (!container) return;
      const m = mode.value;
      const info = lib.cardPack[m];
      if (!info) return;
      const cardPack = lib.cardPackInfo[m];
      if (!lib.cardPile[m] && cardPack && cardPack.list && Array.isArray(cardPack.list)) {
        lib.cardPile[m] = cardPack.list;
      }
      container.innerHTML = "";
      const list = [];
      for (let i = 0; i < info.length; i++) {
        if (!lib.card[info[i]]) {
          continue;
        }
        list.push([
          get.translation(get.type(info[i], "trick")),
          "",
          info[i]
        ]);
      }
      list.sort(function(a, b) {
        const sort1 = sortCard(a);
        const sort2 = sortCard(b);
        if (sort1 === sort2) {
          return b[2] < a[2] ? 1 : -1;
        } else if (sort1 > sort2) {
          return 1;
        } else {
          return -1;
        }
      });
      const buttons = ui.create.buttons(list, "vcard", container);
      for (let i = 0; i < buttons.length; i++) {
        buttons[i].classList.add("noclick");
        buttons[i].listen(banCard);
        if (m !== "mode_banned") {
          buttons[i].updateBanned = updateBanned;
        }
      }
      for (let i = 0; i < buttons.length; i++) {
        if (buttons[i].updateBanned) {
          buttons[i].updateBanned.call(buttons[i]);
        }
      }
    }
    watch(mode, () => {
      nextTick(() => {
        renderButtons();
      });
    });
    const showHideButton = computed(() => {
      const m = mode.value;
      if (connectMenu.value) return false;
      if (!lib.config.all.sgscards) return false;
      if (lib.config.all.sgscards.includes(m)) return false;
      if (m.startsWith("mode_")) return false;
      return true;
    });
    const hiddenText = ref("隐藏卡牌包");
    function onHidePack() {
      const m = mode.value;
      if (hiddenText.value === "隐藏卡牌包") {
        hiddenText.value = "卡牌包将在重启后隐藏";
        lib.config.hiddenCardPack.add(m);
        if (!lib.config.prompt_hidepack) {
          alert("隐藏的扩展包可通过选项-其它-重置隐藏内容恢复");
          game.saveConfig("prompt_hidepack", true);
        }
      } else {
        hiddenText.value = "隐藏卡牌包";
        lib.config.hiddenCardPack.remove(m);
      }
      game.saveConfig("hiddenCardPack", lib.config.hiddenCardPack);
    }
    const showPileEditor = computed(() => {
      const m = mode.value;
      const cardPack = lib.cardPackInfo[m];
      if ((!m.startsWith("mode_") || cardPack && cardPack.closeable) && lib.cardPile[m]) {
        return true;
      }
      return false;
    });
    onMounted(() => {
      nextTick(() => {
        renderButtons();
      });
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        mode.value === "cardpile" ? (openBlock(), createBlock(_sfc_main$1, { key: 0 })) : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
          showToggle.value ? (openBlock(), createElementBlock("div", {
            key: 0,
            class: normalizeClass(["config toggle", { on: packEnabled.value }]),
            onClick: onTogglePack
          }, [
            _cache[0] || (_cache[0] = createElementVNode("span", null, "开启", -1)),
            createVNode(_sfc_main$2)
          ], 2)) : createCommentVNode("", true),
          modeInfoText.value ? (openBlock(), createElementBlock("p", {
            key: 1,
            style: { "padding-left": "2em" },
            innerHTML: modeInfoText.value
          }, null, 8, _hoisted_2)) : createCommentVNode("", true),
          createElementVNode("div", {
            ref_key: "buttonsContainer",
            ref: buttonsContainer,
            class: "card-pack-buttons"
          }, null, 512),
          showHideButton.value ? (openBlock(), createElementBlock("div", {
            key: 2,
            class: "config pointerspan",
            onClick: onHidePack
          }, [
            createElementVNode("span", null, toDisplayString(hiddenText.value), 1)
          ])) : createCommentVNode("", true),
          showPileEditor.value ? (openBlock(), createBlock(_sfc_main$3, {
            key: 3,
            mode: mode.value
          }, null, 8, ["mode"])) : createCommentVNode("", true)
        ], 64))
      ]);
    };
  }
});
export {
  _sfc_main as default
};

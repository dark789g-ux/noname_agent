import { defineComponent, computed, ref, watch, nextTick, onMounted, openBlock, createElementBlock, normalizeStyle } from "vue";
import "../../../../../../noname.js";
import { createConfig } from "../utils/configBuilder.js";
import { setUpdateActive } from "../menuState.js";
import { getConnectMenu, togglePack, favouriteVersion } from "../data/characterPackMenuData.js";
import { lib } from "../../../../../library/index.js";
import { get } from "../../../../../get/binding.js";
import { _status } from "../../../../../status/index.js";
import { ui } from "../../../../index.js";
import { game } from "../../../../../game/index.js";
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "CharacterPackPane",
  props: {
    ctx: {}
  },
  setup(__props) {
    const props = __props;
    const mode = computed(() => props.ctx.item.key);
    const containerRef = ref();
    const isPlainMode = computed(() => {
      return mode.value.startsWith("mode_") && !mode.value.startsWith("mode_extension") && mode.value !== "mode_guozhan";
    });
    const paddingTopStyle = computed(() => {
      if (isPlainMode.value) {
        return { paddingTop: "8px" };
      }
      return {};
    });
    function getBannedList() {
      const connectMenu = getConnectMenu();
      if (connectMenu) {
        const currentMode = mode.value;
        if (currentMode) {
          return lib.config["connect_" + currentMode + "_banned"] || [];
        }
        return [];
      } else {
        return lib.config[get.mode() + "_banned"] || [];
      }
    }
    function createBanCharacterHandler(currentMode, buttonEl) {
      return function banCharacter(e) {
        if (_status.clicked) {
          _status.clicked = false;
          return;
        }
        if (currentMode.startsWith("mode_") && !currentMode.startsWith("mode_extension") && currentMode != "mode_favourite" && currentMode != "mode_banned") {
          const connectMenu2 = getConnectMenu();
          if (!connectMenu2 && lib.config.show_charactercard) {
            ui.click.charactercard(
              // @ts-expect-error link 是运行时挂在按钮节点上的自定义属性
              buttonEl.link,
              buttonEl,
              currentMode == "mode_guozhan" ? "guozhan" : true
            );
          }
          return;
        }
        ui.click.touchpop();
        const connectMenu = getConnectMenu();
        buttonEl._banning = connectMenu ? "online" : "offline";
        if (!connectMenu && lib.config.show_charactercard) {
          ui.click.charactercard(buttonEl.link, buttonEl);
        } else {
          ui.click.intro.call(buttonEl, e);
        }
        _status.clicked = false;
        delete buttonEl._banning;
      };
    }
    function createUpdateBannedHandler(buttonEl) {
      return function updateBanned() {
        const _list = getBannedList();
        if (_list && _list.includes(
          // @ts-expect-error link 是运行时挂在按钮节点上的自定义属性
          buttonEl.link
        )) {
          buttonEl.classList.add("banned");
        } else {
          buttonEl.classList.remove("banned");
        }
      };
    }
    function setupCharacterButtons(buttons, currentMode) {
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        btn.classList.add("noclick");
        btn.listen(createBanCharacterHandler(currentMode, btn));
        ui.create.rarity(btn);
        btn.node.hp.style.transition = "all 0s";
        btn.node.hp._innerHTML = btn.node.hp.innerHTML;
        if (currentMode != "mode_banned") {
          btn.updateBanned = createUpdateBannedHandler(btn);
        }
      }
    }
    function createTogglePackOnclick(currentMode) {
      return function(bool) {
        togglePack(currentMode, bool);
      };
    }
    function renderModePage(container, currentMode) {
      container.innerHTML = "";
      container.className = "menu-buttons leftbutton";
      const connectMenu = getConnectMenu();
      const _info = lib.characterPack[currentMode];
      if (!_info) return;
      let list = [];
      const boolAI = lib.config[`forbidai_user_${currentMode}`];
      for (let i in _info) {
        const characterInfo = _info[i];
        if (characterInfo.isUnseen) {
          continue;
        }
        if (connectMenu && lib.connectBanned.includes(i)) {
          continue;
        }
        list.push(i);
      }
      list.sort(lib.sort.character);
      let list2 = list.slice(0);
      let toggleInit;
      if (currentMode.startsWith("mode_extension")) {
        const extName = currentMode.slice(15);
        if (!game.hasExtension(extName) || !game.hasExtensionLoaded(extName)) {
          toggleInit = false;
        } else {
          if (lib.config[`extension_${extName}_characters_enable`] === void 0) {
            game.saveExtensionConfig(extName, "characters_enable", true);
          }
          toggleInit = lib.config[`extension_${extName}_characters_enable`] === true;
        }
      } else {
        toggleInit = connectMenu ? !lib.config.connect_characters.includes(currentMode) : lib.config.characters.includes(currentMode);
      }
      const cfgnode = createConfig({
        name: "开启",
        _name: currentMode,
        init: toggleInit,
        onclick: createTogglePackOnclick(currentMode)
      });
      const cfgnodeAI = createConfig({
        name: "仅点将可用",
        _name: currentMode,
        init: boolAI,
        intro: "将该武将包内的武将全部设置为仅点将可用",
        onclick(bool) {
          game.saveConfig(`forbidai_user_${currentMode}`, bool);
        }
      });
      if (!currentMode.startsWith("mode_")) {
        cfgnodeAI.style.marginTop = "0px";
        container.appendChild(cfgnode);
        container.appendChild(cfgnodeAI);
      } else if (currentMode.startsWith("mode_extension")) {
        if (!lib.config.all.stockextension.includes(currentMode.slice(15))) {
          container.appendChild(cfgnode);
          cfgnodeAI.style.marginTop = "0px";
        }
        container.appendChild(cfgnodeAI);
      } else {
      }
      if (lib.translate[currentMode + "_charactersInfo"]) {
        const infoHtml = `<p style="padding-left: 2em; margin-block: unset;">${lib.translate[currentMode + "_charactersInfo"]}</p>`;
        container.insertAdjacentHTML("beforeend", infoHtml);
      }
      if (lib.characterSort[currentMode]) {
        renderGroupedButtons(container, currentMode, list2);
      } else {
        const buttons = ui.create.buttons(list, "character", container);
        setupCharacterButtons(buttons, currentMode);
      }
      if (!connectMenu) {
        if (lib.config.all.sgscharacters.includes(currentMode)) {
          ui.create.div(
            ".config.pointerspan",
            '<span style="opacity:0.5">该武将包不可被隐藏</span>',
            container
          );
        } else if (!currentMode.startsWith("mode_")) {
          ui.create.div(".config.pointerspan", "<span>隐藏武将包</span>", container, function() {
            if (this.firstChild.innerHTML == "隐藏武将包") {
              if (confirm("真的要隐藏“" + get.translation(currentMode + "_character_config") + "”武将包吗？\n建议使用“关闭”而不是“隐藏”功能，否则将会影响其他相关武将包的正常运行！")) {
                this.firstChild.innerHTML = "武将包将在重启后隐藏";
                lib.config.hiddenCharacterPack.add(currentMode);
                if (!lib.config.prompt_hidepack) {
                  alert("隐藏的扩展包可通过选项-其它-重置隐藏内容恢复");
                  game.saveConfig("prompt_hidepack", true);
                }
              }
            } else {
              this.firstChild.innerHTML = "隐藏武将包";
              lib.config.hiddenCharacterPack.remove(currentMode);
            }
            game.saveConfig("hiddenCharacterPack", lib.config.hiddenCharacterPack);
          });
        }
      }
    }
    function renderGroupedButtons(container, currentMode, list2) {
      const connectMenu = getConnectMenu();
      const listb = getBannedList();
      for (let pak in lib.characterSort[currentMode]) {
        const info = lib.characterSort[currentMode][pak];
        let listx = [];
        let boolx = false;
        for (let ii = 0; ii < list2.length; ii++) {
          if (info.includes(list2[ii])) {
            listx.push(list2[ii]);
            if (!listb.includes(list2[ii])) {
              boolx = true;
            }
            list2.splice(ii--, 1);
          }
        }
        if (listx.length) {
          let cfgnodeY = {
            name: lib.translate[pak],
            intro: lib.translate[pak + "_info"] || false,
            _name: pak,
            init: boolx,
            onclick(bool) {
              const banned = getBannedList().slice();
              const thisPak = pak;
              const listxInner = lib.characterSort[currentMode][thisPak];
              if (bool) {
                for (let i = 0; i < listxInner.length; i++) {
                  banned.remove(listxInner[i]);
                }
              } else {
                for (let i = 0; i < listxInner.length; i++) {
                  banned.add(listxInner[i]);
                }
              }
              const bannedKey = connectMenu ? "connect_" + currentMode + "_banned" : get.mode() + "_banned";
              game.saveConfig(bannedKey, banned);
              updateActiveFn();
            }
          };
          if (currentMode.startsWith("mode_") && !currentMode.startsWith("mode_extension") && currentMode !== "mode_guozhan") {
            cfgnodeY.clear = true;
            delete cfgnodeY.onclick;
          }
          const cfgnodeX = createConfig(cfgnodeY);
          container.appendChild(cfgnodeX);
          const buttons = ui.create.buttons(listx, "character", container);
          setupCharacterButtons(buttons, currentMode);
        }
      }
      if (list2.length) {
        const cfgnodeX = createConfig({
          name: "其他",
          _name: "others",
          clear: true
        });
        container.appendChild(cfgnodeX);
        const buttons = ui.create.buttons(list2, "character", container);
        setupCharacterButtons(buttons, currentMode);
      }
    }
    let updateActiveFn = () => {
      const container = containerRef.value;
      if (!container) return;
      for (let i = 0; i < container.childElementCount; i++) {
        if (container.childNodes[i].updateBanned) {
          container.childNodes[i].updateBanned();
        }
      }
    };
    watch(
      () => props.ctx.item.key,
      (newMode, oldMode) => {
        if (newMode === oldMode) return;
        nextTick(() => {
          doRender();
        });
      }
    );
    watch(favouriteVersion, () => {
      if (mode.value === "mode_favourite") {
        doRender();
      }
    });
    onMounted(() => {
      setUpdateActive(() => {
        updateActiveFn();
      });
      doRender();
    });
    function doRender() {
      const container = containerRef.value;
      if (!container) return;
      const currentMode = mode.value;
      if (!currentMode) return;
      rebuildCharacterPack(currentMode);
      renderModePage(container, currentMode);
      nextTick(() => {
        updateActiveFn();
      });
    }
    function rebuildCharacterPack(currentMode) {
      if (currentMode === "mode_favourite") {
        lib.characterPack.mode_favourite = {};
        if (Array.isArray(lib.config.favouriteCharacter)) {
          for (let i = 0; i < lib.config.favouriteCharacter.length; i++) {
            let favname = lib.config.favouriteCharacter[i];
            if (lib.character[favname]) {
              lib.characterPack.mode_favourite[favname] = lib.character[favname];
            }
          }
        }
      } else if (currentMode === "mode_banned") {
        lib.characterPack.mode_banned = {};
        for (let i = 0; i < lib.config.all.mode.length; i++) {
          let banned = lib.config[lib.config.all.mode[i] + "_banned"];
          if (banned) {
            for (let j = 0; j < banned.length; j++) {
              if (lib.character[banned[j]]) {
                lib.characterPack.mode_banned[banned[j]] = lib.character[banned[j]];
              }
            }
          }
        }
      }
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        ref_key: "containerRef",
        ref: containerRef,
        class: "menu-buttons leftbutton",
        style: normalizeStyle(paddingTopStyle.value)
      }, null, 4);
    };
  }
});
export {
  _sfc_main as default
};

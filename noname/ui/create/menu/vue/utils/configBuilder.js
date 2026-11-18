import "../../../../../../noname.js";
import { doMenuItem, doToggle } from "./configInteract.js";
import { closePopup, setNoclose, openSwitcherPopup } from "./popupHost.js";
import { ui } from "../../../../index.js";
import { get } from "../../../../../get/binding.js";
import { lib } from "../../../../../library/index.js";
import { _status } from "../../../../../status/index.js";
import { game } from "../../../../../game/index.js";
function updateBr(menu) {
  const brs = Array.from(menu.querySelectorAll(".menu.visual>br"));
  while (brs.length) {
    brs.shift().remove();
  }
  const split = [];
  for (let i = 1; i < menu.childElementCount; i++) {
    if (i % 3 == 0) {
      split.push(menu.childNodes[i]);
    }
  }
  for (let i = 0; i < split.length; i++) {
    menu.insertBefore(ui.create.node("br"), split[i]);
  }
}
function buildVisualMenu(menu, config, configNodeEl) {
  menu.classList.add("visual");
  const updateVisual = function() {
    config.visualMenu(this, this._link, config.item[this._link] || this._link, config);
  };
  const createNode = function(i, before) {
    const visualMenu = ui.create.div();
    if (config.visualBar) {
      if (before) {
        menu.insertBefore(visualMenu, before);
      } else {
        menu.insertBefore(visualMenu, menu.lastChild);
      }
    } else {
      menu.appendChild(visualMenu);
    }
    ui.create.div(".name", get.verticalStr(config.item[i] || i), visualMenu);
    visualMenu._link = i;
    if (config.visualMenu(visualMenu, i, config.item[i] || i, config) !== false) {
      visualMenu.listen(function clickMenuItem() {
        doMenuItem(configNodeEl, this, config);
        closePopup();
      });
    }
    visualMenu.update = updateVisual;
  };
  if (config.visualBar) {
    const visualBar = ui.create.div(menu, function() {
      setNoclose();
    });
    menu.classList.add("withbar");
    config.visualBar(visualBar, config.item, createNode, configNodeEl);
    visualBar.update = function() {
      config.visualBar(visualBar, config.item, createNode, configNodeEl);
    };
  }
  for (const i in config.item) {
    createNode(i);
  }
  lib.setScroll(menu);
  menu.updateBr = function() {
    updateBr(menu);
  };
  menu.updateBr();
}
function buildTextMenu(menu, config, configNodeEl) {
  for (const i in config.item) {
    const textMenu = ui.create.div("", config.item[i] || i, menu, function clickMenuItem() {
      doMenuItem(configNodeEl, this, config);
      closePopup();
    });
    textMenu._link = i;
    if (config.textMenu) {
      config.textMenu(textMenu, i, config.item[i] || i, config);
    }
    lib.setScroll(menu);
  }
}
function buildSwitcherMenu(menu, config, configNodeEl) {
  if (config.visualMenu) {
    buildVisualMenu(menu, config, configNodeEl);
  } else {
    buildTextMenu(menu, config, configNodeEl);
  }
}
function createConfig(config, position) {
  const node = ui.create.div(".config", config.name);
  node._link = { config };
  if (!config.clear) {
    if (config.name != "开启") {
      if (config.name == "屏蔽弱将") {
        config.intro = "强度过低的武将（孙策除外）不会出现在选将框，也不会被AI选择";
      } else if (config.name == "屏蔽强将") {
        config.intro = "强度过高的武将不会出现在选将框，也不会被AI选择";
      } else if (!config.intro) {
        config.intro = "设置" + config.name;
      }
      lib.setIntro(node, function(uiintro) {
        if (lib.config.touchscreen) {
          _status.dragged = true;
        }
        uiintro.style.width = "170px";
        let str = config.intro;
        if (typeof str == "function") {
          str = str();
        }
        uiintro._place_text = uiintro.add('<div class="text" style="display:inline">' + str + "</div>");
      });
    }
  } else {
    node.innerHTML = "<span>" + config.name + "</span>";
    if (!config.nopointer) {
      node.classList.add("pointerspan");
    }
  }
  if (config.item) {
    if (typeof config.item == "function") {
      config.item = config.item();
    }
    if (Array.isArray(config.init)) {
    } else {
      node.classList.add("switcher");
      node._link.choosing = ui.create.div("", config.item[config.init] || config.init, node);
      node._link.menu = ui.create.div(".menu");
      buildSwitcherMenu(
        node._link.menu,
        config,
        node
      );
      node._link.menu._link = node;
      node._link.current = config.init;
      node.listen(function switcherOpen() {
        if (this.classList.contains("disabled")) return;
        this.classList.add("on");
        openSwitcherPopup(this._link.menu, this);
      });
    }
  } else if (config.range) {
  } else if (config.clear) {
    if (node.innerHTML.length >= 15) {
      node.style.height = "auto";
    }
    node.listen(function clickToggle() {
      doToggle(this, config);
    });
  } else if (config.input) {
    node.classList.add("switcher");
    const input = ui.create.div(node);
    if (!config.fixed) {
      input.contentEditable = "true";
      input.style.webkitUserSelect = "text";
    }
    input.style.minWidth = "10px";
    input.style.maxWidth = "60%";
    input.style.overflow = "hidden";
    input.style.whiteSpace = "nowrap";
    input.onkeydown = function(e) {
      if (e.key == "Enter") {
        e.preventDefault();
        e.stopPropagation();
        input.blur();
      }
    };
    if (config.name == "联机昵称") {
      input.innerHTML = config.init || "无名玩家";
      input.onblur = function() {
        input.innerHTML = input.innerHTML.replace(/<br>/g, "");
        if (!input.innerHTML || get.is.banWords(input.innerHTML)) {
          input.innerHTML = "无名玩家";
        }
        input.innerHTML = input.innerHTML.slice(0, 12);
        game.saveConfig("connect_nickname", input.innerHTML);
        game.saveConfig("connect_nickname", input.innerHTML, "connect");
      };
    } else if (config.name == "联机头像") {
      const currentId = lib.config.connect_avatar || config.init || "caocao";
      input.innerHTML = lib.translate[currentId] || "曹操";
      input.onblur = config.onblur;
    } else if (config.name == "联机大厅") {
      input.innerHTML = config.init || lib.hallURL;
      input.onblur = function() {
        if (!input.innerHTML) {
          input.innerHTML = lib.hallURL;
        }
        input.innerHTML = input.innerHTML.replace(/<br>/g, "");
        game.saveConfig("hall_ip", input.innerHTML, "connect");
      };
    } else {
      input.innerHTML = config.init;
      input.onblur = config.onblur;
    }
  } else {
    node.classList.add("toggle");
    node.listen(function clickToggle() {
      doToggle(this, config);
    });
    ui.create.div(ui.create.div(node));
    if (config.init === true) {
      node.classList.add("on");
    }
  }
  if (position) {
    position.appendChild(node);
  }
  return node;
}
export {
  buildSwitcherMenu,
  createConfig
};

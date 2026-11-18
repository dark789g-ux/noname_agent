import { handleImportDataButton, handleImportMusic } from "./optionsImportHandlers.js";
import { reactive, markRaw } from "vue";
import "../../../../../../noname.js";
import "../components/OptionsRightPane.vue.js";
import { menuInits } from "../menuState.js";
import { makeConfigAdapter } from "../utils/configAdapter.js";
import { menuBridge } from "../utils/menuBridge.js";
import { lib } from "../../../../../library/index.js";
import { game } from "../../../../../game/index.js";
import { get } from "../../../../../get/binding.js";
import _sfc_main from "../components/OptionsRightPane.vue2.js";
function clickAutoSkill(bool, _name) {
  let list = lib.config.autoskilllist;
  if (bool) {
    list.remove(_name);
  } else {
    list.add(_name);
  }
  game.saveConfig("autoskilllist", list);
}
function clickBanSkill(bool, _name) {
  let list = lib.config.forbidlist;
  if (bool) {
    list.remove(_name);
  } else {
    list.add(_name);
  }
  game.saveConfig("forbidlist", list);
}
function initSkillConfigPresets() {
  let skilllistexpanded = game.expandSkills(lib.skilllist);
  for (let i in lib.skill) {
    if (!skilllistexpanded.includes(i)) {
      continue;
    }
    if (lib.skill[i].frequent && lib.translate[i]) {
      (function(skillName) {
        lib.configMenu.skill.config[skillName] = {
          name: lib.translate[skillName + "_noconf"] || lib.translate[skillName],
          init: true,
          type: "autoskill",
          onclick: function(result) {
            clickAutoSkill(result, skillName);
          },
          intro: lib.translate[skillName + "_info"]
        };
      })(i);
    }
  }
  let forbid = lib.config.forbid;
  if (!lib.config.forbidlist) {
    game.saveConfig("forbidlist", []);
  }
  for (let i = 0; i < forbid.length; i++) {
    let skip = false;
    let str = "";
    let str2 = "";
    let str3 = "";
    for (let j = 0; j < forbid[i].length; j++) {
      if (!lib.skilllist.includes(forbid[i][j])) {
        skip = true;
        break;
      }
      str += get.translation(forbid[i][j]) + "+";
      str2 += forbid[i][j] + "+";
      str3 += get.translation(forbid[i][j]) + "：" + lib.translate[forbid[i][j] + "_info"];
      if (j < forbid[i].length - 1) {
        str3 += '<div class="placeholder slim" style="display:block;height:8px"></div>';
      }
    }
    if (skip) {
      continue;
    }
    str = str.slice(0, str.length - 1);
    str2 = str2.slice(0, str2.length - 1);
    let cfgName = str2;
    (function(banName) {
      lib.configMenu.skill.config[banName] = {
        name: str,
        init: true,
        type: "banskill",
        onclick: function(result) {
          clickBanSkill(result, banName);
        },
        intro: str3
      };
    })(cfgName);
  }
}
menuInits.push(initSkillConfigPresets);
let updateView = null;
let updateAppearence = null;
function buildModeConfigs(mode) {
  let info = lib.configMenu[mode];
  if (!info || !info.config) return [];
  let configs = [];
  let map = {};
  let config = lib.config;
  if (mode == "appearence") {
    updateAppearence = function() {
      info.config.update(config, map);
    };
  } else if (mode == "view") {
    updateView = function() {
      info.config.update(config, map);
    };
  }
  for (let j in info.config) {
    if (j === "update") continue;
    let cfg = reactive(get.copy(info.config[j]));
    cfg._name = j;
    cfg._hidden = false;
    if (j in config) {
      cfg.init = config[j];
    } else if (cfg.type != "autoskill" && cfg.type != "banskill") {
      game.saveConfig(j, cfg.init);
    }
    if (!cfg.onclick) {
      cfg.onclick = function(result) {
        game.saveConfig(cfg._name, result);
        if (cfg.onsave) {
          cfg.onsave.call(this, result);
        }
      };
    }
    if (info.config.update) {
      if (mode == "appearence" || mode == "view") {
        cfg.update = function() {
          if (updateAppearence) updateAppearence();
          if (updateView) updateView();
        };
      } else {
        cfg.update = function() {
          info.config.update(config, map);
        };
      }
    }
    if (j == "import_data_button") {
      cfg.onclick = function() {
      };
    } else if (j == "import_music") {
      cfg.onclick = function() {
      };
    }
    map[j] = makeConfigAdapter(cfg);
    configs.push(cfg);
  }
  if (info.config.update) {
    info.config.update(config, map);
  }
  return configs;
}
let modeConfigsCache = /* @__PURE__ */ new Map();
function getModeConfigs(mode) {
  if (!modeConfigsCache.has(mode)) {
    modeConfigsCache.set(mode, buildModeConfigs(mode));
  }
  return modeConfigsCache.get(mode);
}
function refreshOptionsConfig(configName) {
  if (configName === "extension_source") {
    let source2 = lib.configMenu.general?.config?.extension_source;
    let cfg2 = modeConfigsCache.get("general")?.find((c) => c._name === "extension_source");
    if (!source2?.item || !cfg2) {
      return;
    }
    cfg2.item = get.copy(source2.item);
    cfg2.init = lib.config.extension_source;
    cfg2.update?.();
    return;
  }
  if (configName !== "background_music") {
    return;
  }
  let source = lib.configMenu.audio?.config?.background_music;
  let cfg = modeConfigsCache.get("audio")?.find((c) => c._name === "background_music");
  if (!source?.item || !cfg) {
    return;
  }
  let item = get.copy(source.item);
  let allow = ["music_off", "music_custom", "music_random"].concat(lib.config.all.background_music);
  for (let key in item) {
    if (!allow.includes(key)) {
      delete item[key];
    }
  }
  cfg.item = item;
  cfg.update?.();
}
menuBridge.refreshOptionsConfig = refreshOptionsConfig;
function isFileManagerAvailable() {
  return !!(lib.node?.fs || window.resolveLocalFileSystemURL);
}
function buildLeftPaneData() {
  let items = [];
  for (let mode in lib.configMenu) {
    if (mode != "others") {
      items.push({
        name: lib.configMenu[mode].name,
        key: mode
      });
    }
  }
  if (isFileManagerAvailable()) {
    items.push({
      name: "文件",
      key: "create"
    });
  }
  if (lib.configMenu.others) {
    items.push({
      name: lib.configMenu.others.name,
      key: "others"
    });
  }
  return items;
}
function getRightPaneForMode(mode) {
  return getModeConfigs(mode);
}
const optionsMenuData = {
  // 占位空数组（MenuView.vue:95 优先使用 getLeftPaneData，此字段不会被读取，仅满足接口类型）
  leftPaneData: [],
  // 改为 getter：延迟到 MenuView setup 时执行（避免模块加载时访问 lib.configMenu）
  getLeftPaneData() {
    return buildLeftPaneData();
  },
  getRightPane(ctx) {
    let mode = ctx.item.key;
    if (mode === "create") {
      return [];
    }
    return getRightPaneForMode(mode);
  },
  getDefaultActiveKey(_connectMenu) {
    return null;
  },
  // 自定义右栏组件 —— 根据左栏 item.key 分派渲染逻辑
  // 标准 mode: NonameConfig 列表
  // mode="create": FileManager
  // mode="skill": 包含 BanSkillEditor 的增强配置列表
  rightPaneComponent: markRaw(_sfc_main)
};
export {
  optionsMenuData as default,
  handleImportDataButton,
  handleImportMusic
};

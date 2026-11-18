import { reactive } from "vue";
import "../../../../../../noname.js";
import { menuUpdates } from "../menuState.js";
import { makeConfigAdapter } from "../utils/configAdapter.js";
import { lib } from "../../../../../library/index.js";
import { get } from "../../../../../get/binding.js";
import { game } from "../../../../../game/index.js";
import { _status } from "../../../../../status/index.js";
function buildLeftPaneData(connectMenu) {
  let modeorder = lib.config.modeorder || [];
  for (const i in lib.mode) {
    modeorder.add(i);
  }
  const leftPaneNames = modeorder.filter(function(mode) {
    if (connectMenu) {
      if (!lib.mode[mode].connect) return false;
      if (!lib.config["connect_" + mode + "_banned"])
        lib.config["connect_" + mode + "_banned"] = [];
      if (!lib.config["connect_" + mode + "_bannedcards"])
        lib.config["connect_" + mode + "_bannedcards"] = [];
    }
    if (lib.config.all.mode.includes(mode)) return true;
    return false;
  });
  return leftPaneNames.map(function(mode) {
    return {
      name: lib.mode[mode]?.name || mode,
      key: mode
    };
  });
}
function getDefaultActiveKey(connectMenu) {
  if (connectMenu) {
    return lib.config.connect_mode || null;
  }
  return lib.config.mode || null;
}
let _connectUpdatePushed = false;
function getRightPane(ctx) {
  const mode = ctx.item.key;
  let connectMenu = ctx.connectMenu;
  const startButtonEl = ctx.startButtonEl;
  const info = lib.mode[mode];
  if (!info) return [];
  const infoconfig = connectMenu ? info.connect : info.config;
  if (!infoconfig) return [];
  const config = lib.config.mode_config[mode] || {};
  if (connectMenu) {
    infoconfig.connect_choose_timeout = {
      name: "出牌时限",
      init: "30",
      item: { 10: "10秒", 15: "15秒", 30: "30秒", 60: "60秒", 90: "90秒" },
      connect: true,
      frequent: true
    };
    infoconfig.connect_observe = { name: "允许旁观", init: true, connect: true };
    infoconfig.connect_observe_handcard = { name: "允许观看手牌", init: false, connect: true };
    infoconfig.connect_mount_combine = { name: "合并坐骑栏", init: false, connect: true };
  }
  if (connectMenu && !_connectUpdatePushed) {
    const updateConnectDisplayMap = function() {
    };
    menuUpdates.push(updateConnectDisplayMap);
    _connectUpdatePushed = true;
  }
  let result = [];
  const map = {};
  for (const j in infoconfig) {
    if (j === "update") continue;
    let cfg = reactive(get.copy(infoconfig[j]));
    cfg._hidden = false;
    cfg._name = j;
    cfg.mode = mode;
    if (j in config) {
      cfg.init = config[j];
    } else {
      game.saveConfig(j, cfg.init, mode);
    }
    if (!cfg.onclick) {
      (function(cfgCapture) {
        cfgCapture.onclick = function(result2) {
          game.saveConfig(cfgCapture._name, result2, mode);
          if (cfgCapture.onsave) {
            cfgCapture.onsave.call(this, result2);
          }
          if (!_status.connectMode || game.online) {
            if (typeof cfgCapture.restart == "function") {
              if (cfgCapture.restart()) {
                if (startButtonEl) startButtonEl.classList.add("glowing");
              }
            } else if (cfgCapture.restart) {
              if (startButtonEl) startButtonEl.classList.add("glowing");
            }
          }
        };
      })(cfg);
    }
    if (infoconfig.update) {
      (function(cfgCapture) {
        cfgCapture.update = function() {
          infoconfig.update(config, map);
        };
      })(cfg);
    }
    map[j] = makeConfigAdapter(cfg);
    result.push(cfg);
  }
  if (infoconfig.update) {
    infoconfig.update(config, map);
  }
  return result;
}
function createStartMenuData(connectMenu) {
  return {
    leftPaneData: buildLeftPaneData(connectMenu),
    getRightPane,
    getDefaultActiveKey
  };
}
export {
  createStartMenuData
};

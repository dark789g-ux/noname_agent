import "../../../../noname.js";
import "../../../util/sandbox.js";
import { security } from "../../../util/sandbox/security.js";
import { game } from "../../../game/index.js";
import { ui } from "../../../ui/index.js";
import { lib } from "../../index.js";
function createModeConnect() {
  return {
    name: "联机",
    config: {
      connect_nickname: {
        name: "联机昵称",
        input: true,
        frequent: true,
        onclick(item) {
          game.saveConfig("connect_nickname", item);
          game.saveConfig("connect_avatar", item, "connect");
        }
      },
      connect_avatar: {
        name: "联机头像",
        init: "caocao",
        input: true,
        frequent: true,
        onclick(item) {
          game.saveConfig("connect_avatar", item);
          game.saveConfig("connect_avatar", item, "connect");
        },
        /** @type {(this: HTMLDivElement) => void} */
        onblur: function() {
          const input = this;
          const value = input.innerHTML.replace(/<br>/g, "").trim();
          if (!value) {
            const currentId = lib.config.connect_avatar || "caocao";
            const currentName = lib.translate[currentId] || "曹操";
            input.innerHTML = currentName;
            return;
          }
          const matches = [];
          const searchReg = new RegExp(value, "i");
          for (let id in lib.character) {
            const name = lib.translate[id];
            if (!name) continue;
            if (searchReg.test(name) || searchReg.test(id) || searchReg.test(String(lib.translate[id + "_ab"]))) {
              matches.push(id);
            }
          }
          if (matches.length === 0) {
            alert(`未找到武将"${value}"`);
            const currentId = lib.config.connect_avatar || "caocao";
            const currentName = lib.translate[currentId] || "曹操";
            input.innerHTML = currentName;
          } else if (matches.length === 1) {
            const id = matches[0];
            game.saveConfig("connect_avatar", id);
            game.saveConfig("connect_avatar", id, "connect");
            input.innerHTML = String(lib.translate[id]);
          } else {
            game.closeMenu();
            const dialog = ui.create.dialog("选择头像", [matches, "character"], "hidden");
            dialog.classList.add("fixed");
            for (let i = 0; i < dialog.buttons.length; i++) {
              const button = dialog.buttons[i];
              const characterId = button.link;
              button.classList.add("pointerdiv");
              button.listen(function() {
                game.saveConfig("connect_avatar", characterId);
                game.saveConfig("connect_avatar", characterId, "connect");
                input.innerHTML = String(lib.translate[characterId]);
                dialog.close();
              });
            }
            dialog.open();
          }
        }
      },
      hall_ip: {
        name: "联机大厅",
        input: true,
        frequent: true
      },
      hall_button: {
        name: "联机大厅按钮",
        init: true,
        frequent: true,
        onclick(bool) {
          game.saveConfig("hall_button", bool, "connect");
          if (ui.hall_button) {
            if (bool) {
              ui.hall_button.style.display = "";
            } else {
              ui.hall_button.style.display = "none";
            }
          }
        }
      },
      wss_mode: {
        name: "使用WSS协议",
        init: false,
        intro: "在用户填写的IP地址没有直接指定使用WS/WSS协议的情况下，默认使用WSS协议，而非WS协议来连接到联机服务器。<br>请不要轻易勾选此项！",
        onclick(bool) {
          if (bool && !confirm("此为开发者选项，开启后将无法直接联机。您确定要开启WSS模式吗？")) {
            return;
          }
          game.saveConfig("wss_mode", bool, "connect");
        }
      },
      read_clipboard: {
        name: "读取邀请链接",
        init: true,
        frequent: true,
        intro: "读取剪贴板以解析邀请链接自动加入联机房间"
      },
      check_versionLocal: {
        name: "禁止不同版本玩家进房",
        init: true,
        intro: "禁止与自己版本不同的玩家进入房间"
      },
      check_extension: {
        name: "禁止扩展玩家进房",
        init: false,
        intro: "禁止开启了扩展的玩家进入房间"
      },
      reset_banBlacklist: {
        name: "重置黑名单",
        onclick() {
          if (this.firstChild.innerHTML != "已重置") {
            this.firstChild.innerHTML = "已重置";
            var banBlacklist = [];
            game.saveConfig("banBlacklist", banBlacklist);
            var that = this;
            setTimeout(function() {
              that.firstChild.innerHTML = "重置黑名单";
            }, 1e3);
          }
        },
        clear: true
      },
      reset_grantedServers: {
        name: "重置受信任的服务器列表",
        onclick() {
          if (this.firstChild.innerHTML != "已重置") {
            this.firstChild.innerHTML = "已重置";
            security.resetGrantedServers();
            setTimeout(() => {
              if (confirm("是否重置游戏让改变的列表生效?")) {
                game.reload();
                return;
              }
              this.firstChild.innerHTML = "重置受信任的服务器列表";
            }, 0);
          }
        },
        clear: true
      }
    }
  };
}
export {
  createModeConnect
};

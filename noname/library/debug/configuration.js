import "../../../noname.js";
import { lib } from "../index.js";
import { game } from "../../game/index.js";
import { ui } from "../../ui/index.js";
import { get } from "../../get/binding.js";
import { ai } from "../../ai/index.js";
import { _status } from "../../status/index.js";
function createCheatConfiguration() {
  return {
    /**
     * 将游戏内部的对象暴露到全局中
     *
     * lib.cheat, game, ui, get, ai, lib, _status
     */
    i() {
      window.cheat = lib.cheat;
      window.game = game;
      window.ui = ui;
      window.get = get;
      window.nonameAI = ai;
      window.lib = lib;
      window._status = _status;
    },
    /**
     * 自己的下家(如果下家是主公身份则是下家的下家)立即死亡
     */
    dy() {
      let next = game.getMe().next;
      for (let i = 0; i < 10; i++) {
        if (next.identity != "zhu") {
          break;
        }
        next = next.next;
      }
      next.die();
    },
    /**
     * 在控制台输出每个扩展文件夹内的所有文件
     *
     * 需要node环境
     *
     * @param  { ...string } args 只需要显示的文件夹首字符
     */
    x(...args) {
      const node = lib.requireNodePlatform();
      const gl = function(dir, callback) {
        const files = [], folders = [];
        dir = node.path.join(__dirname, "extension", dir);
        node.fs.promises.readdir(dir).then((filelist) => {
          for (let i = 0; i < filelist.length; i++) {
            if (filelist[i][0] != "." && filelist[i][0] != "_") {
              if (node.fs.statSync(dir + "/" + filelist[i]).isDirectory()) {
                folders.push(filelist[i]);
              } else {
                files.push(filelist[i]);
              }
            }
          }
          callback(folders, files);
        }).catch((e) => {
          throw e;
        });
      };
      for (let i = 0; i < args.length; i++) {
        args[i] = args[i][0];
      }
      gl("", function(list) {
        if (args.length) {
          for (let i = 0; i < list.length; i++) {
            if (!args.includes(list[i][0])) {
              list.splice(i--, 1);
            }
          }
        }
        if (list.length) {
          for (let i = 0; i < list.length; i++) {
            let str = list[i];
            gl(str, function(folders, files) {
              if (files.length > 1) {
                for (let j = 0; j < files.length; j++) {
                  if (typeof files[i] == "string" && files[i].includes("extension.js")) {
                    files.splice(j--, 1);
                  } else {
                    if (j % 5 == 0) {
                      str += "\n			";
                    }
                    str += '"' + files[j] + '",';
                  }
                }
                console.log(str.slice(0, str.length - 1));
                game.print(str.slice(0, str.length - 1));
              }
            });
          }
        }
      });
    }
  };
}
export {
  createCheatConfiguration
};

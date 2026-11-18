import "../../../noname.js";
import { game } from "../index.js";
import { get } from "../../get/binding.js";
import { lib } from "../../library/index.js";
const platformFileIOMethods = {
  multiDownload2(list, onsuccess, onerror, onfinish, process, dev) {
    list = list.slice(0);
    const hasItems = (values) => values.length > 0;
    const download = function() {
      if (hasItems(list)) {
        const current = list[0];
        list.shift();
        const current2 = typeof process == "function" ? process(current) : current;
        if (current.startsWith("theme")) {
          game.print(current.slice(6));
        } else if (current.startsWith("image/skin")) {
          game.print(current.slice(11));
        } else {
          game.print(current.slice(current.lastIndexOf("/") + 1));
        }
        if (typeof game.download != "function") {
          throw new TypeError("game.download is not a function");
        }
        game.download(
          current,
          current2,
          function() {
            if (onsuccess) {
              onsuccess(list.length);
            }
            download();
          },
          function(e) {
            if (onerror) {
              onerror(e);
            }
            download();
          },
          dev
        );
      } else if (onfinish) {
        onfinish();
      }
    };
    download();
  },
  multiDownload(list, onsuccess, onerror, onfinish, process, dev) {
    if (lib.config.dev) {
      game.print(get.url());
    }
    const args = [list, onsuccess, onerror, onfinish, process, dev];
    if (list.length <= 3) {
      Reflect.apply(game.multiDownload2, this, args);
    } else {
      const num = Math.round(list.length / 3);
      let left = 3;
      args[3] = function() {
        left--;
        if (left == 0) {
          onfinish();
        }
      };
      setTimeout(function() {
        args[0] = list.slice(0, num);
        Reflect.apply(game.multiDownload2, game, args);
      });
      setTimeout(function() {
        args[0] = list.slice(num, 2 * num);
        Reflect.apply(game.multiDownload2, this, args);
      }, 200);
      setTimeout(function() {
        args[0] = list.slice(2 * num);
        Reflect.apply(game.multiDownload2, this, args);
      }, 400);
    }
  },
  fetch(url, onload, onerror, onprogress) {
    const tmpName = "~tmp" + get.id();
    if (typeof game.download != "function") {
      throw new TypeError("game.download is not a function");
    }
    game.download(
      encodeURI(url),
      tmpName,
      function() {
        if (typeof game.readFile != "function") {
          throw new TypeError("game.readFile is not a function");
        }
        game.readFile(
          tmpName,
          function(data) {
            onload(data);
            if (typeof game.removeFile != "function") {
              throw new TypeError("game.removeFile is not a function");
            }
            game.removeFile(tmpName);
          },
          onerror
        );
      },
      onerror,
      null,
      onprogress
    );
  }
};
export {
  platformFileIOMethods
};

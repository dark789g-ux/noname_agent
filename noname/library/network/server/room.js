import "../../../../noname.js";
import { lib } from "../../index.js";
import { game } from "../../../game/index.js";
import { _status } from "../../../status/index.js";
function createMessageServerRoom() {
  return {
    /**
     * ```plain
     * 当客机向主机发送投降请求时的回调
     * ```
     *
     * @this {import("@/library/element/client.js").Client}
     * @param {Player} player
     */
    giveup(player) {
      if (lib.requireNodeServer().observing.includes(this) || !player || !player._giveUp) {
        return;
      }
      var self = lib.playerOL[this.id];
      if (self !== player) {
        return;
      }
      _status.event.next.length = 0;
      game.createEvent("giveup", false).set("includeOut", true).setContent(function() {
        game.log(player, "投降");
        player.popup("投降");
        player.die("nosource").includeOut = true;
      }).player = player;
    },
    /**
     * @this {import("@/library/element/client.js").Client}
     */
    auto() {
      if (lib.requireNodeServer().observing.includes(this)) {
        return;
      }
      var player = lib.playerOL[this.id];
      if (player) {
        player.isAuto = true;
        player.setNickname(player.nickname + " - 托管");
        game.broadcast(function(player2) {
          player2.setNickname(player2.nickname + " - 托管");
        }, player);
      }
    },
    /**
     * @this {import("@/library/element/client.js").Client}
     */
    unauto() {
      if (lib.requireNodeServer().observing.includes(this)) {
        return;
      }
      var player = lib.playerOL[this.id];
      if (player) {
        player.isAuto = false;
        player.setNickname(player.nickname);
        game.broadcast(function(player2) {
          player2.setNickname(player2.nickname);
        }, player);
      }
    },
    exec(func) {
    },
    /**
     * 用于代替exec进行主机许可的请求喵
     *
     * @this {import("@/library/element/client.js").Client}
     * @param {{ type: string }} subject 请求附带的载荷，必须是对象并且包含类型为字符串的`type`属性喵
     * @param {string|null} id 本次请求id，如果给出了请求id代表服务器应该进行响应喵
     */
    dataSync(subject, id) {
      if (lib.requireNodeServer().observing.includes(this)) {
        return;
      }
      void (async () => {
        let ok = false;
        let result = null;
        try {
          if (!subject || typeof subject !== "object" || typeof subject.type !== "string") {
            return;
          }
          const type = subject.type;
          const requester = lib.playerOL?.[this.id] ?? null;
          let directResult = null;
          if (!requester) {
            return;
          }
          switch (type) {
            // 如果要增加类型请走这里喵
            case "skill":
              directResult = await game.respondSkillData(id, requester, subject);
              break;
          }
          if (directResult != null) {
            [ok, result] = directResult;
          }
        } finally {
          if (id) {
            this.send("dataReply", { ok, id, result });
          }
        }
      })();
    },
    /**
     * @this {import("@/library/element/client.js").Client}
     */
    log() {
      var items = [];
      try {
        const sandbox = this.sandbox;
        if (!sandbox) {
          this.send("log", ["err"]);
          return;
        }
        for (var i = 0; i < arguments.length; i++) {
          items.push(sandbox.exec(`return ${arguments[i]}`));
        }
      } catch (e) {
        this.send("log", ["err"]);
        return;
      }
      this.send("log", items);
    },
    /**
     * 同步主客机的手牌状态
     *
     * @this {import("@/library/element/client.js").Client}
     * @param {string[]} cardid_list 要同步的手牌id序列
     */
    syncHandcard(cardid_list) {
      if (lib.requireNodeServer().observing.includes(this)) {
        return;
      }
      const player = lib.playerOL[this.id];
      if (!player) {
        return;
      }
      game.syncHandcard(player, cardid_list);
    }
  };
}
export {
  createMessageServerRoom
};

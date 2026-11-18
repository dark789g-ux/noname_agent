import "../../../../noname.js";
import { lib } from "../../index.js";
import { game } from "../../../game/index.js";
import { get } from "../../../get/binding.js";
const promiseMethods = {
  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  catch(onrejected) {
    return this.then(void 0, onrejected);
  },
  /**
   * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
   * resolved value cannot be modified from the callback.
   * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
   * @returns A Promise for the completion of the callback.
   */
  finally(onfinally) {
    return this.then(
      () => {
        if (onfinally) {
          onfinally();
        }
      },
      (err) => {
        if (onfinally) {
          onfinally();
        }
        throw err;
      }
    );
  },
  /**
   * 获取 Result 对象中的信息。
   * @example
   * ```js
   * const chooseCardResult = await player.chooseCard().forResult();
   * // 获取整个结果对象，然后访问如 chooseCardResult.cards 等属性
   * ```
   */
  async forResult() {
    await this;
    return this.result;
  },
  getTrigger() {
    return this.getParent((e) => !!e._trigger, true, true)?._trigger;
  },
  send() {
    this.getPlayer().send(
      function(name, args, set, event, skills) {
        const player = game.getMe();
        player.applySkills(skills);
        const next = player[name].apply(player, args);
        for (let i = 0; i < set.length; i++) {
          next.set(set[i][0], set[i][1]);
        }
        if (next._backupevent) {
          next.backup(next._backupevent);
        }
        next._modparent = event;
        game.resume();
      },
      this.name,
      this._args || [],
      this._set,
      get.stringifiedResult(this.parent),
      get.skillState(this.getPlayer())
    );
    this.getPlayer().wait();
    game.pause();
    return this;
  },
  /**
   * 在可await/异步情况下获取客机执行的结果
   */
  sendAsync() {
    return new Promise((resolve) => {
      this.send();
      const node = lib.getNodeServer();
      const playerid = this.getPlayer().playerid;
      if (!node || !playerid) {
        resolve(null);
        return;
      }
      if (!Array.isArray(node.waitForResult[playerid])) {
        node.waitForResult[playerid] = [resolve];
      } else {
        node.waitForResult[playerid].push(resolve);
      }
    });
  }
};
export {
  promiseMethods
};

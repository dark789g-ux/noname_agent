import "../../../../../noname.js";
import "../contracts/statusContract.js";
import { get } from "../../../../get/binding.js";
import { _status } from "../../../../status/index.js";
import { game } from "../../../../game/index.js";
import { lib } from "../../../index.js";
const friendsAndEnemiesMethods = {
  getEnemies(func, includeDie) {
    const player = this;
    let targets;
    const mode = get.mode();
    const method = includeDie ? "filterPlayer2" : "filterPlayer";
    if (mode == "identity") {
      if (_status.mode == "purple") {
        switch (player.identity) {
          case "bZhu":
          case "bZhong":
          case "rNei":
            targets = game[method](function(target) {
              if (func && !func(target)) {
                return false;
              }
              return ["rZhu", "rZhong", "bNei"].includes(target.identity);
            });
            break;
          case "rZhu":
          case "rZhong":
          case "bNei":
            targets = game[method](function(target) {
              if (func && !func(target)) {
                return false;
              }
              return ["bZhu", "bZhong", "rNei"].includes(target.identity);
            });
            break;
          case "rYe":
          case "bYe":
            targets = game[method](function(target) {
              if (func && !func(target)) {
                return false;
              }
              return !["rYe", "bYe"].includes(target.identity);
            });
            break;
        }
      } else {
        const num = get.population("fan");
        switch (player.identity) {
          case "zhu":
          case "zhong":
          case "mingzhong":
            targets = game[method](function(target) {
              if (func && !func(target)) {
                return false;
              }
              if (num >= 3) {
                return target.identity == "fan";
              }
              return target.identity == "nei" || target.identity == "fan";
            });
            break;
          case "nei":
            targets = game[method](function(target) {
              if (func && !func(target)) {
                return false;
              }
              if (num >= 3) {
                return target.identity == "fan";
              }
              if (game.players.length == 2) {
                return target != player;
              }
              return target.identity == "zhong" || target.identity == "mingzhong" || target.identity == "fan";
            });
            break;
          case "fan":
            targets = game[method](function(target) {
              if (func && !func(target)) {
                return false;
              }
              return target.identity != "fan";
            });
            break;
          case "commoner":
            targets = game[method](function(target) {
              if (func && !func(target)) {
                return false;
              }
              if (num >= 3) {
                return target.identity != "fan";
              }
              return target.identity == "fan";
            });
            break;
        }
      }
    } else if (mode == "guozhan") {
      if (player.identity == "ye") {
        targets = game[method](function(target) {
          if (func && !func(target)) {
            return false;
          }
          return true;
        });
      } else {
        const group = lib.character[String(player.name1)][1];
        targets = game[method](function(target) {
          if (func && !func(target)) {
            return false;
          }
          return target.identity == "ye" || lib.character[String(target.name1)][1] != group;
        });
      }
    } else if (mode == "doudizhu") {
      targets = game[method](function(target) {
        if (func && !func(target)) {
          return false;
        }
        return target.identity != player.identity;
      });
    } else {
      targets = game[method](function(target) {
        if (func && !func(target)) {
          return false;
        }
        return target.side != player.side;
      });
    }
    targets.remove(player);
    return targets;
  },
  getFriends(func, includeDie) {
    const player = this;
    let targets = [];
    const mode = get.mode();
    let self = false;
    let filterFn;
    if (func === true) {
      filterFn = null;
      self = true;
    } else if (typeof func === "function") {
      filterFn = func;
    } else {
      filterFn = null;
    }
    const method = includeDie ? "filterPlayer2" : "filterPlayer";
    if (mode == "identity") {
      if (_status.mode == "purple") {
        switch (player.identity) {
          case "rZhu":
          case "rZhong":
          case "bNei":
            targets = game[method](function(target) {
              if (filterFn && !filterFn(target)) {
                return false;
              }
              return ["rZhu", "rZhong", "bNei"].includes(target.identity);
            });
            break;
          case "bZhu":
          case "bZhong":
          case "rNei":
            targets = game[method](function(target) {
              if (filterFn && !filterFn(target)) {
                return false;
              }
              return ["bZhu", "bZhong", "rNei"].includes(target.identity);
            });
            break;
          case "rYe":
          case "bYe":
            targets = game[method](function(target) {
              if (filterFn && !filterFn(target)) {
                return false;
              }
              return ["rYe", "bYe"].includes(target.identity);
            });
            break;
        }
      } else {
        switch (player.identity) {
          case "zhu":
          case "zhong":
          case "mingzhong":
            targets = game[method](function(target) {
              if (filterFn && !filterFn(target)) {
                return false;
              }
              return ["zhu", "zhong", "mingzhong"].includes(target.identity);
            });
            break;
          case "nei":
            targets = [];
            break;
          case "fan":
            targets = game[method](function(target) {
              if (filterFn && !filterFn(target)) {
                return false;
              }
              return target.identity == "fan";
            });
            break;
          case "commoner":
            targets = game[method](function(target) {
              if (filterFn && !filterFn(target)) {
                return false;
              }
              return true;
            });
            break;
        }
      }
    } else if (mode == "guozhan") {
      if (player.identity == "ye") {
        targets = [];
      } else {
        const group = lib.character[String(player.name1)][1];
        targets = game[method](function(target) {
          if (filterFn && !filterFn(target)) {
            return false;
          }
          return target.identity != "ye" && lib.character[String(target.name1)][1] == group;
        });
      }
    } else if (mode == "doudizhu") {
      targets = game[method](function(target) {
        if (filterFn && !filterFn(target)) {
          return false;
        }
        return target.identity == player.identity;
      });
    } else {
      targets = game[method](function(target) {
        if (filterFn && !filterFn(target)) {
          return false;
        }
        return target.side == player.side;
      });
    }
    if (self) {
      targets.add(player);
    } else {
      targets.remove(player);
    }
    return targets;
  },
  isEnemyOf() {
    return !this.isFriendOf.apply(this, arguments);
  },
  isFriendOf(player) {
    if (get.mode() == "guozhan") {
      if (this == player) {
        return true;
      }
      if (this.getStorage("yexinjia_friend").includes(player) || player.getStorage("yexinjia_friend").includes(this)) {
        return true;
      }
      if (this.identity == "unknown" || this.identity == "ye") {
        return false;
      }
      if (player.identity == "unknown" || player.identity == "ye") {
        return false;
      }
      return this.identity == player.identity;
    }
    if (get.mode() == "doudizhu") {
      return this.identity == player.identity;
    }
    if (this.side != void 0 && typeof player.side == "boolean") {
      return this.side == player.side;
    }
    return this == player;
  },
  isFriendsOf(player, includeDie) {
    return player.getFriends(true, includeDie).includes(this);
  },
  isEnemiesOf(player, includeDie) {
    return player.getEnemies(null, includeDie).includes(this);
  }
};
export {
  friendsAndEnemiesMethods
};

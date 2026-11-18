import "../../../../../noname.js";
import { game } from "../../../../game/index.js";
import { get } from "../../../../get/binding.js";
import { lib } from "../../../index.js";
import { ui } from "../../../../ui/index.js";
import { _status } from "../../../../status/index.js";
const onlineAndStateMethods = {
  initOL(name, character) {
    this.node.avatar.setBackground(character, "character");
    this.node.avatar.show();
    this.node.name.innerHTML = get.verticalStr(name);
    this.nickname = name;
    this.avatar = character;
    this.node.nameol.innerHTML = "";
    const characterKey = String(character);
    if (lib.character[characterKey]) {
      this.sex = lib.character[characterKey][0];
    }
  },
  uninitOL() {
    this.node.avatar.hide();
    this.node.name.innerHTML = "";
    this.node.identity.firstChild.innerHTML = "";
    delete this.nickname;
    delete this.avatar;
    delete this.sex;
  },
  initRoom(info, info2) {
    let str = "";
    this.serving = false;
    if (!info || info == "server") {
      this.roomempty = true;
      str = "空房间";
      this.roomfull = false;
      this.roomgaming = false;
      this.version = null;
      if (info == "server") {
        this.serving = true;
      }
    } else {
      if (info.length) {
        const config = info[2];
        this.key = info[4];
        this.roomempty = false;
        str += get.modetrans(config);
        str += " 模式　";
        for (let i = str.length; i < 11; i++) {
          str += "　";
        }
        this.version = config.version;
        if (config.gameStarted) {
          str += '<span class="firetext">游戏中</span>　';
          if (config.observe && config.observeReady && this.version == lib.versionOL) {
            this.classList.remove("exclude");
          } else {
            this.classList.add("exclude");
          }
        } else {
          str += '<span class="greentext">等待中</span>　';
          if (this.version != lib.versionOL) {
            this.classList.add("exclude");
          } else {
            this.classList.remove("exclude");
          }
        }
        this.maxHp = parseInt(config.number);
        this.hp = Math.min(this.maxHp, info[3]);
        if (this.hp < this.maxHp || config.gameStarted) {
          str += "人数：" + this.hp + "/" + this.maxHp;
        } else {
          str += '人数：<span class="firetext">' + this.hp + "/" + this.maxHp + "</span>";
        }
        str += "　(" + info[0].slice(0, 12) + " 的房间)";
        if (config.mode != "guozhan" && (config.mode != "doudizhu" || config.doudizhu_mode != "online")) {
          str += "【";
          for (let i = 0; i < config.cardPack.length; i++) {
            str += get.translation(config.cardPack[i] + "_card_config").slice(0, 2);
            if (i < config.cardPack.length - 1) {
              str += "+";
            }
          }
          str += "】";
        }
        this.config = config;
        if (this.hp == this.maxHp && !config.gameStarted) {
          this.roomfull = true;
        } else {
          this.roomfull = false;
        }
        if (config.gameStarted && (!config.observe || !config.observeReady)) {
          this.roomgaming = true;
        } else {
          this.roomgaming = false;
        }
      } else {
        str = "异常房间";
        this.roomfull = true;
        this.classList.add("exclude");
      }
    }
    this.firstChild.innerHTML = str;
    return this;
  },
  send(...args) {
    if (!this.ws || this.ws.closed) {
      return this;
    }
    this.ws.send(...args);
    return this;
  },
  getId() {
    if (_status.video || _status.connectMode) {
      return this;
    }
    if (this.playerid) {
      delete game.playerMap[this.playerid];
    }
    this.playerid = get.id();
    game.playerMap[this.playerid] = this;
    return this;
  },
  showGiveup() {
    this._giveUp = true;
    if (this == game.me) {
      ui.create.giveup();
    } else if (this.isOnline2()) {
      this.send(ui.create.giveup);
    }
  },
  applySkills(skills) {
    for (const i in skills) {
      if (i == "global") {
        lib.skill.global = skills[i];
      } else if (i == "stat") {
        this.stat = [skills.stat];
      } else if (lib.playerOL[i]) {
        for (const j in skills[i]) {
          lib.playerOL[i][j] = skills[i][j];
        }
      }
    }
  },
  getState() {
    const state = {
      hp: this.hp,
      maxHp: this.maxHp,
      nickname: this.nickname,
      sex: this.sex,
      group: this.group,
      name: this.name,
      name1: this.name1,
      name2: this.name2,
      handcards: this.getCards("hs"),
      gaintag: [],
      equips: this.getCards("e"),
      extraEquip: this.extraEquip,
      equips_map: this.getCards("e").reduce((map, value) => {
        const id = value.cardid;
        if (typeof id !== "string") return map;
        map[id] = {};
        if (value.isViewAsCard) {
          map[id].isViewAsCard = true;
        }
        if (value._destroyed_Virtua) {
          map[id]._destroyed_Virtua = value._destroyed_Virtua;
        }
        if (value.destroyed) {
          map[id].destroyed = value.destroyed;
        }
        if (value.node.name2.innerHTML) {
          map[id].name2 = value.node.name2.innerHTML;
        }
        if (value.cardSymbol) {
          map[id].vcard = value[value.cardSymbol];
        }
        return map;
      }, {}),
      judges: this.getCards("j"),
      judges_map: this.getCards("j").reduce((map, value) => {
        const id = value.cardid;
        if (typeof id !== "string") return map;
        map[id] = {};
        if (value.isViewAsCard) {
          map[id].isViewAsCard = true;
        }
        if (value._destroyed_Virtua) {
          map[id]._destroyed_Virtua = value._destroyed_Virtua;
        }
        if (value.destroyed) {
          map[id].destroyed = value.destroyed;
        }
        if (value.node.name2.innerHTML) {
          map[id].name2 = value.node.name2.innerHTML;
        }
        if (value.cardSymbol) {
          map[id].vcard = value[value.cardSymbol];
        }
        return map;
      }, {}),
      specials: this.getCards("s"),
      expansions: this.getCards("x"),
      vcardsMap: this.vcardsMap,
      expansion_gaintag: [],
      disableJudge: this.isDisabledJudge(),
      disabledSlots: this.disabledSlots,
      expandedSlots: this.expandedSlots,
      views: [],
      position: parseInt(String(this.dataset.position)),
      hujia: this.hujia,
      side: this.side,
      identityShown: this.identityShown,
      identityNode: [this.node.identity.innerHTML, this.node.identity.dataset.color],
      identity: this.identity,
      dead: this.isDead(),
      linked: this.isLinked(),
      turnedover: this.isTurnedOver(),
      out: this.isOut(),
      phaseNumber: this.phaseNumber,
      unseen: this.isUnseen(0),
      unseen2: this.isUnseen(1),
      seatNum: this.seatNum
    };
    for (let i = 0; i < state.judges.length; i++) {
      state.views[i] = state.judges[i].viewAs;
    }
    for (let i = 0; i < state.handcards.length; i++) {
      state.gaintag[i] = state.handcards[i].gaintag;
    }
    for (let i = 0; i < state.expansions.length; i++) {
      state.expansion_gaintag[i] = state.expansions[i].gaintag;
    }
    if (this.getModeState) {
      state.mode = this.getModeState();
    }
    return state;
  },
  setNickname(str) {
    this.node.nameol.innerHTML = (str || this.nickname || "").slice(0, 12);
    return this;
  },
  syncSkills() {
    game.broadcast(
      function(player, skills) {
        player.applySkills(skills);
      },
      this,
      get.skillState(this)
    );
  }
};
export {
  onlineAndStateMethods
};

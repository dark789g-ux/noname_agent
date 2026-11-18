import "../../../noname.js";
import "../dependencies.js";
import { lib } from "../../library/index.js";
import { _status } from "../../status/index.js";
import { ui } from "../../ui/index.js";
import { game } from "../../game/index.js";
import { get } from "../binding.js";
function playerDetails(node, simple, evt, uiintro, createButtons) {
  let i, translation, intro, str, listi;
  if (lib.config.right_range && _status.gameStarted) {
    uiintro.add(ui.create.div(".placeholder"));
    let table, tr, td;
    table = document.createElement("table");
    tr = document.createElement("tr");
    table.appendChild(tr);
    td = document.createElement("td");
    td.innerHTML = "距离";
    tr.appendChild(td);
    td = document.createElement("td");
    td.innerHTML = "手牌";
    tr.appendChild(td);
    td = document.createElement("td");
    td.innerHTML = "行动";
    tr.appendChild(td);
    td = document.createElement("td");
    td.innerHTML = "伤害";
    tr.appendChild(td);
    tr = document.createElement("tr");
    table.appendChild(tr);
    td = document.createElement("td");
    if (node == game.me || !game.me || !game.me.isIn()) {
      td.innerHTML = "-";
    } else {
      let dist1 = get.numStr(Math.max(1, game.me.distanceTo(node)), void 0);
      let dist2 = get.numStr(Math.max(1, node.distanceTo(game.me)), void 0);
      if (dist1 == dist2) {
        td.innerHTML = dist1;
      } else {
        td.innerHTML = dist1 + "/" + dist2;
      }
    }
    tr.appendChild(td);
    td = document.createElement("td");
    let handcardLimit = node.getHandcardLimit();
    td.innerHTML = `${node.countCards("h")}/${handcardLimit >= 114514 ? "∞" : handcardLimit}`;
    tr.appendChild(td);
    td = document.createElement("td");
    td.innerHTML = node.phaseNumber;
    tr.appendChild(td);
    td = document.createElement("td");
    (function() {
      let num = 0;
      for (let j = 0; j < node.stat.length; j++) {
        if (typeof node.stat[j].damage == "number") {
          num += node.stat[j].damage;
        }
      }
      td.innerHTML = String(num);
    })();
    tr.appendChild(td);
    table.style.width = "calc(100% - 20px)";
    table.style.marginLeft = "10px";
    uiintro.content.appendChild(table);
    if (!lib.config.show_favourite) {
      table.style.paddingBottom = "5px";
    }
  }
  if (!simple || get.is.phoneLayout()) {
    let es = node.getCards("e");
    for (let i2 = 0; i2 < es.length; i2++) {
      const special = [es[i2]].concat(es[i2].cards || []).find((j) => j.name == es[i2].name && lib.card[j.name]?.cardPrompt);
      str = special ? lib.card[special.name].cardPrompt(special, node) : lib.translate[es[i2].name + "_info"];
      uiintro.add('<div><div class="skill">' + es[i2].outerHTML + "</div><div>" + str + "</div></div>");
      uiintro.content.lastChild.querySelector(".skill>.card").style.transform = "";
      if (lib.translate[es[i2].name + "_append"]) {
        uiintro.add('<div class="text">' + lib.translate[es[i2].name + "_append"] + "</div>");
      }
    }
    let js = node.getCards("j");
    for (let i2 = 0; i2 < js.length; i2++) {
      const Vcard = js[i2][js[i2].cardSymbol];
      if (js[i2].viewAs && Vcard.cards.length == 1 && js[i2].viewAs != Vcard.cards[0].name) {
        let html = Vcard.cards[0].outerHTML;
        let cardInfo = lib.card[js[i2].viewAs], showCardIntro = true;
        if (cardInfo.blankCard) {
          let cardOwner = get.owner(js[i2]);
          if (cardOwner && !cardOwner.isUnderControl(true)) {
            showCardIntro = false;
          }
        }
        if (!showCardIntro) {
          html = ui.create.button(js[i2], "blank").outerHTML;
        }
        uiintro.add(`<div><div class="skill">${html}</div><div>${lib.translate[js[i2].viewAs]}：${lib.card[js[i2].viewAs]?.cardPrompt?.(js[i2], node) || lib.translate[`${js[i2].viewAs}_info`]}</div></div>`);
      } else {
        uiintro.add(`<div><div class="skill">${js[i2].outerHTML}</div><div>${lib.translate[js[i2].name]}：${lib.card[js[i2].name]?.cardPrompt?.(js[i2], node) || lib.translate[`${js[i2].name}_info`]}</div></div>`);
      }
      uiintro.content.lastChild.querySelector(".skill>.card").style.transform = "";
    }
    if (get.is.phoneLayout()) {
      let markCoutainer = ui.create.div(".mark-container.marks");
      for (let i2 in node.marks) {
        const mark = node.marks[i2];
        if (!(mark instanceof HTMLDivElement)) {
          continue;
        }
        const markClone = mark.cloneNode(true);
        if (!(markClone instanceof HTMLDivElement)) {
          continue;
        }
        let nodemark = Object.assign(markClone, { link: mark });
        nodemark.classList.add("pointerdiv");
        nodemark.style.transform = "";
        markCoutainer.appendChild(nodemark);
        nodemark.listen(function() {
          uiintro.noresume = true;
          let rect = mark.getBoundingClientRect();
          ui.click.intro.call(mark, {
            clientX: rect.left + rect.width,
            clientY: rect.top + rect.height / 2
          });
          if (lib.config.touchscreen) {
            uiintro._close();
          }
        });
      }
      if (markCoutainer.childElementCount) {
        uiintro.addText("标记");
        uiintro.add(markCoutainer);
      }
    }
  }
  if (!game.observe && _status.gameStarted && game.me && node != game.me) {
    ui.throwEmotion = [];
    uiintro.addText("发送交互表情");
    let click = (
      /** @this {HTMLDivElement & { link: string }} */
      (function() {
        if (_status.dragged) {
          return;
        }
        if (_status.justdragged) {
          return;
        }
        if (_status.throwEmotionWait) {
          return;
        }
        let emotion = this.link;
        if (game.online) {
          game.send("throwEmotion", node, emotion);
        } else {
          game.getMe().throwEmotion(node, emotion);
        }
        uiintro._close();
        _status.throwEmotionWait = true;
        setTimeout(
          function() {
            _status.throwEmotionWait = false;
            if (ui.throwEmotion) {
              for (let i2 of ui.throwEmotion) {
                i2.classList.remove("exclude");
              }
            }
          },
          emotion == "flower" || emotion == "egg" ? 500 : 5e3
        );
      })
    );
    let table = document.createElement("div");
    table.classList.add("add-setting");
    table.style.margin = "0";
    table.style.width = "100%";
    table.style.position = "relative";
    listi = ["flower", "egg"];
    for (let i2 = 0; i2 < listi.length; i2++) {
      const td = Object.assign(ui.create.div(".menubutton.reduce_radius.pointerdiv.tdnode"), { link: listi[i2] });
      ui.throwEmotion.add(td);
      if (_status.throwEmotionWait) {
        td.classList.add("exclude");
      }
      table.appendChild(td);
      td.innerHTML = "<span>" + get.translation(listi[i2]) + "</span>";
      td.addEventListener(lib.config.touchscreen ? "touchend" : "click", click);
    }
    uiintro.content.appendChild(table);
    table = document.createElement("div");
    table.classList.add("add-setting");
    table.style.margin = "0";
    table.style.width = "100%";
    table.style.position = "relative";
    listi = ["wine", "shoe"];
    if (game.me.storage.zhuSkill_shanli) {
      listi = ["yuxisx", "jiasuo"];
    }
    for (let i2 = 0; i2 < listi.length; i2++) {
      const td = Object.assign(ui.create.div(".menubutton.reduce_radius.pointerdiv.tdnode"), { link: listi[i2] });
      ui.throwEmotion.add(td);
      if (_status.throwEmotionWait) {
        td.classList.add("exclude");
      }
      table.appendChild(td);
      td.innerHTML = "<span>" + get.translation(listi[i2]) + "</span>";
      td.addEventListener(lib.config.touchscreen ? "touchend" : "click", click);
    }
    uiintro.content.appendChild(table);
  }
  let modepack = lib.characterPack["mode_" + get.mode()];
  if (lib.config.show_favourite && lib.character[node.name] && game.players.includes(node) && (!modepack || !modepack[node.name]) && (!simple || get.is.phoneLayout())) {
    let addFavourite = Object.assign(ui.create.div(".text.center.pointerdiv"), { link: node.name });
    addFavourite.style.marginRight = "15px";
    if (lib.config.favouriteCharacter.includes(node.name)) {
      addFavourite.innerHTML = "移除收藏";
    } else {
      addFavourite.innerHTML = "添加收藏";
    }
    addFavourite.listen(ui.click.favouriteCharacter);
    uiintro.add(addFavourite);
  }
  if (!simple || get.is.phoneLayout()) {
    if (!node.name.startsWith("unknown")) {
      let viewInfo = Object.assign(ui.create.div(".text.center.pointerdiv"), { link: node });
      viewInfo.innerHTML = "查看资料";
      viewInfo.listen(function() {
        let player = node;
        let audioName = player.skin.name || player.name1 || player.name;
        ui.click.charactercard(player.name1 || player.name, null, null, true, player.node.avatar, audioName);
      });
      uiintro.add(viewInfo);
    }
  }
  if ((lib.config.change_skin || lib.skin) && (!simple || get.is.phoneLayout())) {
    [node.name1, node.name2].forEach((nameskin, index) => {
      if (nameskin) {
        createButtons(nameskin, (src) => {
          const avatar = node.node[index ? "avatar2" : "avatar"];
          if (src === "origin") avatar.setBackground(nameskin, "character");
          else avatar.style.backgroundImage = `url('${src}')`;
        });
      }
    });
  }
  uiintro.add(ui.create.div(".placeholder.slim"));
}
export {
  playerDetails
};

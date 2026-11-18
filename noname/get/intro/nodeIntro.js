import "../../../noname.js";
import "../dependencies.js";
import { skinButtons } from "./skin.js";
import { playerProfile } from "./playerProfile.js";
import { playerDetails } from "./playerDetails.js";
import { markIntro } from "./markIntro.js";
import { cardIntro } from "./cardIntro.js";
import { characterIntro } from "./characterIntro.js";
import { ui } from "../../ui/index.js";
import { lib } from "../../library/index.js";
import { get } from "../binding.js";
import { _status } from "../../status/index.js";
const nodeIntroMethods = {
  nodeintro(node, simple, evt, uiintro) {
    uiintro ??= ui.create.dialog("hidden", "notouchscroll");
    uiintro.setAttribute("id", "nodeintro");
    if (node.classList.contains("player") && !node.name) {
      return uiintro;
    }
    let i, translation, intro, str;
    if (node._nointro) {
      return;
    }
    const createButtons = skinButtons(uiintro);
    if (typeof node._customintro == "function") {
      if (node._customintro(uiintro, evt) === false) {
        return;
      }
      if (evt) {
        lib.placePoppedDialog(uiintro, evt);
      }
    } else if (Array.isArray(node._customintro)) {
      let caption = node._customintro[0];
      let content = node._customintro[1];
      if (typeof caption == "function") {
        caption = caption(node);
      }
      if (typeof content == "function") {
        content = content(node);
      }
      uiintro.add(caption);
      uiintro.add('<div class="text center" style="padding-bottom:5px">' + content + "</div>");
    } else if (node.classList.contains("player") || node.linkplayer) {
      if (node.linkplayer) node = node.link;
      playerProfile(node, simple, evt, uiintro);
      playerDetails(node, simple, evt, uiintro, createButtons);
    } else if (node.classList.contains("mark") && node.info && node.parentNode && node.parentNode.parentNode && node.parentNode.parentNode.classList.contains("player")) {
      return markIntro(node, simple, evt, uiintro, createButtons);
    } else if (node.classList.contains("card")) {
      return cardIntro(node, simple, evt, uiintro, createButtons);
    } else if (node.classList.contains("character")) {
      return characterIntro(node, simple, evt, uiintro, createButtons);
    } else if (node.classList.contains("equips") && ui.arena.classList.contains("selecting")) {
      (function() {
        uiintro.add("选择装备");
        uiintro.addSmall(
          Array.from(node.childNodes).filter((node2) => !node2.classList.contains("emptyequip") && !node2.classList.contains("feichu")),
          true
        );
        uiintro.clickintro = true;
        ui.control.hide();
        uiintro._onclose = function() {
          ui.control.show();
        };
        let confirmbutton;
        for (let i2 = 0; i2 < uiintro.buttons.length; i2++) {
          let button = uiintro.buttons[i2];
          const equipButton = Object.assign(button, { link: button.link });
          button.classList.add("pointerdiv");
          if (button.link.classList.contains("selected")) {
            button.classList.add("selected");
          }
          equipButton.listen(
            /** @this {RuntimeCardButton} */
            function(e) {
              ui.click.card.call(this.link, "popequip");
              ui.click.window.call(ui.window);
              if (this.link.classList.contains("selected")) {
                this.classList.add("selected");
              } else {
                this.classList.remove("selected");
              }
              if (ui.confirm && ui.confirm.str && ui.confirm.str.includes("o")) {
                confirmbutton.classList.remove("disabled");
              } else {
                confirmbutton.classList.add("disabled");
              }
            }
          );
        }
        let buttoncontainer = uiintro.add(ui.create.div());
        buttoncontainer.style.display = "block";
        confirmbutton = ui.create.div(
          ".menubutton.large.pointerdiv",
          "确定",
          function() {
            if (ui.confirm && ui.confirm.str && ui.confirm.str.includes("o")) {
              uiintro._clickintro();
              ui.click.ok(ui.confirm.firstChild);
            }
          },
          buttoncontainer
        );
        confirmbutton.style.position = "relative";
        setTimeout(function() {
          if (ui.confirm && ui.confirm.str && ui.confirm.str.includes("o")) {
            confirmbutton.classList.remove("disabled");
          } else {
            confirmbutton.classList.add("disabled");
          }
        }, 300);
      })();
    } else if (node.classList.contains("identity") && node.dataset.career) {
      let career = node.dataset.career;
      uiintro.add(get.translation(career));
      uiintro.add('<div class="text center" style="padding-bottom:5px">' + lib.translate["_" + career + "_skill_info"] + "</div>");
    } else if (node.classList.contains("skillbar")) {
      if (node == ui.friendBar) {
        uiintro.add("友方怒气值");
        uiintro.add('<div class="text center" style="padding-bottom:5px">' + _status.friendRage + "/100</div>");
      } else if (node == ui.enemyBar) {
        uiintro.add("敌方怒气值");
        uiintro.add('<div class="text center" style="padding-bottom:5px">' + _status.enemyRage + "/100</div>");
      }
    } else if (node.parentNode == ui.historybar) {
      if (node.dead) {
        if (!node.source || node.source == node.player) {
          uiintro.add('<div class="text center">' + get.translation(node.player) + "阵亡</div>");
          uiintro.addSmall([node.player]);
        } else {
          uiintro.add('<div class="text center">' + get.translation(node.player) + "被" + get.translation(node.source) + "杀害</div>");
          uiintro.addSmall([node.source]);
        }
      }
      if (node.skill) {
        uiintro.add('<div class="text center">' + get.translation(node.skill) + "</div>");
        uiintro._place_text = uiintro.add('<div class="text" style="display:inline">' + get.translation(node.skill, "info") + "</div>");
      }
      if (node.targets && get.itemtype(node.targets) == "players") {
        uiintro.add('<div class="text center">目标</div>');
        uiintro.addSmall(node.targets);
      }
      if (node.players && node.players.length > 1) {
        uiintro.add('<div class="text center">使用者</div>');
        uiintro.addSmall(node.players);
      }
      if (node.cards && node.cards.length) {
        uiintro.add('<div class="text center">卡牌</div>');
        uiintro.addSmall(node.cards);
      }
      for (let i2 = 0; i2 < node.added.length; i2++) {
        uiintro.add(node.added[i2]);
      }
      if (node.added.length) {
        uiintro.add(ui.create.div(".placeholder.slim"));
      }
      if (uiintro.content.firstChild) {
        uiintro.content.firstChild.style.paddingTop = "3px";
      }
    } else if (node.classList.contains("nodeintro")) {
      if (node.nodeTitle) {
        uiintro.add(node.nodeTitle);
      }
      uiintro._place_text = uiintro.add('<div class="text">' + node.nodeContent + "</div>");
    }
    if (lib.config.touchscreen) {
      lib.setScroll(uiintro.contentContainer);
    }
    return uiintro;
  }
};
export {
  nodeIntroMethods
};

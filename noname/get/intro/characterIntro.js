import "../../../noname.js";
import "../dependencies.js";
import { finishIntro } from "./finish.js";
import { get } from "../binding.js";
import { lib } from "../../library/index.js";
import { game } from "../../game/index.js";
import { ui } from "../../ui/index.js";
import { requireRegisteredSkill } from "../../library/skillRegistry.js";
function characterIntro(node, simple, evt, uiintro, createButtons) {
  let cfg;
  let i, translation, intro, str;
  const character = node.link, characterInfo = get.character(node.link);
  let capt = get.translation(character);
  if (characterInfo) {
    const infoSex = characterInfo[0];
    if (infoSex && lib.config.show_sex) {
      capt += `&nbsp;&nbsp;${infoSex == "none" ? "无" : lib.translate[infoSex]}`;
    }
    const infoGroup = characterInfo[1];
    if (infoGroup && lib.config.show_group) {
      const group = get.is.double(character, []);
      if (Array.isArray(group)) {
        capt += `&nbsp;&nbsp;${group.map((value) => get.translation(value)).join("/")}`;
      } else {
        capt += `&nbsp;&nbsp;${lib.translate[infoGroup]}`;
      }
    }
  }
  uiintro.add(capt);
  if (lib.characterTitle[node.link]) {
    uiintro.addText(get.colorspan(lib.characterTitle[node.link]));
  }
  if (lib.characterAppend[node.link]) {
    uiintro.addText(get.colorspan(lib.characterAppend[node.link]));
  }
  if (lib.config.show_sortPack) {
    for (let packname in lib.characterPack) {
      if (node.link in lib.characterPack[packname]) {
        let pack = lib.translate[packname + "_character_config"], sort;
        if (lib.characterSort[packname]) {
          let sorted = lib.characterSort[packname];
          for (let sortname in sorted) {
            if (sorted[sortname].includes(node.link)) {
              sort = `<span style = "font-size:small">[${lib.translate[sortname]}]</span>`;
              break;
            }
          }
        }
        const sortPack = document.createElement("div");
        sortPack.innerHTML = `${pack}${sort ? `<br>${sort}` : ""}`;
        sortPack.appendChild(document.createElement("hr"));
        sortPack.insertBefore(document.createElement("hr"), sortPack.firstChild);
        uiintro.add(sortPack);
        break;
      }
    }
  }
  if (get.characterInitFilter(node.link)) {
    const initFilters = get.characterInitFilter(node.link).filter((tag) => {
      if (!lib.characterInitFilter[node.link]) {
        return true;
      }
      return lib.characterInitFilter[node.link](tag) !== false;
    });
    if (initFilters.length) {
      const str2 = initFilters.reduce((strx, stry) => strx + lib.InitFilter[stry] + "<br>", "").slice(0, -4);
      uiintro.addText(str2);
    }
  }
  if (node._banning) {
    let clickBanned = (
      /** @this {HTMLDivElement} */
      (function() {
        const bannedname = this.dataset.bannedname;
        if (typeof bannedname != "string" || !bannedname) {
          return;
        }
        const configured = lib.config[bannedname];
        let banned = Array.isArray(configured) ? configured : [];
        if (banned.includes(character)) {
          banned.splice(banned.indexOf(character), 1);
        } else {
          banned.push(character);
        }
        game.saveConfig(bannedname, banned);
        this.classList.toggle("on");
        if (node.updateBanned) {
          node.updateBanned();
        }
      })
    );
    let modeorder = lib.config.modeorder || [];
    for (let i2 in lib.mode) {
      modeorder.add(i2);
    }
    let list = [];
    uiintro.contentContainer.listen(function(e) {
      ui.click.touchpop();
      e.stopPropagation();
    });
    for (let i2 = 0; i2 < modeorder.length; i2++) {
      if (node._banning == "online") {
        if (!lib.mode[modeorder[i2]].connect) {
          continue;
        }
        if (!lib.config["connect_" + modeorder[i2] + "_banned"]) {
          lib.config["connect_" + modeorder[i2] + "_banned"] = [];
        }
      } else if (modeorder[i2] == "connect" || modeorder[i2] == "brawl") {
        continue;
      }
      if (lib.config.all.mode.includes(modeorder[i2])) {
        list.push(modeorder[i2]);
      }
    }
    let page = ui.create.div(".menu-buttons.configpopped", uiintro.content);
    let banall = false;
    for (let i2 = 0; i2 < list.length; i2++) {
      cfg = ui.create.div(".config", lib.translate[list[i2]] + "模式", page);
      cfg.classList.add("toggle");
      if (node._banning == "offline") {
        cfg.dataset.bannedname = list[i2] + "_banned";
      } else {
        cfg.dataset.bannedname = "connect_" + list[i2] + "_banned";
      }
      cfg.listen(clickBanned);
      ui.create.div(ui.create.div(cfg));
      const bannedname = cfg.dataset.bannedname;
      const configured = typeof bannedname == "string" && bannedname ? lib.config[bannedname] : void 0;
      let banned = Array.isArray(configured) ? configured : [];
      if (!banned.includes(character)) {
        cfg.classList.add("on");
        banall = true;
      }
    }
    if (node._banning == "offline") {
      cfg = ui.create.div(".config", "随机选将可用", page);
      cfg.classList.add("toggle");
      cfg.listen(function() {
        this.classList.toggle("on");
        if (this.classList.contains("on")) {
          lib.config.forbidai_user.remove(character);
        } else {
          lib.config.forbidai_user.add(character);
        }
        game.saveConfig("forbidai_user", lib.config.forbidai_user);
      });
      ui.create.div(ui.create.div(cfg));
      if (!lib.config.forbidai_user.includes(character)) {
        cfg.classList.add("on");
      }
    }
    ui.create.div(".menubutton.pointerdiv", banall ? "全部禁用" : "全部启用", uiintro.content, function() {
      if (this.innerHTML == "全部禁用") {
        for (const child of page.children) {
          if (child instanceof HTMLDivElement) {
            const bannedname = child.dataset.bannedname;
            if (typeof bannedname == "string" && bannedname && child.classList.contains("on")) {
              clickBanned.call(child);
            }
          }
        }
        this.innerHTML = "全部启用";
      } else {
        for (const child of page.children) {
          if (child instanceof HTMLDivElement) {
            const bannedname = child.dataset.bannedname;
            if (typeof bannedname == "string" && bannedname && !child.classList.contains("on")) {
              clickBanned.call(child);
            }
          }
        }
        this.innerHTML = "全部禁用";
      }
    }).style.marginTop = "-10px";
    ui.create.div(".placeholder.slim", uiintro.content);
  } else {
    let skills = get.character(character, 3);
    for (i = 0; i < skills.length; i++) {
      if (lib.translate[skills[i] + "_info"]) {
        if (lib.translate[skills[i] + "_ab"]) {
          translation = lib.translate[skills[i] + "_ab"];
        } else {
          translation = get.translation(skills[i]);
          if (!requireRegisteredSkill(lib.skill, skills[i]).nobracket) {
            translation = `【${translation.slice(0, 2)}】`;
          }
        }
        uiintro.add('<div><div class="skill">' + translation + "</div><div>" + get.skillInfoTranslation(skills[i], null, false) + "</div></div>");
        if (lib.translate[skills[i] + "_append"]) {
          uiintro._place_text = uiintro.add('<div class="text">' + lib.translate[skills[i] + "_append"] + "</div>");
        }
      }
    }
    let modepack = lib.characterPack["mode_" + get.mode()];
    if (lib.config.show_favourite && lib.character[node.link] && (!modepack || !modepack[node.link]) && (!simple || get.is.phoneLayout())) {
      let addFavourite = Object.assign(ui.create.div(".text.center.pointerdiv"), { link: node.link });
      addFavourite.style.marginBottom = "15px";
      addFavourite.style.marginRight = "15px";
      if (lib.config.favouriteCharacter.includes(node.link)) {
        addFavourite.innerHTML = "移除收藏";
      } else {
        addFavourite.innerHTML = "添加收藏";
      }
      addFavourite.listen(ui.click.favouriteCharacter);
      uiintro.add(addFavourite);
    } else {
      uiintro.add(ui.create.div(".placeholder.slim"));
    }
    if (!simple || get.is.phoneLayout()) {
      let viewInfo = Object.assign(ui.create.div(".text.center.pointerdiv"), { link: node.link });
      viewInfo.innerHTML = "查看资料";
      viewInfo.style.marginBottom = "15px";
      viewInfo.listen(function() {
        return ui.click.charactercard(node.link, node);
      });
      uiintro.add(viewInfo);
    }
    if ((lib.config.change_skin || lib.skin) && (!simple || get.is.phoneLayout())) {
      const nameskin = node.link;
      if (nameskin) {
        createButtons(nameskin, (src) => {
          if (src === "origin") node.setBackground(nameskin, "character");
          else node.style.backgroundImage = `url('${src}')`;
        });
      }
    }
  }
  return finishIntro(uiintro);
}
export {
  characterIntro
};

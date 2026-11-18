import "../../../noname.js";
import { getSubfrequent } from "../dependencies.js";
import { get } from "../binding.js";
import { lib } from "../../library/index.js";
import { game } from "../../game/index.js";
import { getRegisteredSkill } from "../../library/skillRegistry.js";
import { _status } from "../../status/index.js";
import { ui } from "../../ui/index.js";
function playerProfile(node, simple, evt, uiintro) {
  let underlinenode, j;
  let i, translation, intro, str;
  let capt = get.translation(node.name);
  const characterInfo = get.character(node.name), sex = node.sex || characterInfo[0];
  if (sex && sex != "unknown" && lib.config.show_sex) {
    capt += `&nbsp;&nbsp;${sex == "none" ? "无" : get.translation(sex)}`;
  }
  const group = node.group;
  if (group && group != "unknown" && lib.config.show_group) {
    capt += `&nbsp;&nbsp;${get.translation(group)}`;
  }
  uiintro.add(capt);
  if (lib.characterTitle[node.name]) {
    uiintro.addText(get.colorspan(lib.characterTitle[node.name]));
  }
  if (lib.characterAppend[node.name]) {
    uiintro.addText(get.colorspan(lib.characterAppend[node.name]));
  }
  if (lib.config.show_sortPack) {
    for (let packname in lib.characterPack) {
      if (node.name in lib.characterPack[packname]) {
        let pack = lib.translate[packname + "_character_config"], sort;
        if (lib.characterSort[packname]) {
          let sorted = lib.characterSort[packname];
          for (let sortname in sorted) {
            if (sorted[sortname].includes(node.name)) {
              sort = `<span style = "font-size:small">${lib.translate[sortname]}</span>`;
              break;
            }
          }
        }
        const sortPack = document.createElement("div");
        sortPack.innerHTML = `${pack}${sort ? `<br>[${sort}]` : ""}`;
        sortPack.appendChild(document.createElement("hr"));
        sortPack.insertBefore(document.createElement("hr"), sortPack.firstChild);
        uiintro.add(sortPack);
        break;
      }
    }
  }
  if (get.characterInitFilter(node.name)) {
    const initFilters = get.characterInitFilter(node.name).filter((tag) => {
      if (!lib.characterInitFilter[node.name]) {
        return true;
      }
      return lib.characterInitFilter[node.name](tag) !== false;
    });
    if (initFilters.length) {
      const str2 = initFilters.reduce((strx, stry) => strx + lib.InitFilter[stry] + "<br>", "").slice(0, -4);
      uiintro.addText(str2);
    }
  }
  let skills = node.getSkills(null, false, false).slice(0);
  let skills2 = game.filterSkills(skills, node);
  if (node == game.me && node.hiddenSkills.length) {
    skills.addArray(node.hiddenSkills);
  }
  for (let i2 in node.disabledSkills) {
    if (node.disabledSkills[i2].length == 1 && node.disabledSkills[i2][0] == i2 + "_awake" && !node.hiddenSkills.includes(i2)) {
      skills.add(i2);
    }
  }
  for (i = 0; i < skills.length; i++) {
    const skillInfo = getRegisteredSkill(lib.skill, skills[i]);
    if (!skillInfo || skillInfo.nopop || skillInfo.equipSkill) {
      continue;
    }
    if (lib.translate[skills[i] + "_info"]) {
      if (lib.translate[skills[i] + "_ab"]) {
        translation = lib.translate[skills[i] + "_ab"];
      } else {
        translation = get.translation(skills[i]);
        if (!skillInfo.nobracket) {
          translation = `【${translation.slice(0, 2)}】`;
        }
      }
      if (node.forbiddenSkills[skills[i]]) {
        let forbidstr = '<div style="opacity:0.5"><div class="skill">' + translation + "</div><div>";
        if (node.forbiddenSkills[skills[i]].length) {
          forbidstr += "（与" + get.translation(node.forbiddenSkills[skills[i]]) + "冲突）<br>";
        } else {
          forbidstr += "（双将禁用）<br>";
        }
        forbidstr += get.skillInfoTranslation(skills[i], node, false) + "</div></div>";
        uiintro.add(forbidstr);
      } else if (!skills2.includes(skills[i])) {
        if (skillInfo.preHidden && get.mode() == "guozhan") {
          uiintro.add('<div><div class="skill" style="opacity:0.5">' + translation + '</div><div><span style="opacity:0.5">' + get.skillInfoTranslation(skills[i], node, false) + '</span><br><div class="underlinenode on gray" style="position:relative;padding-left:0;padding-top:7px">预亮技能</div></div></div>');
          underlinenode = uiintro.content.lastChild.querySelector(".underlinenode");
          if (_status.prehidden_skills.includes(skills[i])) {
            underlinenode.classList.remove("on");
          }
          underlinenode.link = skills[i];
          underlinenode.listen(ui.click.hiddenskill);
        } else {
          uiintro.add('<div style="opacity:0.5"><div class="skill">' + translation + "</div><div>" + get.skillInfoTranslation(skills[i], node, false) + "</div></div>");
        }
      } else if (skillInfo.temp || !node.skills.includes(skills[i]) || skillInfo.thundertext) {
        if (skillInfo.frequent || getSubfrequent(lib.skill, skills[i])) {
          uiintro.add('<div><div class="skill thundertext thunderauto">' + translation + '</div><div class="thundertext thunderauto">' + get.skillInfoTranslation(skills[i], node, false) + '<br><div class="underlinenode on gray" style="position:relative;padding-left:0;padding-top:7px">自动发动</div></div></div>');
          underlinenode = uiintro.content.lastChild.querySelector(".underlinenode");
          if (skillInfo.frequent) {
            if (lib.config.autoskilllist.includes(skills[i])) {
              underlinenode.classList.remove("on");
            }
          }
          const subfrequent = getSubfrequent(lib.skill, skills[i]);
          if (subfrequent) {
            for (j = 0; j < subfrequent.length; j++) {
              if (lib.config.autoskilllist.includes(skills[i] + "_" + subfrequent[j])) {
                underlinenode.classList.remove("on");
              }
            }
          }
          if (lib.config.autoskilllist.includes(skills[i])) {
            underlinenode.classList.remove("on");
          }
          underlinenode.link = skills[i];
          underlinenode.listen(ui.click.autoskill2);
        } else {
          uiintro.add('<div><div class="skill thundertext thunderauto">' + translation + '</div><div class="thundertext thunderauto">' + get.skillInfoTranslation(skills[i], node, false) + "</div></div>");
        }
      } else if (skillInfo.frequent || getSubfrequent(lib.skill, skills[i])) {
        uiintro.add('<div><div class="skill">' + translation + "</div><div>" + get.skillInfoTranslation(skills[i], node, false) + '<br><div class="underlinenode on gray" style="position:relative;padding-left:0;padding-top:7px">自动发动</div></div></div>');
        underlinenode = uiintro.content.lastChild.querySelector(".underlinenode");
        if (skillInfo.frequent) {
          if (lib.config.autoskilllist.includes(skills[i])) {
            underlinenode.classList.remove("on");
          }
        }
        const subfrequent = getSubfrequent(lib.skill, skills[i]);
        if (subfrequent) {
          for (j = 0; j < subfrequent.length; j++) {
            if (lib.config.autoskilllist.includes(skills[i] + "_" + subfrequent[j])) {
              underlinenode.classList.remove("on");
            }
          }
        }
        if (lib.config.autoskilllist.includes(skills[i])) {
          underlinenode.classList.remove("on");
        }
        underlinenode.link = skills[i];
        underlinenode.listen(ui.click.autoskill2);
      } else if (skillInfo.clickable && node.isIn() && node.isUnderControl(true)) {
        let intronode = uiintro.add('<div><div class="skill">' + translation + "</div><div>" + get.skillInfoTranslation(skills[i], node, false) + '<br><div class="menubutton skillbutton" style="position:relative;margin-top:5px">点击发动</div></div></div>').querySelector(".skillbutton");
        const clickableFilter = skillInfo.clickableFilter;
        if (!_status.gameStarted || clickableFilter && !clickableFilter(node)) {
          intronode.classList.add("disabled");
          intronode.style.opacity = 0.5;
        } else {
          intronode.link = node;
          intronode.func = skillInfo.clickable;
          intronode.classList.add("pointerdiv");
          intronode.listen(() => uiintro.close());
          intronode.listen(ui.click.skillbutton);
        }
      } else {
        uiintro.add('<div><div class="skill">' + translation + "</div><div>" + get.skillInfoTranslation(skills[i], node, false) + "</div></div>");
      }
      if (lib.translate[skills[i] + "_append"]) {
        uiintro._place_text = uiintro.add('<div class="text">' + lib.translate[skills[i] + "_append"] + "</div>");
      }
    }
  }
}
export {
  playerProfile
};

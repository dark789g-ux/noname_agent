import "../../../../noname.js";
import { isCharacterSkillButton } from "../contracts/domTargetsContract.js";
import { lib } from "../../../library/index.js";
import { get } from "../../../get/binding.js";
import { game } from "../../../game/index.js";
import { ui } from "../../index.js";
function initDirectorySkinSelector(opts) {
  let changeskinfunc = null;
  if (!lib.config.change_skin) {
    return { getChangeSkinHandler: () => changeskinfunc };
  }
  const src = get.skinPath(opts.name);
  if (!src) {
    return { getChangeSkinHandler: () => changeskinfunc };
  }
  const getFileList = game.getFileList;
  if (!getFileList) {
    throw new Error("Character skin selection requires getFileList");
  }
  let node;
  let avatars;
  const { name, audioName, nameskin, nameskin2, gzbool, bg, playerbg, sourcenode, avatar, onSkinChanged } = opts;
  const createButtons = (list) => {
    if (!list.length) {
      return;
    }
    if (list.length >= 6) {
      avatars.classList.add("scroll");
      if (lib.config.touchscreen) {
        lib.setScroll(avatars);
      }
    }
    for (const item of ["originSkin", ...list]) {
      const button = ui.create.div(avatars, function() {
        playerbg.classList.remove("scroll");
        if (this._link) {
          const skinname = this._skinName;
          const skinSrc = this._link;
          lib.config.skin[nameskin] = [skinname, skinSrc];
          if (lib.characterSubstitute[nameskin]) {
            for (const nameList of lib.characterSubstitute[nameskin]) {
              const subName = nameList[0];
              const [fold, prefix] = skinname.split(".");
              lib.config.skin[subName] = [skinname, `${skinSrc.split("/").slice(0, -1).join("/")}/${fold}/${subName}.${prefix}`];
            }
          }
          bg.style.backgroundImage = this.style.backgroundImage;
          if (sourcenode) {
            sourcenode.style.backgroundImage = this.style.backgroundImage;
          }
          if (avatar) {
            avatar.style.backgroundImage = this.style.backgroundImage;
          }
          game.saveConfig("skin", lib.config.skin);
        } else {
          delete lib.config.skin[nameskin];
          if (lib.characterSubstitute[nameskin]) {
            for (const nameList of lib.characterSubstitute[nameskin]) {
              delete lib.config.skin[nameList[0]];
            }
          }
          const targetName = gzbool && lib.character[nameskin2].hasSkinInGuozhan && lib.config.mode_config.guozhan.guozhanSkin ? audioName || nameskin2 : audioName || nameskin;
          bg.setBackground(targetName, "character");
          if (sourcenode) {
            sourcenode.setBackground(targetName, "character");
          }
          if (avatar) {
            avatar.setBackground(targetName, "character");
          }
          game.saveConfig("skin", lib.config.skin);
        }
        onSkinChanged();
      });
      if (item == "originSkin") {
        const originTarget = gzbool && lib.character[nameskin2].hasSkinInGuozhan && lib.config.mode_config.guozhan.guozhanSkin ? audioName || nameskin2 : audioName || nameskin;
        button.setBackground(originTarget, "character", "noskin");
      } else {
        const [skinname, skinSrc] = item;
        button._link = skinSrc;
        button._skinName = skinname;
        if (name == audioName) {
          button.setBackgroundImage(skinSrc);
        } else {
          const [fold, prefix] = skinname.split(".");
          button.setBackgroundImage(`${skinSrc.split("/").slice(0, -1).join("/")}/${fold}/${audioName}.${prefix}`);
        }
      }
    }
  };
  const defaultFolder = src;
  getFileList.call(
    game,
    defaultFolder,
    (_folders, files) => {
      if (files.length && !node) {
        node = ui.create.div(".changeskin", "可换肤", playerbg);
        avatars = ui.create.div(".avatars", playerbg);
        changeskinfunc = function() {
          playerbg.classList.add("scroll");
          if (node._created) {
            return;
          }
          node._created = true;
          getFileList.call(
            game,
            defaultFolder,
            (_subFolders, subFiles) => {
              const list = subFiles.map((file) => [file, `${defaultFolder}${file}`]);
              createButtons(list);
            },
            () => {
            }
          );
        };
      }
    },
    () => {
    }
  );
  return { getChangeSkinHandler: () => changeskinfunc };
}
function createSubstituteSkinRefresher(opts) {
  const { name, uiintro, getIntro, bg, sourcenode, avatar, refreshIntro } = opts;
  return function refreshSkin() {
    const intro = getIntro() || uiintro.querySelector(".characterintro");
    if (!intro) {
      return;
    }
    intro.style.display = "flex";
    intro.style.flexDirection = "column";
    const contentWrapper = ui.create.div(".intro-content-wrapper");
    contentWrapper.style.flex = "1";
    while (intro.firstChild) {
      contentWrapper.appendChild(intro.firstChild);
    }
    intro.appendChild(contentWrapper);
    delete bg.tempSkin;
    const skillButtons = document.getElementsByClassName("characterskill")?.[0]?.childNodes;
    if (skillButtons) {
      for (let i = 0; i < skillButtons.length; i++) {
        const skillButton = skillButtons[i];
        if (isCharacterSkillButton(skillButton)) {
          delete skillButton.playAudio;
        }
      }
    }
    const currentSkinsContainer = intro.querySelector(".skins-container");
    if (currentSkinsContainer) {
      currentSkinsContainer.remove();
    }
    const skinsContainer = ui.create.div(".skins-container", intro);
    skinsContainer.style.marginTop = "auto";
    skinsContainer.style.paddingTop = "20px";
    const skinsList = ui.create.div(".skins-list.horizontal", skinsContainer);
    skinsList.style.display = "flex";
    skinsList.style.flexWrap = "wrap";
    skinsList.style.gap = "8px";
    skinsList.style.justifyContent = "flex-start";
    const skinList = lib.characterSubstitute[name];
    const skinButtonList = [name, ...skinList.map((skin) => skin[0])];
    for (const skinName of skinButtonList) {
      const clickSkin = function() {
        bg.style.backgroundImage = this.style.backgroundImage;
        bg.tempSkin = this.name;
        const nodes = document.getElementsByClassName("characterskill")?.[0]?.childNodes;
        if (nodes) {
          for (let i = 0; i < nodes.length; i++) {
            const skillButton = nodes[i];
            if (isCharacterSkillButton(skillButton)) {
              delete skillButton.playAudio;
            }
          }
        }
        const existingSkins = intro.querySelector(".skins-container");
        if (existingSkins) {
          existingSkins.remove();
        }
        const currentWrapper = intro.querySelector(".intro-content-wrapper");
        if (currentWrapper) {
          while (intro.firstChild) {
            intro.removeChild(intro.firstChild);
          }
          while (currentWrapper.firstChild) {
            intro.appendChild(currentWrapper.firstChild);
          }
        }
        refreshIntro();
        intro.style.display = "flex";
        intro.style.flexDirection = "column";
        const newWrapper = ui.create.div(".intro-content-wrapper");
        newWrapper.style.flex = "1";
        while (intro.firstChild && (!(intro.firstChild instanceof Element) || !intro.firstChild.classList.contains("skins-container"))) {
          newWrapper.appendChild(intro.firstChild);
        }
        if (intro.firstChild) {
          intro.insertBefore(newWrapper, intro.firstChild);
        } else {
          intro.appendChild(newWrapper);
        }
        if (existingSkins) {
          intro.appendChild(existingSkins);
        }
        game.callHook("refreshSkin", [skinButtonList[0], this.name, sourcenode, avatar]);
      };
      const skinButton = Object.assign(ui.create.div(".skin-button", skinsList, clickSkin), { name: skinName });
      skinButton.style.width = "80px";
      skinButton.style.height = "110px";
      skinButton.style.borderRadius = "4px";
      skinButton.style.backgroundSize = "cover";
      skinButton.style.backgroundPosition = "50% 0";
      skinButton.style.boxShadow = "rgba(0, 0, 0, 0.2) 0 0 0 1px, rgba(0, 0, 0, 0.45) 0 0 5px";
      skinButton.style.cursor = "pointer";
      let isTemp = false;
      if (!lib.character[skinName] && skinList.some((skin) => skin[0] == skinName)) {
        isTemp = true;
        lib.character[skinName] = get.convertedCharacter(["", "", 0, [], (skinList.find((skin) => skin[0] == skinName) || [skinName, []])[1]]);
      }
      const skinImg = !lib.config.skin[skinName] && lib.character[skinName]?.img;
      skinImg ? skinButton.setBackgroundImage(skinImg) : skinButton.setBackground(skinName, "character");
      if (isTemp) {
        delete lib.character[skinName];
      }
    }
  };
}
export {
  createSubstituteSkinRefresher,
  initDirectorySkinSelector
};

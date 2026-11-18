import "../../../noname.js";
import "../dependencies.js";
import { get } from "../binding.js";
import { game } from "../../game/index.js";
import { ui } from "../../ui/index.js";
import { lib } from "../../library/index.js";
function skinButtons(uiintro) {
  let created = false;
  const createButtons = function(nameskin, avatarSetter) {
    const srcBase = get.skinPath(nameskin);
    if (!srcBase) {
      return;
    }
    if (!game.getFileList) {
      throw new TypeError("Skin browsing requires the platform getFileList API");
    }
    game.getFileList(
      srcBase,
      (folders, files) => {
        if (!files.length) {
          return;
        }
        if (!created) {
          created = true;
          uiintro.add('<div class="text center">更改皮肤</div>');
        }
        const avatars = ui.create.div(".buttons.smallzoom.scrollbuttons");
        lib.setMousewheel(avatars);
        uiintro.add(avatars);
        const originButton = ui.create.div(".button.character.pointerdiv", avatars, function() {
          delete lib.config.skin[nameskin];
          if (lib.characterSubstitute[nameskin]) {
            for (const list of lib.characterSubstitute[nameskin]) delete lib.config.skin[list[0]];
          }
          avatarSetter("origin");
          game.saveConfig("skin", lib.config.skin);
        });
        originButton.setBackground(nameskin, "character", "noskin");
        const originSkin = ui.create.caption(`<div class="text" data-nature=shenmm style="font-size: 12px">经典形象</div>`, originButton);
        originSkin.style.left = "1px";
        originSkin.style.bottom = "-1px";
        files.forEach((file) => {
          const src = `${srcBase}${file}`, skinname = file;
          const button = ui.create.div(".button.character.pointerdiv", avatars, function() {
            lib.config.skin[nameskin] = [skinname, src];
            if (lib.characterSubstitute[nameskin]) {
              for (const list of lib.characterSubstitute[nameskin]) {
                const sub = list[0], [fold, prefix] = skinname.split(".");
                lib.config.skin[sub] = [skinname, `${srcBase}${fold}/${sub}.${prefix}`];
              }
            }
            avatarSetter(src);
            game.saveConfig("skin", lib.config.skin);
          });
          button.setBackgroundImage(src);
          const skinCaption = ui.create.caption(`<div class="text" data-nature=shenmm style="font-size: 12px">${get.translation(skinname.slice(0, -4))}</div>`, button);
          skinCaption.style.left = "1px";
          skinCaption.style.bottom = "-1px";
        });
      },
      () => {
      }
    );
  };
  return createButtons;
}
export {
  skinButtons
};

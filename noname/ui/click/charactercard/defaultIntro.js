import "../../../../noname.js";
import { resolveCharacterRubyDisplay } from "./rubyText.js";
import { lib } from "../../../library/index.js";
import { game } from "../../../game/index.js";
import { get } from "../../../get/binding.js";
import { ui } from "../../index.js";
function resolveCardImageSource(imageName) {
  const information = lib.card[imageName];
  if (!information || !information.image) {
    return Promise.resolve(`${lib.assetURL}image/card/${imageName}.png`);
  }
  const image = information.image;
  if (typeof image == "string" && image.startsWith("db:")) {
    return game.getDB("image", image.slice(3)).then((value) => String(value));
  }
  if (typeof image == "string" && image.startsWith("ext:")) {
    return Promise.resolve(`${lib.assetURL}${image.replace(/^ext:/, "extension/")}`);
  }
  return Promise.resolve(`${lib.assetURL}${image}`);
}
function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}
function renderDefaultCharacterIntro(opts) {
  const { name, uiintro } = opts;
  const nameInfo = get.character(name);
  const showCharacterNamePinyin = lib.config.show_characternamepinyin;
  const intro = opts.existingIntro || uiintro.querySelector(".characterintro") || ui.create.div(".characterintro", uiintro);
  let characterTitle = get.colorspan(get.characterTitle(name, false, false));
  for (const packname in lib.characterPack) {
    if (name in lib.characterPack[packname]) {
      const pack = lib.translate[packname + "_character_config"];
      let sort;
      if (lib.characterSort[packname]) {
        const sorted = lib.characterSort[packname];
        for (const sortname in sorted) {
          if (sorted[sortname].includes(name)) {
            sort = `<span style = "font-size:small">[${lib.translate[sortname]}]</span>`;
            break;
          }
        }
      }
      const packName = `${pack}${sort ? `${sort}` : ""}`;
      characterTitle = characterTitle.length ? `${characterTitle}<span style="color: white"> | ${packName}</span>` : `<span style="color: white">${packName}</span>`;
      break;
    }
  }
  if (characterTitle.length) {
    const titleDiv = document.createElement("div");
    titleDiv.className = "character-title";
    titleDiv.innerHTML = characterTitle;
    intro.appendChild(titleDiv);
    const hr = document.createElement("hr");
    hr.style.marginTop = "5px";
    hr.style.marginBottom = "5px";
    intro.appendChild(hr);
  }
  if (showCharacterNamePinyin != "doNotShow") {
    const characterIntroTable = ui.create.div(".character-intro-table", intro);
    const span = document.createElement("span");
    span.style.fontWeight = "bold";
    const exInfo = nameInfo.trashBin;
    const { characterName, characterReading } = resolveCharacterRubyDisplay(nameInfo, name, lib, get, showCharacterNamePinyin);
    span.innerHTML = characterName;
    const ruby = document.createElement("ruby");
    ruby.appendChild(span);
    const leftParenthesisRP = document.createElement("rp");
    leftParenthesisRP.textContent = "（";
    ruby.appendChild(leftParenthesisRP);
    const rt = document.createElement("rt");
    rt.innerHTML = characterReading;
    ruby.appendChild(rt);
    const rightParenthesisRP = document.createElement("rp");
    rightParenthesisRP.textContent = "）";
    ruby.appendChild(rightParenthesisRP);
    characterIntroTable.appendChild(ruby);
    const characterSexDiv = ui.create.div(".character-sex", characterIntroTable);
    const exInfoSex = exInfo && exInfo.find((value) => value.startsWith("sex:"));
    const characterSex = exInfoSex ? exInfoSex.split(":").pop() : nameInfo[0];
    resolveCardImageSource(`sex_${characterSex}`).then(loadImage).then((image) => characterSexDiv.appendChild(image)).catch(() => characterSexDiv.innerHTML = get.translation(characterSex));
    const characterGroupDiv = ui.create.div(".character-group", characterIntroTable);
    const characterGroups = get.is.double(name, true);
    if (characterGroups) {
      Promise.all(characterGroups.map((characterGroup) => resolveCardImageSource(`group_${characterGroup}`).then(loadImage))).then((images) => {
        const fragment = document.createDocumentFragment();
        images.forEach((image) => fragment.appendChild(image));
        characterGroupDiv.appendChild(fragment);
      }).catch(() => characterGroupDiv.innerHTML = characterGroups.map((characterGroup) => get.translation(characterGroup)).join("/"));
    } else {
      const characterGroup = nameInfo[1];
      resolveCardImageSource(`group_${characterGroup}`).then(loadImage).then((image) => characterGroupDiv.appendChild(image)).catch(() => characterGroupDiv.innerHTML = get.translation(characterGroup));
    }
    const hpDiv = ui.create.div(".hp", characterIntroTable);
    const nameInfoHP = nameInfo[2];
    const infoHP = get.infoHp(nameInfoHP);
    hpDiv.dataset.condition = infoHP < 4 ? "mid" : "high";
    ui.create.div(hpDiv);
    const hpTextDiv = ui.create.div(".text", hpDiv);
    const infoMaxHP = get.infoMaxHp(nameInfoHP);
    hpTextDiv.innerHTML = infoHP == infoMaxHP ? `×${infoHP}` : `×${infoHP}/${infoMaxHP}`;
    const infoShield = get.infoHujia(nameInfoHP);
    if (infoShield) {
      ui.create.div(".shield", hpDiv);
      const shieldTextDiv = ui.create.div(".text", hpDiv);
      shieldTextDiv.innerHTML = `×${infoShield}`;
    }
    intro.appendChild(document.createElement("hr"));
  }
  const htmlParser = document.createElement("body");
  htmlParser.innerHTML = get.characterIntro(name);
  Array.from(htmlParser.childNodes).forEach((value) => intro.appendChild(value));
  if (lib.characterAppend[name]) {
    intro.innerHTML += '<br><br><span style="font-weight:bold;color:#ff6b6b;">引文</span><br>' + lib.characterAppend[name];
  }
  return { intro, nameInfo, htmlParser };
}
export {
  renderDefaultCharacterIntro
};

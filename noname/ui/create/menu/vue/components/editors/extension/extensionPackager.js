import "../../../../../../../../noname.js";
import { delay } from "../../../../../../../util/index.js";
import "../../../../../../../util/sandbox.js";
import { security } from "../../../../../../../util/sandbox/security.js";
import { get } from "../../../../../../../get/binding.js";
import { game } from "../../../../../../../game/index.js";
function compileCodeSections(dash4Content) {
  const ext = {};
  for (const key in dash4Content) {
    try {
      if (["arenaReady", "content", "prepare", "precontent"].includes(key)) {
        const compiled = security.exec2(`return (${dash4Content[key]});`).return;
        if (typeof compiled !== "function") throw new Error("err");
        ext[key] = compiled.toString();
      } else {
        const compiled = security.exec2(dash4Content[key])[key];
        if (compiled == null || typeof compiled !== "object") throw new Error("err");
        ext[key] = JSON.stringify(compiled);
      }
    } catch (e) {
      console.log(e);
      delete ext[key];
    }
  }
  return ext;
}
function rewriteCharacterDieAudios(extName, pack) {
  const copied = get.copy(pack);
  const audioPrefix = typeof game.readFile === "function" ? "ext:" : "db:extension-";
  for (const info of Object.values(copied.character || {})) {
    if (Array.isArray(info)) {
      const tag = info[4]?.find((t) => /^die:.+$/.test(t));
      if (tag) {
        info[4].remove(tag);
        info[4].push(`die:${audioPrefix}${extName}/audio/die/${tag.slice(tag.lastIndexOf("/") + 1)}`);
      }
    } else if (Array.isArray(info.dieAudios)) {
      const dieAudios = info.dieAudios;
      const tag = dieAudios.find((t) => /^ext:.+$/.test(t));
      if (tag) {
        dieAudios.remove(tag);
        dieAudios.push(`${audioPrefix}${extName}/audio/die/${tag.slice(tag.lastIndexOf("/") + 1)}`);
      }
    }
  }
  return copied;
}
function packageAndImportExtension(params) {
  if (!params.isNewExtension && params.previousExtensionName && params.previousExtensionName !== params.extName) {
    game.removeExtension(params.previousExtensionName);
  }
  const waitingImage = Promise.allSettled([
    ...params.characterPack.imagePromises,
    ...params.cardPack.imagePromises
  ]);
  Promise.allSettled([waitingImage, delay(500)]).then(() => {
    const extName = params.extName || "无名扩展";
    const ext = compileCodeSections(params.codeSections);
    let str = `{name:"${extName}",editable:true,connect:false`;
    for (const key in ext) {
      str += `,${key}:${ext[key]}`;
    }
    const cardPackCopy = get.copy(params.cardPack.packData);
    cardPackCopy.list = params.cardPack.pileList;
    str += ",package:" + get.stringify({
      character: rewriteCharacterDieAudios(extName, params.characterPack.packData),
      card: cardPackCopy,
      skill: params.skillPack.packData,
      intro: params.meta.intro,
      author: params.meta.author,
      diskURL: params.meta.diskURL,
      forumURL: params.meta.forumURL,
      version: params.meta.version
    });
    const charImages = params.characterPack.imageData;
    const charAudios = params.characterPack.audioData;
    const cardImages = params.cardPack.imageData;
    const skillAudios = params.skillPack.audioData;
    const files = {
      character: Object.keys(charImages),
      card: Object.keys(cardImages),
      skill: Object.keys(skillAudios),
      audio: Object.keys(charAudios).map((name) => `audio/die/${name}`)
    };
    str += `,files:${JSON.stringify(files)}}`;
    const extension = {
      "extension.js": `import { lib, game, ui, get, ai, _status } from "noname";
export const type = "extension";
export default function(){
	return ${str} 
};`,
      "info.json": JSON.stringify({
        name: extName,
        intro: params.meta.intro,
        author: params.meta.author,
        diskURL: params.meta.diskURL,
        forumURL: params.meta.forumURL,
        version: params.meta.version
      }),
      "README.md": ""
    };
    for (const id in charImages) extension[id] = charImages[id];
    for (const id in charAudios) extension[`audio/die/${id}`] = charAudios[id];
    for (const id in cardImages) extension[id] = cardImages[id];
    if (params.exportMode) {
      game.importExtension(extension, null, extName);
    } else {
      game.importExtension(extension, () => {
        params.onSaved?.();
      });
    }
  });
}
function triggerExtensionExport(extName, onFallbackExport) {
  const interfaces = window.noname_shijianInterfaces;
  if (typeof game.readFile === "function" && interfaces && typeof interfaces.shareExtensionWithPassWordAsync === "function" && confirm("是否使用诗笺版自带的导出功能来导出扩展？")) {
    if (!extName) {
      alert("未检测到扩展名，将使用无名杀自带的导出功能");
      onFallbackExport();
      return;
    }
    game.readFile(
      `extension/${extName}/extension.js`,
      () => {
        const pwd = prompt("请输入压缩包密码，不设密码直接点确定");
        if (pwd === "" || pwd === null) {
          interfaces.shareExtensionAsync(extName);
        } else {
          interfaces.shareExtensionWithPassWordAsync(extName, pwd);
        }
      },
      () => {
        alert("未检测到扩展文件，将使用无名杀自带的导出功能");
        onFallbackExport();
      }
    );
    return;
  }
  onFallbackExport();
}
export {
  packageAndImportExtension,
  triggerExtensionExport
};

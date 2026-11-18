import "../../../../../../../../noname.js";
import "../../../../../../../util/sandbox.js";
import { lib } from "../../../../../../../library/index.js";
import { security } from "../../../../../../../util/sandbox/security.js";
import { game } from "../../../../../../../game/index.js";
import { _status } from "../../../../../../../status/index.js";
function resolveExtensionRepoURL() {
  const source = lib.config.extension_sources;
  const index = lib.config.extension_source;
  if (source && source[index]) {
    return source[index];
  }
  return lib.updateURL.replace(/noname/g, "noname-extension") + "/master/";
}
function resolveInitialItemStatus(item) {
  if (!lib.config.extensions.includes(item.name)) {
    return "download";
  }
  if (lib.extensionPack[item.name]?.version === item.version) {
    return "installed";
  }
  if (lib.config[`extension_${item.name}_version`] !== item.version) {
    return "update";
  }
  return "installed";
}
async function fetchExtensionCatalog(extensionURL) {
  delete window.extension;
  window.extension = {};
  try {
    const response = await fetch(`${extensionURL}catalog.js`, { referrerPolicy: "no-referrer" });
    const source = await response.text();
    await security.eval(source);
    const extension = window.extension || {};
    const list = [];
    for (const key in extension) {
      extension[key].name = key;
      list.push(extension[key]);
    }
    list.randomSort();
    return list.map((raw) => ({
      ...raw,
      status: resolveInitialItemStatus(raw),
      progressPercent: 0
    }));
  } finally {
    delete window.extension;
  }
}
async function importExtensionZipFile(file) {
  const result = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => resolve(e.target?.result);
    reader.readAsArrayBuffer(file);
  });
  const imported = await game.importExtension(result, () => {
    game.print("导入成功，3秒后将重启");
    setTimeout(game.reload, 3e3);
  });
  return imported !== false;
}
function downloadCatalogExtension(item, extensionURL, onInstalled) {
  if (item.status !== "download" && item.status !== "update") return;
  item.status = "downloading";
  item.progressPercent = 0;
  let size = parseFloat(item.size) || 0;
  if (size) {
    if (item.size.includes("MB")) size *= 1024 * 1024;
    else if (item.size.includes("KB")) size *= 1024;
  }
  const updateProgress = (byte, total) => {
    if (total) size = total;
    if (byte === -1) byte = size;
    item.progressPercent = size > 0 ? Math.round(100 * byte / size) : 100;
  };
  const rawFiles = [...item.files || []];
  const files = rawFiles.map((f) => `extension/${item.name}/${f}`);
  game.checkFileList(files, () => {
    files.unshift(`extension/${item.name}/extension.js`);
    for (let i = 0; i < files.length; i++) {
      files[i] = `${extensionURL}${item.name}/${files[i].slice(10 + item.name.length + 1)}`;
    }
    let finished = 0;
    const totalFiles = files.length;
    game.multiDownload(
      files,
      () => {
        finished++;
        updateProgress(finished, totalFiles);
      },
      (e) => {
        game.print(`下载失败：${e.source}`);
      },
      () => {
        updateProgress(-1, totalFiles);
        _status.importingExtension = true;
        window.game = game;
        lib.init.js(
          `${lib.assetURL}extension/${item.name}`,
          "extension",
          () => {
            if (!lib.config.dev) delete window.game;
            if (game.importedPack) {
              const extname = game.importedPack.name;
              if (lib.config.extensions.includes(extname)) {
                game.removeExtension(extname, true);
              }
              lib.config.extensions.add(extname);
              game.saveConfig("extensions", lib.config.extensions);
              game.saveConfig(`extension_${extname}_enable`, true);
              game.saveConfig(`extension_${extname}_version`, item.version);
              for (const key in game.importedPack.config) {
                const entry = game.importedPack.config[key];
                if (entry && "init" in entry) {
                  game.saveConfig(`extension_${extname}_${key}`, entry.init);
                }
              }
              onInstalled();
              item.status = "installed";
              delete game.importedPack;
            } else {
              item.status = "install_failed";
            }
            _status.importingExtension = false;
          },
          () => {
            item.status = "download_failed";
            _status.importingExtension = false;
          }
        );
      },
      (current) => `extension/${current.slice(extensionURL.length)}`
    );
  });
}
export {
  downloadCatalogExtension,
  fetchExtensionCatalog,
  importExtensionZipFile,
  resolveExtensionRepoURL
};

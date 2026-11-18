import "../../../noname.js";
import { isClass } from "../../util/index.js";
import "../../util/sandbox.js";
import { game } from "../index.js";
import { get } from "../../get/binding.js";
import { _status } from "../../status/index.js";
import { security } from "../../util/sandbox/security.js";
import { lib } from "../../library/index.js";
import { ui } from "../../ui/index.js";
import { ai } from "../../ai/index.js";
const extensionLoaderMethods = {
  import(type, content, url) {
    if (type == "extension") {
      const promise2 = game.loadExtension(content).then((name) => {
        if (typeof _status.extensionLoaded == "undefined") {
          _status.extensionLoaded = [];
        }
        _status.extensionLoaded.add(name);
        return name;
      });
      if (typeof _status.extensionLoading == "undefined") {
        _status.extensionLoading = [];
      }
      _status.extensionLoading.add(promise2);
      return promise2;
    }
    if (!lib.imported[type]) {
      lib.imported[type] = {};
    }
    let promise;
    if (typeof content === "function") {
      promise = Promise.try(content, lib, game, ui, get, ai, _status);
    } else {
      promise = Promise.resolve(content);
    }
    promise = promise.then((result) => {
      if (result.name) {
        lib.imported[type][result.name] = result;
      }
    });
    if (typeof _status.importing == "undefined") {
      _status.importing = {};
    }
    if (!_status.importing[type]) {
      _status.importing[type] = [];
    }
    _status.importing[type].add(promise);
    return promise;
  },
  async loadExtension(object) {
    let stopImporting = false;
    if (typeof object === "function") {
      const extensionFilter = object.filter || function() {
        return true;
      };
      if (isClass(object)) {
        object = await object.init?.() ?? new object();
      } else {
        object = await object(lib, game, ui, get, ai, _status);
      }
      if (await extensionFilter() !== true) {
        stopImporting = true;
      }
    }
    const name = object.name, extensionName = `extension_${name}`, extensionMenu = {
      enable: {
        name: "开启",
        init: true
      }
    };
    object.config ??= {};
    if (object.package) {
      const author = Object.getOwnPropertyDescriptor(object.package, "author");
      if (author) {
        extensionMenu.author = {
          get name() {
            return `作者：${this.author}`;
          },
          clear: true,
          nopointer: true
        };
        Object.defineProperty(extensionMenu.author, "author", author);
      }
      const intro = Object.getOwnPropertyDescriptor(object.package, "intro");
      if (intro) {
        extensionMenu.intro = {
          clear: true,
          nopointer: true
        };
        Object.defineProperty(extensionMenu.intro, "name", intro);
      }
      if (object.package.translation) {
        lib.translate[extensionName] = object.package.translation;
      }
    }
    const addOptions = (target, source) => {
      if (source) {
        const descriptors = Object.fromEntries(
          Object.keys(source).map((key) => {
            const descriptor = Object.getOwnPropertyDescriptor(source, key);
            if (!descriptor) {
              throw new TypeError(`Missing own property descriptor: ${key}`);
            }
            return [key, descriptor];
          })
        );
        Object.defineProperties(target, descriptors);
      }
    };
    addOptions(extensionMenu, object.config);
    addOptions(lib.help, object.help);
    if (object.editable !== false && lib.config.show_extensionmaker) {
      extensionMenu.edit = {
        name: "编辑此扩展",
        clear: true,
        onclick() {
          if (game.editExtension && lib.extensionPack && lib.extensionPack[name]) {
            game.editExtension(name);
          } else {
            alert("无法编辑未启用的扩展，请启用此扩展并重启后重试");
          }
        }
      };
    }
    extensionMenu.delete = {
      name: "删除此扩展",
      clear: true,
      onclick() {
        if (this.innerHTML != "<span>确认删除</span>") {
          this.innerHTML = "<span>确认删除</span>";
          new Promise((resolve) => setTimeout(resolve, 1e3)).then(() => this.innerHTML = "<span>删除此扩展</span>");
          return;
        }
        const page = this.parentNode, start = page.parentNode.previousSibling;
        page.remove();
        if (start) {
          const pageInStart = Array.from(start.childNodes).find((childNode) => childNode.link == page);
          if (pageInStart) {
            let active = false;
            if (pageInStart.classList.contains("active")) {
              active = true;
            }
            pageInStart.remove();
            if (active) {
              start.firstChild.classList.add("active");
              start.nextSibling.appendChild(start.firstChild.link);
            }
          }
        }
        game.removeExtension(name);
        if (typeof object.onremove == "function") {
          object.onremove();
        }
      }
    };
    lib.extensionMenu[extensionName] = extensionMenu;
    if (_status.importingExtension) {
      game.importedPack = object;
      return;
    }
    if (stopImporting || !object || !lib.config[`${extensionName}_enable`]) {
      return;
    }
    Object.keys(object.config).filter((key) => !(`${extensionName}_${key}` in lib.config)).forEach((key) => {
      const value = object.config[key];
      if (value && "init" in value) {
        game.saveConfig(`${extensionName}_${key}`, value.init);
      }
    });
    const config = {};
    Object.keys(lib.config).filter((key) => key !== extensionName && key.startsWith(extensionName)).forEach((key) => {
      const keyName = key.slice(extensionName.length + 1);
      config[keyName] = lib.config[key];
    });
    try {
      let extensionPack;
      if (object.package) {
        extensionPack = object.package;
        object.package.files = object.files ?? {};
      } else {
        extensionPack = {};
      }
      lib.extensionPack[name] = extensionPack;
      const { arenaReady, content, prepare, precontent } = object;
      extensionPack.code = {
        arenaReady,
        content,
        prepare,
        precontent,
        help: object.help,
        config: object.config
      };
      try {
        if (precontent) {
          _status.extension = name;
          await precontent.call(object, config);
          delete _status.extension;
        }
        if (prepare) {
          lib.onprepare?.push(prepare);
        }
      } catch (e) {
        console.error(`加载《${name}》扩展的precontent时出现错误。`, e);
        if (!lib.config.ignore_error) {
          alert(`加载《${name}》扩展的precontent时出现错误。
该错误本身可能并不影响扩展运行。您可以在“设置→通用→无视扩展报错”中关闭此弹窗。
错误信息: 
${e instanceof Error ? e.stack : String(e)}`);
        }
      }
      if (content) {
        lib.extensions.push([name, content, config, _status.evaluatingExtension, object.package ?? {}, object.connect, arenaReady]);
      }
    } catch (e) {
      console.error(e);
    }
    return name;
  },
  async importExtension(data, finishLoad, exportExtension) {
    const zip = await get.promises.zip();
    if (get.objtype(data) == "object") {
      const filelist = Object.keys(data);
      filelist.forEach((value) => zip.file(value, data[value]));
      if (exportExtension) {
        game.export(zip.generate({ type: "blob" }), exportExtension);
        if (typeof finishLoad == "function") {
          finishLoad();
        }
      } else {
        game.importExtension.apply(this, [zip.generate({ type: "arraybuffer" }), finishLoad]);
      }
      return;
    }
    try {
      if (typeof game.readFile !== "function") {
        throw new Error("没有文件系统操作权限，无法导入扩展。");
      }
      zip.load(data);
      const importExtensionInfo = async () => {
        const infoFile = zip.file("info.json");
        if (infoFile) {
          _status.importingExtension = true;
          try {
            const info = JSON.parse(infoFile.asText());
            await game.import("extension", () => {
              return Object.assign(info, {
                config: {}
              });
            });
            if (Array.isArray(_status.extensionLoading)) {
              await Promise.allSettled(_status.extensionLoading);
              delete _status.extensionLoading;
            }
          } catch (error) {
            console.log(error);
          }
          _status.importingExtension = false;
          return;
        }
        const extensionFile = zip.file("extension.js");
        if (extensionFile) {
          _status.importingExtension = true;
          try {
            security.eval(extensionFile.asText());
            if (Array.isArray(_status.extensionLoading)) {
              await Promise.allSettled(_status.extensionLoading);
              delete _status.extensionLoading;
            }
          } catch (error) {
            console.log(error);
          }
          _status.importingExtension = false;
          return;
        }
      };
      await importExtensionInfo();
      if (!game.importedPack) {
        throw new Error("此压缩包不是一个扩展");
      }
      const name = game.importedPack.name;
      if (lib.config.all.plays.includes(name)) {
        throw new Error("禁止安装游戏原生扩展");
      }
      const extensions = lib.config.extensions;
      if (extensions.includes(name)) {
        game.removeExtension(name, true);
      }
      extensions.add(name);
      game.saveConfigValue("extensions");
      game.saveConfig(`extension_${name}_enable`, true);
      delete game.importedPack;
      const targetDir = `extension/${name}`;
      const tasks = [];
      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        const outputPath = lib.path.join(targetDir, relativePath);
        if (zipEntry.dir) {
          tasks.push(game.promises.createDir(outputPath));
        } else {
          const task = (async () => {
            await game.promises.createDir(lib.path.dirname(outputPath));
            const content = zipEntry.asArrayBuffer();
            await game.promises.writeFile(content, "./", outputPath);
          })();
          tasks.push(task);
        }
      }
      await Promise.all(tasks);
      if (typeof finishLoad == "function") {
        finishLoad();
      }
    } catch (error) {
      alert(`导入失败：
${error}`);
      console.error(error);
      return false;
    }
  }
};
export {
  extensionLoaderMethods
};

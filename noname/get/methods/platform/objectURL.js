import { rootURL } from "../../../../noname.js";
import "../../dependencies.js";
import { lib } from "../../../library/index.js";
import JSZip from "../../../../_virtual/index4.js";
import { userAgentLowerCase } from "../../../util/index.js";
import { game } from "../../../game/index.js";
import { get } from "../../binding.js";
const platformObjectURLMethods = {
  /**
   * Generate an object URL from the Base64-encoded octet stream
   *
   * 从Base64编码的八位字节流生成对象URL
   */
  /**
   * @param {string} octetStream
   * @returns {string}
   */
  objectURL(octetStream) {
    const objectURLMap = lib.objectURL;
    if (objectURLMap.has(octetStream)) {
      return objectURLMap.get(octetStream);
    }
    const objectURL = URL.createObjectURL(new Blob([Uint8Array.from(atob(octetStream.replace(/^data:[\s\S]*\/[\s\S]*;base64,/, "")), (character) => character.charCodeAt(0))]));
    objectURLMap.set(octetStream, objectURL);
    return objectURL;
  },
  /**
   * 获取角色原皮对应的图片路径
   * @param { string } name
   * @returns {string | null}
   */
  skinPath(name) {
    if (!name) {
      return null;
    }
    let src, ext = ".jpg", subfolder = "default";
    let dbimage = null, extimage = null, modeimage = null, nameinfo = get.character(name), gzbool = false;
    if (nameinfo.skinPath) {
      if (nameinfo.skinPath.startsWith("ext:")) {
        return nameinfo.skinPath.replace(/^ext:/, "extension/");
      }
      return nameinfo.skinPath;
    }
    const mode = get.mode();
    if (lib.characterPack[`mode_${mode}`] && lib.characterPack[`mode_${mode}`][name]) {
      if (mode === "guozhan") {
        if (name.startsWith("gz_shibing")) {
          name = name.slice(3, 11);
        } else {
          if (lib.config.mode_config.guozhan.guozhanSkin && nameinfo && nameinfo.hasSkinInGuozhan) {
            gzbool = true;
          }
          name = name.slice(3);
        }
      } else {
        modeimage = mode;
      }
    } else if (name.includes("::")) {
      name = name.split("::");
      modeimage = name[0];
      name = name[1];
    }
    let imgPrefixUrl;
    if (!modeimage && nameinfo) {
      if (nameinfo.img) {
        imgPrefixUrl = nameinfo.img;
      } else if (nameinfo.trashBin) {
        for (const value of nameinfo.trashBin) {
          if (value.startsWith("img:")) {
            imgPrefixUrl = value.slice(4);
            break;
          } else if (value.startsWith("ext:")) {
            extimage = value;
            break;
          } else if (value.startsWith("db:")) {
            dbimage = value;
            break;
          } else if (value.startsWith("mode:")) {
            modeimage = value.slice(5);
            break;
          } else if (value.startsWith("character:")) {
            name = value.slice(10);
            break;
          }
        }
      }
    }
    if (imgPrefixUrl) {
      src = imgPrefixUrl;
    } else if (extimage) {
      src = extimage.replace(/^ext:/, "extension/");
    } else if (dbimage) {
      src = dbimage.slice(3);
    } else if (modeimage) {
      src = `image/mode/${modeimage}/character/${name}${ext}`;
    } else {
      src = `image/character/${gzbool ? "gz_" : ""}${name}${ext}`;
    }
    return `${src.split("/").slice(0, -2).join("/")}/skin/${name}/`;
  },
  /**
   * 将URL转换成相对于无名杀根目录的路径
   *
   * ---
   *
   * 在无名杀正式过渡到http协议前，无名杀的路径在不同端拥有不同的情况:
   * - 网页端: 除了`db`外，没任何可能
   * - 电脑端(electron): 和`node.js`保持一致
   * - 手机端(cordova): 需要使用`cordova`的`cordova-plugin-file`插件实现，有较为严格的限制
   *
   * 故之前的路径API基本如下:
   * - 网页端完全不考虑
   * - 使用`lib.assetURL + <relative path>`的形式，其中`lib.assetURL`的值为:
   *   - 在网页端和电脑端为空字符串
   *   - 在手机端为无名杀包的`externalApplicationStorageDirectory`里（也就是`Android/data/<app-id>/`）
   *
   * 现在无名杀即将踏入http协议，也早已用上了ES Module，故活用`import.meta.url`来提供路径理应被重视，`URL`也理应成为路径的主要构成
   *
   * 然而由于之前的API混乱且针对多端有不同的情况，故需要提供函数，来方便提供调用旧API的情况
   *
   * @param {URL} url - 需要转换的URL对象
   * @param {boolean} [addAssetURL=false] - 是否需要在函数内加上`lib.assetURL`，
   * 默认为`false`，当为`true`时会在协议为`file`时增加`lib.assetURL`
   * @returns {string}
   *
   * @example
   * // 当前文件以"noname/get/index.js"举例
   * let parsedPath = get.relativePath(import.meta.url, true);
   * console.assert(parsedPath == `${lib.assetURL}noname/get/index.js`);
   */
  relativePath(url, addAssetURL = false) {
    let base = lib.path.relative(decodeURI(rootURL.pathname), decodeURI(url.pathname));
    if (addAssetURL && rootURL.protocol == "file:") {
      base = `${lib.assetURL}${base}`;
    }
    return base;
  },
  /**
   * 通过`FileReader`，将Blob转换成对应内容的[Data URL](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Basics_of_HTTP/Data_URLs)
   *
   * @async
   * @param {Blob} blob - 需要转换的内容
   * @returns {Promise<URL>} 对应Blob内容的
   *
   * @example
   * let text = "Hello, World!";
   * console.assert(btoa(text) === "SGVsbG8sIFdvcmxkIQ==");
   *
   * let blob = new Blob([text], { type: "text/plain" });
   * let url = await get.dataUrlAsync(blob);
   * console.assert(url.href === "data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==");
   */
  dataUrlAsync(blob) {
    return new Promise((resolve, reject) => {
      let fileReader = new FileReader();
      fileReader.onload = resolve;
      fileReader.onerror = reject;
      fileReader.readAsDataURL(blob);
    }).then((event) => new URL(event.target.result));
  },
  /**
   * 通过`Get#blobFromUrl`读取data URL的内容，转换成Blob后返回生成的blob URL
   *
   * > 实际上所有的URL都能通过此方法读取
   *
   * 该方法具有缓存，同一data URL仅会返回同一blob URL
   *
   * 该方法相比`get.objectURL`，会保留文件的类型
   *
   * ---
   *
   * > 其实我不确定`get.objectURL`是否有实际意义上的需求，我也不确定`get.objectURL`不保留类型是否是刚需，但既然原先就存在，那么就不要动
   *
   * @async
   * @param {string | URL} dataUrl - 需要转换的data URL
   * @returns {Promise<URL>}
   */
  async objectUrlAsync(dataUrl) {
    let dataString = dataUrl instanceof URL ? dataUrl.href : dataUrl;
    const objectURLMap = lib.objectURL;
    if (objectURLMap.has(dataString)) {
      return new URL(objectURLMap.get(dataString));
    }
    let blob = await this.blobFromUrl(dataUrl);
    const objectURL = URL.createObjectURL(blob);
    objectURLMap.set(dataString, objectURL);
    return new URL(objectURL);
  },
  /**
   * 读取给定的URL，将其中的内容转换成Blob
   *
   * 在File协议下通过无名杀自带的文件处理函数读取内容，其他协议通过`fetch`读取内容
   *
   * @async
   * @param {string | URL} url - 需要读取的URL
   * @returns {Promise<Blob>}
   */
  blobFromUrl(url) {
    let link = url instanceof URL ? url : new URL(url);
    return link.protocol == "file:" ? game.promises.readFile(get.relativePath(link)).then((buffer) => new Blob([ArrayBuffer.isView(buffer) ? new Uint8Array(buffer) : buffer])) : fetch(link).then((response) => response.blob());
  },
  /**
   *
   * @param {[majorVersion: number, minorVersion: number, patchVersion: number]} require 需求的版本号
   * @param {[majorVersion: number, minorVersion: number, patchVersion: number]} current 浏览器环境本身的版本号
   * @returns
   */
  checkVersion(require2, current) {
    if (current.length > require2.length) {
      current.length = require2.length;
    }
    let flag = false;
    for (let i = 0; i < current.length; ++i) {
      if (isNaN(current[i])) {
        flag = true;
        continue;
      }
      if (flag) {
        return false;
      }
      if (require2[i] > current[i]) {
        return false;
      }
      if (current[i] > require2[i]) {
        return true;
      }
    }
    return true;
  },
  /**
   * 获取当前内核版本信息
   *
   * 目前仅考虑`chrome`, `firefox`和`safari`三种浏览器的信息，其余均归于其他范畴
   *
   * > 其他后续或许会增加，但`IE`永无可能
   *
   * @returns {["firefox" | "chrome" | "safari" | "other", number, number, number]}
   */
  coreInfo() {
    if (typeof window.process != "undefined" && typeof window.process.versions == "object") {
      if (window.process.versions.chrome) {
        return parseVersion("chrome", window.process.versions.chrome);
      }
    }
    if (typeof navigator.userAgentData != "undefined") {
      const userAgentData = navigator.userAgentData;
      if (userAgentData.brands && userAgentData.brands.length) {
        const brand = userAgentData.brands.find(({ brand: brand2 }) => {
          let str = brand2.toLowerCase();
          return str.includes("chrome") || str.includes("chromium");
        });
        if (brand) {
          return ["chrome", parseInt(brand.version), 0, 0];
        }
      }
    }
    const regex = /(firefox|chrome|safari)\/(\d+(?:\.\d+)+)/;
    let result = userAgentLowerCase.match(regex);
    if (result == null) {
      return ["other", NaN, NaN, NaN];
    }
    if (result[1] !== "safari") {
      return parseVersion(result[1], result[2]);
    }
    if (/macintosh/.test(userAgentLowerCase)) {
      result = userAgentLowerCase.match(/version\/(\d+(?:\.\d+)+).*safari/);
      if (result == null) {
        return ["other", NaN, NaN, NaN];
      }
    } else {
      let safariRegex = /(?:iphone|ipad); cpu (?:iphone )?os (\d+(?:_\d+)+)/;
      result = userAgentLowerCase.match(safariRegex);
      if (result == null) {
        return ["other", NaN, NaN, NaN];
      }
    }
    return parseVersion("safari", result[1]);
    function parseVersion(coreName, versions) {
      const [major, minor, patch] = versions.split(".");
      const majorVersion = parseInt(major);
      if (Number.isNaN(majorVersion)) {
        return [coreName, NaN, NaN, NaN];
      }
      return [coreName, majorVersion, parseInt(minor) || 0, parseInt(patch) || 0];
    }
  },
  connectNickname() {
    return typeof lib.config.connect_nickname == "string" ? lib.config.connect_nickname.slice(0, 12) : "无名玩家";
  },
  ip() {
    if (!require) {
      return "";
    }
    let interfaces = require("os").networkInterfaces();
    for (let devName in interfaces) {
      if (devName.includes("VMware")) {
        continue;
      }
      let iface = interfaces[devName];
      if (iface === void 0) {
        throw new TypeError("Enumerated network interface has no address list");
      }
      for (let i = 0; i < iface.length; i++) {
        let alias = iface[i];
        if (alias.family === "IPv4" && alias.address !== "127.0.0.1" && !alias.internal) {
          return alias.address;
        }
      }
    }
  },
  trimip(str) {
    let len = str.length - 5;
    if (str.lastIndexOf(":8080") == len) {
      str = str.slice(0, len);
    }
    return str;
  },
  /**
   * @param { (zip: JSZip) => any } callback
   */
  zip(callback) {
    callback(new JSZip());
  },
  url(master) {
    let url = lib.config.updateURL || lib.updateURL;
    if (url[url.length - 1] != "/") {
      url += "/";
    }
    if (master != "nodev") {
      return url + "master/";
    } else {
      return url + "v" + lib.version + "/";
    }
  }
};
export {
  platformObjectURLMethods
};

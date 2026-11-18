import { rootURL, game, lib } from "noname";
import { userAgentLowerCase, JSZip, get } from "../../dependencies.js";
import type { Get } from "../../Get.js";

export const platformObjectURLMethods = {
	/**
	 * Generate an object URL from the Base64-encoded octet stream
	 *
	 * 从Base64编码的八位字节流生成对象URL
	 */
	/**
	 * @param {string} octetStream
	 * @returns {string}
	 */
	objectURL(octetStream: string) {
		const objectURLMap = lib.objectURL;
		if (objectURLMap.has(octetStream)) {
			return objectURLMap.get(octetStream);
		}
		const objectURL = URL.createObjectURL(new Blob([Uint8Array.from(atob(octetStream.replace(/^data:[\s\S]*\/[\s\S]*;base64,/, "")), (character: string) => character.charCodeAt(0))]));
		objectURLMap.set(octetStream, objectURL);
		return objectURL;
	},

	/**
	 * 获取角色原皮对应的图片路径
	 * @param { string } name
	 * @returns {string | null}
	 */
	skinPath(name: string) {
		if (!name) {
			return null;
		}
		let src,
			ext = ".jpg",
			subfolder = "default";
		let dbimage: any = null,
			extimage: any = null,
			modeimage: any = null,
			nameinfo = get.character(name),
			gzbool = false;
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
			// @ts-expect-error ignore
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
	relativePath(url: URL, addAssetURL: boolean | undefined = false) {
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
	dataUrlAsync(blob: Blob) {
		return new Promise((resolve: (value: any) => void, reject: (reason?: any) => void) => {
			let fileReader = new FileReader();
			fileReader.onload = resolve;
			fileReader.onerror = reject;
			fileReader.readAsDataURL(blob);
		}).then(event => new URL(event.target.result));
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
	async objectUrlAsync(this: Get, dataUrl: string | URL) {
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
	blobFromUrl(url: string | URL) {
		let link = url instanceof URL ? url : new URL(url);
		return link.protocol == "file:" ? game.promises.readFile(get.relativePath(link)).then((buffer: ArrayBuffer | Buffer<ArrayBufferLike>) => new Blob([ArrayBuffer.isView(buffer) ? new Uint8Array(buffer) : buffer])) : fetch(link).then((response: Response) => response.blob());
	},

	/**
	 *
	 * @param {[majorVersion: number, minorVersion: number, patchVersion: number]} require 需求的版本号
	 * @param {[majorVersion: number, minorVersion: number, patchVersion: number]} current 浏览器环境本身的版本号
	 * @returns
	 */
	checkVersion(require: [majorVersion: number, minorVersion: number, patchVersion: number], current: [majorVersion: number, minorVersion: number, patchVersion: number]) {
		// 防止不存在的意外，提前截断当前版本号的长度
		if (current.length > require.length) {
			current.length = require.length;
		}

		// 考虑到玄学的NaN情况，记录是否存在NaN
		let flag = false;
		// 从主版本号遍历到修订版本号，只考虑当前版本号的长度
		for (let i = 0; i < current.length; ++i) {
			// 当前环境版本号当前位若是NaN，则记录后直接到下一位
			if (isNaN(current[i])) {
				flag = true;
				continue;
			}
			// 如果此时flag为true且current[i]不为NaN，版本号则不合法，直接否
			if (flag) {
				return false;
			}
			// 上位版本号未达到要求，直接否决
			if (require[i] > current[i]) {
				return false;
			}
			// 上位版本号已超过要求，直接可行
			if (current[i] > require[i]) {
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
		// 如果存在process并且存在process.versions，则默认为node环境
		if (typeof window.process != "undefined" && typeof window.process.versions == "object") {
			// 如果存在versions.chrome，默认为electron的versions.chrome
			if (window.process.versions.chrome) {
				return parseVersion("chrome", window.process.versions.chrome);
			}
		}

		// Chrome/Chromium下的实验性特性，具体可参见
		// https://developer.mozilla.org/en-US/docs/Web/API/Navigator/userAgentData
		// @ts-expect-error ignore
		if (typeof navigator.userAgentData != "undefined") {
			// @ts-expect-error ignore
			const userAgentData = navigator.userAgentData;
			if (userAgentData.brands && userAgentData.brands.length) {
				const brand = userAgentData.brands.find(({ brand }) => {
					let str = brand.toLowerCase();
					// 当前支持的浏览器中只有chrome支持userAgentData，故只判断chrome的情况
					return str.includes("chrome") || str.includes("chromium");
				});

				// 如果能通过userAgentData找到对应的浏览器信息，则直接返回
				// 反之则继续通过正则表达式匹配userAgent
				if (brand) {
					return ["chrome", parseInt(brand.version), 0, 0];
				}
			}
		}

		// 目前仅考虑Firefox, Chrome和Safari三种浏览器
		// 其余浏览器均归于other
		const regex = /(firefox|chrome|safari)\/(\d+(?:\.\d+)+)/;
		let result = userAgentLowerCase.match(regex);
		if (result == null) {
			return ["other", NaN, NaN, NaN];
		}

		// 非Safari情况可直接返回结果
		if (result[1] !== "safari") {
			// @ts-expect-error Type must be right
			return parseVersion(result[1], result[2]);
		}

		// 以下是所有Safari平台的判断方法
		// macOS以及以桌面显示的移动端则直接判断
		if (/macintosh/.test(userAgentLowerCase)) {
			result = userAgentLowerCase.match(/version\/(\d+(?:\.\d+)+).*safari/);
			if (result == null) {
				return ["other", NaN, NaN, NaN];
			}
		}
		// 不然则通过OS后面的版本号来获取内容
		else {
			let safariRegex = /(?:iphone|ipad); cpu (?:iphone )?os (\d+(?:_\d+)+)/;
			result = userAgentLowerCase.match(safariRegex);
			if (result == null) {
				return ["other", NaN, NaN, NaN];
			}
		}
		// result = userAgent.match(/version\/(\d+(?:\.\d+)+).*safari/)
		return parseVersion("safari", result[1]);

		/**
		 * 通用解析版本号方法
		 *
		 * @param {"firefox" | "chrome" | "safari" | "other"} coreName
		 * @param {string} versions
		 * @returns {["firefox" | "chrome" | "safari" | "other", number, number, number]}
		 */
		function parseVersion(coreName: "chrome" | "firefox" | "safari" | "other", versions: string) {
			const [major, minor, patch] = versions.split(".");
			const majorVersion = parseInt(major);

			// 如果major解析为NaN，则整体解析为NaN（此时不考虑minor和patch）
			if (Number.isNaN(majorVersion)) {
				return [coreName, NaN, NaN, NaN];
			}

			// 反之则将不为NaN的minor和patch解析为0
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
			if (iface === undefined) {
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
	zip(callback: (zip: JSZip) => any) {
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
	},
};

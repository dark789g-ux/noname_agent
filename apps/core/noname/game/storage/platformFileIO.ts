import { lib, get } from "noname";
import { game } from "../index.js";
import type { Game } from "../index.js";

export const platformFileIOMethods = {
	multiDownload2(this: Game, list: string[], onsuccess?: (remaining: number) => void, onerror?: Parameters<NonNullable<typeof game.download>>[3], onfinish?: () => void, process?: (url: string) => string, dev?: "nodev" | null) {
		list = list.slice(0);
		const hasItems = (values: string[]): values is [string, ...string[]] => values.length > 0;
		const download = function () {
			if (hasItems(list)) {
				const current = list[0];
				list.shift();
				const current2 = typeof process == "function" ? process(current) : current;
				if (current.startsWith("theme")) {
					game.print(current.slice(6));
				} else if (current.startsWith("image/skin")) {
					game.print(current.slice(11));
				} else {
					game.print(current.slice(current.lastIndexOf("/") + 1));
				}
				if (typeof game.download != "function") {
					throw new TypeError("game.download is not a function");
				}
				game.download(
					current,
					current2,
					function () {
						if (onsuccess) {
							onsuccess(list.length);
						}
						download();
					},
					function (e) {
						if (onerror) {
							onerror(e);
						}
						download();
					},
					dev
				);
			} else if (onfinish) {
				onfinish();
			}
		};
		download();
	},
	multiDownload(this: Game, list: string[], onsuccess: (remaining: number) => void, onerror: Parameters<NonNullable<typeof game.download>>[3], onfinish: () => void, process?: (url: string) => string, dev?: "nodev" | null) {
		if (lib.config.dev) {
			game.print(get.url());
		}
		const args = [list, onsuccess, onerror, onfinish, process, dev];
		if (list.length <= 3) {
			Reflect.apply(game.multiDownload2, this, args);
		} else {
			const num = Math.round(list.length / 3);
			let left = 3;
			args[3] = function () {
				left--;
				if (left == 0) {
					onfinish();
				}
			};
			setTimeout(function () {
				args[0] = list.slice(0, num);
				Reflect.apply(game.multiDownload2, game, args);
			});
			setTimeout(function (this: object) {
				args[0] = list.slice(num, 2 * num);
				Reflect.apply(game.multiDownload2, this, args);
			}, 200);
			setTimeout(function (this: object) {
				args[0] = list.slice(2 * num);
				Reflect.apply(game.multiDownload2, this, args);
			}, 400);
		}
	},
	fetch(this: Game, url: string, onload: NonNullable<Parameters<NonNullable<typeof game.readFile>>[1]>, onerror?: Parameters<NonNullable<typeof game.download>>[3], onprogress?: Parameters<NonNullable<typeof game.download>>[5]) {
		const tmpName = "~tmp" + get.id();
		if (typeof game.download != "function") {
			throw new TypeError("game.download is not a function");
		}
		game.download(
			encodeURI(url),
			tmpName,
			function () {
				if (typeof game.readFile != "function") {
					throw new TypeError("game.readFile is not a function");
				}
				game.readFile(
					tmpName,
					function (data) {
						onload(data);
						if (typeof game.removeFile != "function") {
							throw new TypeError("game.removeFile is not a function");
						}
						game.removeFile(tmpName);
					},
					onerror
				);
			},
			onerror,
			null,
			onprogress
		);
	},
};

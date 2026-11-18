import { _status, lib, ui } from "noname";
import { game } from "../index.js";
import type { Game } from "../index.js";

export const zsLineAnimationMethods = {
	zsPlayLineAnimation(this: Game, name: string, node: any, fake?: boolean, points?: [number[], number[]]) {
		const animation: any = game.jianqiLineAnim;
		animation["image"] = name;
		if (lib.config.zsGuideTime) {
			animation["time"] = parseInt(lib.config.zsGuideTime);
		}
		if (animation == undefined) {
			return;
		}
		if (animation.time <= 100000) {
			if (animation.pause != false && !_status.paused2 && !_status.nopause) {
				_status.zhx_onAnimationPause = true;
				game.pause2();
			}
			if (_status.zhx_onAnimation == undefined) {
				_status.zhx_onAnimation = 0;
			}
			_status.zhx_onAnimation++;
		}
		let src: string | undefined;
		if (animation.image != undefined) {
			src = "image/pointer/" + animation.image + "?" + new Date().getTime();
		}
		const animationTracked = animation.time <= 100000;
		const finish = function () {
			let animationID: any;
			let timeoutID: any;
			let interval: any;
			const div = ui.create.div();
			if (fake == true) {
				ui.window.appendChild(div);
			} else if (node == undefined || node == false) {
				ui.window.appendChild(div);
			} else {
				node.appendChild(div);
			}
			if (animation.style != undefined) {
				for (const key in animation.style) {
					if (key == "innerHTML") {
						continue;
					}
					div.style[key] = animation.style[key];
				}
			}
			const judgeStyle = function (style: string) {
				if (animation.style == undefined) {
					return false;
				}
				return animation.style[style] != undefined;
			};
			if (judgeStyle("innerHTML")) div.innerHTML = animation.style.innerHTML;
			if (judgeStyle("width") == false) div.style.width = animation.width;
			if (judgeStyle("height") == false) div.style.height = animation.height;
			if (judgeStyle("backgroundSize") == false && judgeStyle("background-size") == false) div.style.backgroundSize = animation.backgroundSize;
			if (judgeStyle("opacity") == false) div.style.opacity = String(animation.opacity);
			if (judgeStyle("zIndex") == false && judgeStyle("z-index") == false) div.style.zIndex = "1001";
			if (judgeStyle("borderRadius") == false && judgeStyle("border-radius") == false) div.style.borderRadius = "5px";
			if (judgeStyle("pointer-events") == false && judgeStyle("pointerEvents") == false) div.style["pointer-events"] = "none";

			if (src != undefined) {
				if (animation.image.indexOf(".") != -1) {
					div.setBackgroundImage(src);
				} else {
					const type_frame = ".png";
					const num_frame = 8;
					const folder_frame = lib.assetURL + "image/pointer/" + animation.image + "/";
					const div1 = ui.create.div();
					div1.style.height = "100%";
					div1.style.width = "100%";
					div1.style.top = "0px";
					div1.style.left = "0px";
					div1.style.opacity = "0.7";
					div.appendChild(div1);
					const canvas = document.createElement("canvas");
					canvas.width = div1.offsetWidth;
					canvas.height = div1.offsetHeight;
					div1.appendChild(canvas);
					const context = canvas.getContext("2d");
					if (!context) {
						if (fake == true || node == undefined || node == false) {
							ui.window.removeChild(div);
						} else {
							node.removeChild(div);
						}
						if (animationTracked && typeof _status.zhx_onAnimation === "number") {
							_status.zhx_onAnimation--;
						}
						if (animationTracked && _status.zhx_onAnimationPause == true && _status.zhx_onAnimation == 0) {
							delete _status.zhx_onAnimationPause;
							game.resume2();
						}
						return;
					}
					let start: Function;
					const imgs: HTMLImageElement[] = [];
					let imgs_num = 0;
					for (let i = 0; i < num_frame; i++) {
						const img = new Image();
						img.src = folder_frame + (animation.qianzhui == undefined ? "" : animation.qianzhui) + (animation.liang == true ? (i < 10 ? "0" + i : i) : i) + type_frame;
						const isFinalFrame = i >= num_frame - 1;
						img.onload = () => {
							imgs.push(img);
							if (isFinalFrame) {
								start();
							}
						};
						img.onerror = () => {
							if (isFinalFrame) {
								start();
							}
						};
					}
					start = function () {
						const play = function () {
							if (!context || imgs_num >= imgs.length) {
								return;
							}
							const img = imgs[imgs_num];
							context.clearRect(0, 0, img.width, img.height);
							context.drawImage(img, 0, 0, img.width, img.height, 0, 0, div1.offsetWidth, div1.offsetHeight);
							imgs_num++;
							if (animation.jump_zhen == true && imgs[imgs_num + 1] != undefined) {
								// @ts-expect-error legacy helper
								imgs.remove(imgs_num + 1);
							}
							if (imgs_num >= imgs.length) {
								if (animation.cycle == true) {
									imgs_num = 0;
								} else {
									if (interval != undefined) clearInterval(interval);
									if (timeoutID != undefined) clearTimeout(timeoutID);
									if (animationID != undefined) cancelAnimationFrame(animationID);
								}
							}
						};
						interval = setInterval(play, animation.rate_zhen == undefined ? 45 : 1000 / animation.rate_zhen);
					};
				}
			}
			if (points == undefined) {
				if (judgeStyle("top") == false) {
					div.style.top = "calc(50% - " + div.offsetHeight / 2 + "px)";
				}
				if (judgeStyle("left") == false) {
					div.style.left = "calc(50% - " + div.offsetWidth / 2 + "px)";
				}
			} else {
				div.style.top = points[0][1] - div.offsetHeight / 2 + "px";
				div.style.left = points[0][0] + "px";
			}
			let div2: any = null;
			if (points != undefined) {
				const timeS = (animation.fade == true ? animation.time - 450 : animation.time - 100) / 1000 / 2;
				const getAngle = function (x1: number, y1: number, x2: number, y2: number, bool?: boolean) {
					const x = x1 - x2;
					const y = y1 - y2;
					const z = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
					const cos = y / z;
					const radina = Math.acos(cos);
					let angle = 180 / (Math.PI / radina);
					if (x2 > x1 && y2 === y1) angle = 0;
					if (x2 > x1 && y2 < y1) angle = angle - 90;
					if (x2 === x1 && y1 > y2) angle = -90;
					if (x2 < x1 && y2 < y1) angle = 270 - angle;
					if (x2 < x1 && y2 === y1) angle = 180;
					if (x2 < x1 && y2 > y1) angle = 270 - angle;
					if (x2 === x1 && y2 > y1) angle = 90;
					if (x2 > x1 && y2 > y1) angle = angle - 90;
					if (bool == true && angle > 90) angle -= 180;
					return angle;
				};
				const p1 = points[0];
				const p2 = points[1];
				const x0 = p1[0];
				const y0 = p1[1];
				const x1 = p2[0];
				const y1 = p2[1];
				div.style.transition = "all 0s";
				div.style.transform = "rotate(" + getAngle(x0, y0, x1, y1, true) + "deg)" + (x0 > x1 ? "" : " rotateY(180deg)");
				div.style["transform-origin"] = "0 50%";
				div2 = ui.create.div();
				div2.style.zIndex = "1000";
				div2.style["pointer-events"] = "none";
				div2.style.height = "20px";
				div2.style.width = Math.pow(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2), 0.5) + 2 + "px";
				div2.style.left = x0 + "px";
				div2.style.top = y0 - 10 + "px";
				div2.style.transform = "rotate(" + getAngle(x0, y0, x1, y1) + "deg) scaleX(0)";
				div2.style["transform-origin"] = "0 50%";
				div2.style.transition = "all " + (timeS * 4) / 3 + "s";
				if (src != undefined && animation.image.indexOf(".") == -1) {
					div2.style.backgroundSize = "100% 100%";
					div2.style.opacity = "0.7";
					div2.setBackgroundImage("image/pointer/" + animation.image + "/line.png");
				} else {
					div2.style.background = "#ffffff";
				}
				setTimeout(function () {
					if (!div2) return;
					div.style.transition = "all " + (timeS * 4) / 3 + "s";
					div.style.transform += " translateX(" + -(Math.pow(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2), 0.5) + 2) + "px)";
					div2.style.transform = "rotate(" + getAngle(x0, y0, x1, y1) + "deg) scaleX(1)";
				}, 50);
				setTimeout(
					function () {
						if (!div2) return;
						div2.style.transition = "all " + (timeS * 2) / 3 + "s";
						div2.style.transform = "rotate(" + getAngle(x0, y0, x1, y1) + "deg) translateX(" + (Math.pow(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2), 0.5) + 2 - Math.pow(Math.pow(div.offsetHeight / 2, 2) + Math.pow(div.offsetWidth / 2, 2), 0.5)) + "px) scaleX(0.01)";
					},
					50 + ((timeS * 4) / 3) * 1000
				);
				if (div2) {
					node.appendChild(div2);
				}
			}
			if (animation.time <= 100000) {
				if (animation.fade == true) {
					if (div2) {
						setTimeout(function () {
							div2.hide();
						}, animation.time - 350);
						setTimeout(function () {
							div.hide();
						}, animation.time - 400);
					} else {
						setTimeout(function () {
							div.hide();
						}, animation.time - 350);
					}
				}
				setTimeout(function () {
					if (interval != undefined) clearInterval(interval);
					if (timeoutID != undefined) clearTimeout(timeoutID);
					if (animationID != undefined) cancelAnimationFrame(animationID);
					if (fake == true) {
						ui.window.removeChild(div);
					} else if (node == undefined || node == false) {
						ui.window.removeChild(div);
					} else {
						node.removeChild(div);
					}
					if (div2 && node) {
						node.removeChild(div2);
					}
					if (typeof _status.zhx_onAnimation === "number") {
						_status.zhx_onAnimation--;
					}
					if (_status.zhx_onAnimationPause == true && _status.zhx_onAnimation == 0) {
						delete _status.zhx_onAnimationPause;
						game.resume2();
					}
				}, animation.time);
			}
		};
		if (animation.delay != undefined) {
			setTimeout(finish, animation.delay);
		} else {
			finish();
		}
	},
	zsPlayLineAnimationByName(this: Game, name: string, path: [number, number, number, number]) {
		const from = [path[0], path[1]];
		const to = [path[2], path[3]];
		if (game.chess) {
			game.zsPlayLineAnimation(name, ui.chess, false, [from, to]);
		} else {
			game.zsPlayLineAnimation(name, ui.arena, false, [from, to]);
		}
	},
	zsXiangongLineXy(this: Game, path: [number, number, number, number]) {
		game.zsPlayLineAnimationByName("jianqilinexy", path);
	},
	zsZhuzhangLineXy(this: Game, path: [number, number, number, number]) {
		game.zsPlayLineAnimationByName("zhuzhanglinexy", path);
	},
	zsMohuaLineXy(this: Game, path: [number, number, number, number]) {
		game.zsPlayLineAnimationByName("mohualinexy", path);
	},
	zsShenjianLineXy(this: Game, path: [number, number, number, number]) {
		game.zsPlayLineAnimationByName("shenjianlinexy", path);
	},
	zsYujianLineXy(this: Game, path: [number, number, number, number]) {
		game.zsPlayLineAnimationByName("yujianlinexy", path);
	},
	zsAnheiLineXy(this: Game, path: [number, number, number, number]) {
		game.zsPlayLineAnimationByName("anheilinexy", path);
	},
	zsMozhuaLineXy(this: Game, path: [number, number, number, number]) {
		game.zsPlayLineAnimationByName("mozhualinexy", path);
	},
	zsJianfengLineXy(this: Game, path: [number, number, number, number]) {
		game.zsPlayLineAnimationByName("jianfenglinexy", path);
	},
	zsJinjianLineXy(this: Game, path: [number, number, number, number]) {
		game.zsPlayLineAnimationByName("jinjianlinexy", path);
	},
	zsJinlongLineXy(this: Game, path: [number, number, number, number]) {
		game.zsPlayLineAnimationByName("jinlonglinexy", path);
	},
	zsLuoyingLineXy(this: Game, path: [number, number, number, number]) {
		game.zsPlayLineAnimationByName("luoyinglinexy", path);
	},
	zsXingdieLineXy(this: Game, path: [number, number, number, number]) {
		game.zsPlayLineAnimationByName("xingdielinexy", path);
	},
	zsYuexianLineXy(this: Game, path: [number, number, number, number]) {
		game.zsPlayLineAnimationByName("yuexianlinexy", path);
	},
	zsShezhangLineXy(this: Game, path: [number, number, number, number]) {
		game.zsPlayLineAnimationByName("shezhanglinexy", path);
	},
};

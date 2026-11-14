/* eslint-disable no-var -- 保留原实现的函数作用域及 arguments 协议。 */
import { get } from "noname";
import { game } from "noname";
import { _status } from "noname";
import { ui } from "noname";
import { lib } from "noname";

export function createAppearanceBackgroundOptions() {
	return {
		// background_color_music:{
		// 	name:'背景色',
		// 	init:'black',
		// 	item:{
		// 		blue:'蓝色',
		// 		black:'黑色',
		// 	},
		// 	onclick(color){
		// 		game.saveConfig('background_color_music',color);
		// 		document.body.dataset.background_color_music=color;
		// 	}
		// },
		// background_color_wood:{
		// 	name:'背景色',
		// 	init:'blue',
		// 	item:{
		// 		blue:'蓝色',
		// 		black:'黑色',
		// 	},
		// 	onclick(color){
		// 		game.saveConfig('background_color_wood',color);
		// 		document.body.dataset.background_color_wood=color;
		// 	}
		// },
		// theme_color_music:{
		// 	name:'主题色',
		// 	init:'black',
		// 	item:{
		// 		blue:'蓝色',
		// 		black:'黑色',
		// 	},
		// 	onclick(color){
		// 		game.saveConfig('theme_color_music',color);
		// 		document.body.dataset.theme_color_music=color;
		// 	}
		// },
		ui_zoom: {
			name: "界面缩放",
			intro: "填入50~300以内的整数作为界面缩放比例（系统会转换为对应缩放百分比）",
			init: "100%",
			input: true,
			restart: true,
			onblur(e) {
				const text = e.target;
				let zoom = Number.parseInt(text.innerText);
				const originalValue = lib.config.ui_zoom;

				if (isNaN(zoom)) {
					alert("请填写数值！");
					text.innerText = originalValue;
					return;
				}
				if (zoom < 50 || zoom > 300) {
					alert("请填入50~300以内的整数！");
					text.innerText = originalValue;
					return;
				}

				const zoomText = `${zoom}%`;

				const confirmed = confirm(`确定要将界面缩放比例修改为 ${zoomText} 吗？`);
				if (!confirmed) {
					text.innerText = originalValue;
					return;
				}

				text.innerText = zoomText;
				game.saveConfig("ui_zoom", zoomText);
				game.documentZoom = (game.deviceZoom * zoom) / 100;

				ui.updatez();
				if (Array.isArray(lib.onresize)) {
					lib.onresize.forEach(fun => {
						if (typeof fun === "function") {
							fun();
						}
					});
				}
			},
		},
		image_background: {
			name: "游戏背景",
			init: "default",
			item: {} as Record<string, string>,
			visualBar: function (node, item, create) {
				if (node.created) {
					node.lastChild.classList.remove("active");
					return;
				}
				node.created = true;
				var fileInput = ui.create.filediv(
					".menubutton",
					"添加背景",
					node,
					/** @this {HTMLInputElement} */ function (this: HTMLInputElement, file) {
						var files = this.files;
						if (files && files.length > 0) {
							// 支持多文件导入
							var fileList = Array.from(files);
							var totalFiles = fileList.length;
							var processedFiles = 0;
							fileList.forEach(function (file, index) {
								if (file) {
									var name = file.name;
									if (name.includes(".")) {
										name = name.slice(0, name.indexOf("."));
									}
									var link = (game.writeFile ? "cdv_" : "custom_") + name;
									if (item[link]) {
										for (var i = 1; i < 1000; i++) {
											if (!item[link + "_" + i]) {
												link = link + "_" + i;
												break;
											}
										}
									}
									item[link] = name;
									var callback = function () {
										create(link, node.parentNode.defaultNode);
										node.parentNode.updateBr();
										lib.config.customBackgroundPack.add(link);
										game.saveConfig("customBackgroundPack", lib.config.customBackgroundPack);
										processedFiles++;
										if (processedFiles === totalFiles && node.lastChild.classList.contains("active")) {
											editbg.call(node.lastChild);
										}
									};
									if (game.writeFile) {
										game.writeFile(file, "image/background", link + ".jpg", callback);
									} else {
										game.putDB("image", link, file, callback);
									}
								}
							});
						}
					}
				);
				fileInput.inputNode.accept = "image/*";
				fileInput.inputNode.multiple = true;
				var editbg = /** @this {HTMLDivElement} */ function (this: HTMLDivElement) {
					this.classList.toggle("active");
					const page = this.parentElement?.parentElement;
					if (!(page instanceof HTMLElement)) {
						return;
					}
					type BackgroundButton = HTMLDivElement & { _link?: string };
					/** @param {Element} child @returns {child is BackgroundButton} */
					const isBackgroundButton = (child: Element): child is BackgroundButton => child instanceof HTMLDivElement;
					const buttons = Array.from(page.children).filter(isBackgroundButton);
					for (const button of buttons) {
						if (button.classList.contains("button")) {
							var link = button._link;
							if (link && link != "default") {
								var str;
								if (this.classList.contains("active")) {
									if (link.startsWith("custom_") || link.startsWith("cdv_")) {
										str = "删除";
									} else {
										str = "隐藏";
									}
								} else {
									str = item[link];
								}
								const firstChild = button.firstElementChild;
								if (firstChild instanceof HTMLElement) {
									firstChild.innerHTML = get.verticalStr(str);
								}
							}
						}
					}
				};
				ui.create.div(".menubutton", "编辑背景", node, editbg);
			},
			visualMenu: function (node, link, name, config) {
				node.className = "button character";
				node.style.backgroundImage = "";
				node.style.backgroundSize = "";
				if (node.firstChild) {
					node.firstChild.innerHTML = get.verticalStr(name);
				}
				if (link == "default" || link.startsWith("custom_")) {
					node.style.backgroundImage = "none";
					node.classList.add("dashedmenubutton");
					if (link.startsWith("custom_")) {
						game.getDB("image", link, function (fileToLoad) {
							if (!fileToLoad) {
								return;
							}
							var fileReader = new FileReader();
							fileReader.onload = function () {
								const data = fileReader.result;
								if (typeof data !== "string") {
									return;
								}
								node.style.backgroundImage = "url(" + data + ")";
								node.style.backgroundSize = "cover";
								node.classList.remove("dashedmenubutton");
							};
							fileReader.readAsDataURL(fileToLoad);
						});
					} else {
						node.parentNode.defaultNode = node;
					}
				} else {
					node.setBackgroundImage("image/background/" + link + ".jpg");
					node.style.backgroundSize = "cover";
				}
			},
			onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode, background, node) {
				if (node && node.firstChild) {
					var menu = node.parentNode;
					if (node.firstChild.innerHTML == get.verticalStr("隐藏")) {
						menu.parentNode.noclose = true;
						node.remove();
						menu.updateBr();
						if (!lib.config.prompt_hidebg) {
							alert("隐藏的背景可通过选项-其它-重置隐藏内容恢复");
							game.saveConfig("prompt_hidebg", true);
						}
						lib.config.hiddenBackgroundPack.add(background);
						game.saveConfig("hiddenBackgroundPack", lib.config.hiddenBackgroundPack);
						delete lib.configMenu.appearence.config.image_background.item[background];
						if (lib.config.image_background == background) {
							background = "default";
							this.lastChild.innerHTML = "默认";
						} else {
							this.lastChild.innerHTML = lib.configMenu.appearence.config.image_background.item[lib.config.image_background];
							return;
						}
					} else if (node.firstChild.innerHTML == get.verticalStr("删除")) {
						menu.parentNode.noclose = true;
						if (confirm("是否删除此背景？（此操作不可撤销）")) {
							node.remove();
							menu.updateBr();
							lib.config.customBackgroundPack.remove(background);
							game.saveConfig("customBackgroundPack", lib.config.customBackgroundPack);
							if (background.startsWith("cdv_")) {
								game.removeFile?.("image/background/" + background + ".jpg");
							} else {
								game.deleteDB("image", background);
							}
							delete lib.configMenu.appearence.config.image_background.item[background];
							if (lib.config.image_background == background) {
								background = "default";
								this.lastChild.innerHTML = "默认";
							} else {
								this.lastChild.innerHTML = lib.configMenu.appearence.config.image_background.item[lib.config.image_background];
								return;
							}
						}
					}
				}
				game.saveConfig("image_background", background);
				lib.init.background();
				game.updateBackground();
			},
		},
		image_background_random: {
			name: "随机背景",
			init: false,
			onclick(bool) {
				game.saveConfig("image_background_random", bool);
				lib.init.background();
			},
		},
		image_background_blur: {
			name: "背景模糊",
			init: false,
			onclick(bool) {
				game.saveConfig("image_background_blur", bool);
				if (lib.config.image_background_blur) {
					ui.background.style.filter = "blur(8px)";
					ui.background.style.webkitFilter = "blur(8px)";
					ui.background.style.transform = "scale(1.05)";
				} else {
					ui.background.style.filter = "";
					ui.background.style.webkitFilter = "";
					ui.background.style.transform = "";
				}
			},
		},
		phonelayout: {
			name: "触屏布局",
			init: false,
			onclick(bool) {
				if (get.is.nomenu("phonelayout", bool)) {
					return false;
				}
				game.saveConfig("phonelayout", bool);
				if (get.is.phoneLayout()) {
					if (ui.css.phone instanceof HTMLLinkElement) {
						ui.css.phone.href = lib.assetURL + "layout/default/phone.css";
					}
					ui.arena.classList.add("phone");
				} else {
					if (ui.css.phone instanceof HTMLLinkElement) {
						ui.css.phone.href = "";
					}
					ui.arena.classList.remove("phone");
				}
			},
		},
		change_skin: {
			name: "开启换肤",
			init: true,
			intro: "在武将资料卡界面换肤，皮肤添加方法查看docs/skin-guide.md文件",
			onclick(item) {
				game.saveConfig("change_skin", item);
				if (item == false) {
					game.broadcastAll(() => {
						lib.config.skin = {};
						game.saveConfig("skin", lib.config.skin);
					});
				}
			},
		},
		change_skin_auto: {
			name: "自动换肤",
			init: "off",
			item: {
				off: "关闭",
				30000: "半分钟",
				60000: "一分钟",
				120000: "两分钟",
				300000: "五分钟",
			} as Record<string, string>,
			intro: "游戏每进行一段时间自动为一个随机角色更换皮肤",
			onclick(item) {
				game.saveConfig("change_skin_auto", item);
				clearTimeout(_status.skintimeout);
				if (item != "off") {
					_status.skintimeout = setTimeout(ui.click.autoskin, parseInt(item));
				}
			},
		},
	};
}

/* eslint-disable no-var -- 保留原实现的函数作用域及 arguments 协议。 */
import { get } from "noname";
import { game } from "noname";
import { lib } from "noname";
import { requestImportData } from "@/library/configuration/menuBridge.js";

export function createConfigMenuOthers() {
	return {
		name: "其它",
		config: {
			// reset_database:{
			// 	name:'重置游戏',
			// 	onclick(){
			// 		var node=this;
			// 		if(node._clearing){
			// 			if(indexedDB) indexedDB.deleteDatabase(lib.configprefix+'data');
			// 			game.reload();
			// 			return;
			// 		}
			// 		node._clearing=true;
			// 		node.innerHTML='单击以确认 (3)';
			// 		setTimeout(function(){
			// 			node.innerHTML='单击以确认 (2)';
			// 			setTimeout(function(){
			// 				node.innerHTML='单击以确认 (1)';
			// 				setTimeout(function(){
			// 					node.innerHTML='重置游戏录像';
			// 					delete node._clearing;
			// 				},1000);
			// 			},1000);
			// 		},1000);
			// 	},
			// 	clear:true
			// },
			reset_game: {
				name: "重置游戏设置",
				onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode) {
					var node = this;
					if (node._clearing) {
						var noname_inited = localStorage.getItem("noname_inited");
						var onlineKey = localStorage.getItem(lib.configprefix + "key");
						localStorage.clear();
						if (noname_inited) {
							localStorage.setItem("noname_inited", noname_inited);
						}
						if (onlineKey) {
							localStorage.setItem(lib.configprefix + "key", onlineKey);
						}
						game.deleteDB("config");
						game.deleteDB("data");
						game.reload();
						return;
					}
					node._clearing = true;
					node.firstChild.innerHTML = "单击以确认 (3)";
					setTimeout(function () {
						node.firstChild.innerHTML = "单击以确认 (2)";
						setTimeout(function () {
							node.firstChild.innerHTML = "单击以确认 (1)";
							setTimeout(function () {
								node.firstChild.innerHTML = "重置游戏设置";
								delete node._clearing;
							}, 1000);
						}, 1000);
					}, 1000);
				},
				clear: true,
			},
			reset_hiddenpack: {
				name: "重置隐藏内容",
				onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode) {
					if (this.firstChild.innerHTML != "已重置") {
						this.firstChild.innerHTML = "已重置";
						game.saveConfig("hiddenModePack", []);
						game.saveConfig("hiddenCharacterPack", []);
						game.saveConfig("hiddenCardPack", []);
						game.saveConfig("hiddenPlayPack", []);
						game.saveConfig("hiddenBackgroundPack", []);
						var that = this;
						setTimeout(function () {
							that.firstChild.innerHTML = "重置隐藏内容";
							setTimeout(function () {
								if (confirm("是否重新启动使改变生效？")) {
									game.reload();
								}
							});
						}, 500);
					}
				},
				clear: true,
			},
			reset_tutorial: {
				name: "重置新手向导",
				onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode) {
					if (this.firstChild.innerHTML != "已重置") {
						this.firstChild.innerHTML = "已重置";
						game.saveConfig("new_tutorial", false);
						game.saveConfig("prompt_hidebg");
						game.saveConfig("prompt_hidepack");
						var that = this;
						setTimeout(function () {
							that.firstChild.innerHTML = "重置新手向导";
						}, 500);
					}
				},
				clear: true,
			},
			import_data: {
				name: "导入游戏设置",
				onclick() {
					requestImportData();
				},
				clear: true,
			},
			import_data_button: {
				name: '<div style="white-space:nowrap;width:calc(100% - 10px)">' + '<input type="file" accept="*/*" style="width:calc(100% - 40px)">' + '<button style="width:40px">确定</button></div>',
				clear: true,
			},
			export_data: {
				name: "导出游戏设置",
				onclick() {
					var data;
					var export_data = function (data) {
						game.export(lib.init.encode(JSON.stringify(data)), "无名杀 - 数据 - " + new Date().toLocaleString());
					};
					if (!lib.db) {
						data = {};
						for (var i in localStorage) {
							if (i.startsWith(lib.configprefix)) {
								data[i] = localStorage[i];
							}
						}
						export_data(data);
					} else {
						game.getDB("config", null, function (data1) {
							game.getDB("data", null, function (data2) {
								export_data({
									config: data1,
									data: data2,
								});
							});
						});
					}
				},
				clear: true,
			},
			remove_extension_onfig: {
				name: "重置无效扩展",
				clear: true,
				async onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode) {
					if (this.firstChild.innerHTML != "已重置") {
						let config = lib.config;
						if (get.is.object(config)) {
							let extensionList = config.extensions;
							for (let name of extensionList) {
								let num = await game.promises.checkDir(`extension/${name}`);
								if (num !== 1) {
									game.removeExtension(name);
								} else {
									let all = await game.promises.getFileList(`extension/${name}`);
									if (all?.[1].length) {
										const hasExtensionJs = all[1].includes("extension.js");
										const hasInfoJson = all[1].includes("info.json");

										if (!hasExtensionJs) {
											const message = hasInfoJson ? `扩展${name}有 info.json 但缺少 extension.js 文件` : `扩展${name}缺少必须的 extension.js 文件`;
											console.error(message);
											game.removeExtension(name);
										}
									}
								}
							}
						}
						this.firstChild.innerHTML = "已重置";
						const that = this;
						setTimeout(function () {
							that.firstChild.innerHTML = "重置无效扩展";
							setTimeout(function () {
								let ret = confirm(`检测完成，已为你清除无效配置，是否重启？`);
								if (ret) {
									game.reload();
								}
							});
						}, 500);
					}
				},
			},
			redownload_game: {
				name: "重新下载游戏",
				onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode) {
					var node = this;
					if (node._clearing) {
						localStorage.removeItem("noname_inited");
						game.reload();
						return;
					}
					node._clearing = true;
					node.firstChild.innerHTML = "单击以确认 (3)";
					setTimeout(function () {
						node.firstChild.innerHTML = "单击以确认 (2)";
						setTimeout(function () {
							node.firstChild.innerHTML = "单击以确认 (1)";
							setTimeout(function () {
								node.firstChild.innerHTML = "重新下载游戏";
								delete node._clearing;
							}, 1000);
						}, 1000);
					}, 1000);
				},
				clear: true,
			},
			update: function (config, map) {
				if (lib.device || lib.node) {
					map.redownload_game.show();
				} else {
					map.redownload_game.hide();
				}
			},
			// trim_game:{
			// 	name:'隐藏非官方扩展包',
			// 	onclick(){
			// 		if(this.innerHTML!='已隐藏'){
			// 			this.innerHTML='已隐藏';
			//      						 var pack=lib.config.all.cards.slice(0);
			//      						 if(Array.isArray(lib.config.hiddenCardPack)){
			//      									  for(var i=0;i<lib.config.hiddenCardPack.length;i++){
			//      															pack.add(lib.config.hiddenCardPack[i]);
			//      									  }
			//      						 }
			//      						 for(var i=0;i<pack.length;i++){
			//      									  if(lib.config.all.sgscards.includes(pack[i])){
			//      															pack.splice(i--,1);
			//      									  }
			//      						 }
			// 			game.saveConfig('hiddenCardPack',pack);
			//
			//      						 var pack=lib.config.all.characters.slice(0);
			//      						 if(Array.isArray(lib.config.hiddenCharacterPack)){
			//      									  for(var i=0;i<lib.config.hiddenCharacterPack.length;i++){
			//      															pack.add(lib.config.hiddenCharacterPack[i]);
			//      									  }
			//      						 }
			//      						 for(var i=0;i<pack.length;i++){
			//      									  if(lib.config.all.sgscharacters.includes(pack[i])){
			//      															pack.splice(i--,1);
			//      									  }
			//      						 }
			// 			game.saveConfig('hiddenCharacterPack',pack);
			//
			//      						 var pack=lib.config.all.mode.slice(0);
			//      						 if(Array.isArray(lib.config.hiddenModePack)){
			//      									  for(var i=0;i<lib.config.hiddenModePack.length;i++){
			//      															pack.add(lib.config.hiddenModePack[i]);
			//      									  }
			//      						 }
			//      						 for(var i=0;i<pack.length;i++){
			//      									  if(lib.config.all.sgsmodes.includes(pack[i])){
			//      															pack.splice(i--,1);
			//      									  }
			//      						 }
			// 			game.saveConfig('hiddenModePack',pack);
			//
			// 			var that=this;
			// 			setTimeout(function(){
			// 				that.innerHTML='隐藏非官方扩展包';
			// 			},500);
			// 		}
			// 	},
			// 	clear:true
			// }
		},
	};
}

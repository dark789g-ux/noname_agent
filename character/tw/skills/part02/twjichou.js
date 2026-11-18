import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twjichou" | "twjilun">} */
export const groupSkills = {
	//蒋济
	twjichou: {
		audio: 3,
		enable: "chooseToUse",
		group: ["twjichou_ban", "twjichou_give"],
		filter(event, player) {
			if (player.hasSkill("twjichou_used") && player.hasSkill("twjichou_given")) {
				return false;
			}
			if (!player.hasSkill("twjichou_used")) {
				var record = player.getStorage("twjichou");
				for (var i of lib.inpile) {
					var type = get.type(i);
					if (type == "trick" && !record.includes(i) && event.filterCard({ name: i, isCard: true }, player, event)) {
						return true;
					}
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				var dialog = ui.create.dialog("急筹");
				if (
					!player.hasSkill("twjichou_used") &&
					!player.hasSkill("twjichou_given") &&
					event.type == "phase" &&
					player.countCards("h", card => {
						return player.getStorage("twjichou").includes(get.name(card));
					})
				) {
					dialog._chosenOpt = [];
					var table = document.createElement("div");
					table.classList.add("add-setting");
					table.style.margin = "0";
					table.style.width = "100%";
					table.style.position = "relative";
					var list = ["视为使用牌", "交出锦囊牌"];
					for (var i of list) {
						var td = ui.create.div(".shadowed.reduce_radius.pointerdiv.tdnode");
						td.innerHTML = "<span>" + i + "</span>";
						td.link = i;
						if (i == list[0]) {
							td.classList.add("bluebg");
							dialog._chosenOpt.add(td);
						}
						td.addEventListener(lib.config.touchscreen ? "touchend" : "click", function () {
							if (_status.dragged) {
								return;
							}
							if (_status.clicked) {
								return;
							}
							if (_status.justdragged) {
								return;
							}
							_status.tempNoButton = true;
							_status.clicked = true;
							setTimeout(function () {
								_status.tempNoButton = false;
							}, 500);
							var link = this.link;
							if (link == "交出锦囊牌") {
								game.uncheck();
							}
							var current = this.parentNode.querySelector(".bluebg");
							if (current) {
								current.classList.remove("bluebg");
								dialog._chosenOpt.remove(current);
							}
							dialog._chosenOpt.add(this);
							this.classList.add("bluebg");
							game.check();
						});
						table.appendChild(td);
						dialog.buttons.add(td);
					}
					dialog.content.appendChild(table);
				}
				var list = [],
					record = player.getStorage("twjichou");
				for (var name of lib.inpile) {
					if (get.type(name) == "trick" && !record.includes(name) && event.filterCard({ name: name, isCard: true }, player, event)) {
						list.push(["锦囊", "", name]);
					}
				}
				dialog.add([list, "vcard"]);
				return dialog;
			},
			filter(button) {
				if (_status.event.dialog) {
					var opts = _status.event.dialog._chosenOpt;
					if (opts && opts.length && opts[0].link == "交出锦囊牌" && typeof button.link != typeof opts[0].link) {
						return false;
					}
					return true;
				}
				return false;
			},
			select() {
				if (_status.event.dialog) {
					var opts = _status.event.dialog._chosenOpt;
					return opts && opts.length && opts[0].link == "交出锦囊牌" ? 0 : 1;
				}
				return 0;
			},
			check(button) {
				if (_status.event.getParent().type != "phase") {
					return 1;
				}
				var player = _status.event.player;
				if (["wugu", "zhulu_card", "yiyi", "lulitongxin", "lianjunshengyan", "diaohulishan"].includes(button.link[2])) {
					return 0.1;
				}
				return player.getUseValue({ name: button.link[2] });
			},
			backup(links, player) {
				var isUse = links.length == 1;
				var backup = get.copy(lib.skill["twjichou_" + (isUse ? "use" : "give")]);
				if (isUse) {
					backup.viewAs = { name: links[0][2], isCard: true };
				}
				return backup;
			},
			prompt(links, player) {
				var isUse = links.length == 1;
				return "急筹：" + (isUse ? "视为使用" + get.translation(links[0][2]) + "" : "选择要交出的牌和要交给的目标");
			},
		},
		hiddenCard(player, name) {
			if (player.hasSkill("twjichou_used")) {
				return false;
			}
			var type = get.type(name);
			return type == "trick" && !player.getStorage("twjichou").includes(name);
		},
		marktext: "筹",
		intro: {
			markcount(storage, player) {
				if (storage && storage.length) {
					return storage.length;
				}
				return 0;
			},
			content: "已记录牌名：$",
		},
		ai: {
			order: 1,
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
		subSkill: {
			backup: {},
			used: { charlotte: true },
			given: { charlotte: true },
			ban: {
				trigger: { global: "useCard1" },
				filter(event, player) {
					return player.getStorage("twjichou").includes(event.card.name);
				},
				forced: true,
				locked: false,
				silent: true,
				content() {
					trigger.directHit.add(player);
				},
				mod: {
					cardEnabled(card, player) {
						if (
							player.getStorage("twjichou").includes(card.name) &&
							(get.position(card) == "h" || (card.cards && card.cards.some(i => get.position(i) == "h")))
						) {
							return false;
						}
					},
					cardSavable(card, player) {
						if (
							player.getStorage("twjichou").includes(card.name) &&
							(get.position(card) == "h" || (card.cards && card.cards.some(i => get.position(i) == "h")))
						) {
							return false;
						}
					},
					aiValue(player, card) {
						if (get.type(card) != "trick" || _status.twjichou_give_aiCheck) {
							return;
						}
						if (!player.getFriends().length && player.getStorage("twjichou").includes(get.name(card))) {
							return 0;
						}
					},
					aiUseful() {
						return lib.skill.twjichou_ban.mod.aiValue.apply(this, arguments);
					},
				},
			},
			use: {
				filterCard: () => false,
				selectCard: -1,
				audio: "twjichou",
				popname: true,
				onuse(links, player) {
					player.markAuto("twjichou", [links.card.name]);
					player.syncStorage("twjichou");
					player.addTempSkill("twjichou_used");
				},
			},
			give: {
				audio: "twjichou",
				enable: "phaseUse",
				filter(event, player) {
					return (
						player.hasSkill("twjichou_used") &&
						!player.hasSkill("twjichou_given") &&
						player.countCards("h", i => player.getStorage("twjichou").includes(get.name(i)))
					);
				},
				filterTarget(card, player, target) {
					return target != player;
				},
				filterCard(card, player) {
					return player.getStorage("twjichou").includes(get.name(card));
				},
				check(card) {
					_status.twjichou_give_aiCheck = true;
					var val = get.value(card);
					delete _status.twjichou_give_aiCheck;
					return val;
				},
				prompt: () => "选择要交出的牌和要交给的目标",
				selectCard: [1, Infinity],
				discard: false,
				lose: false,
				delay: false,
				allowChooseAll: true,
				content() {
					player.give(cards, target);
					player.addTempSkill("twjichou_given", "phaseUseAfter");
				},
				ai: {
					order: 0.9,
					result: {
						target(player, target) {
							if (target.hasSkillTag("nogain")) {
								return 0;
							}
							if (target.hasJudge("lebu")) {
								return 0;
							}
							return target
								.getCards("h", card => player.getStorage("twjichou").includes(get.name(card)))
								.reduce((p, c) => p + (target.getUseValue(c) || 1), 0);
						},
					},
				},
			},
		},
	},
	twjilun: {
		audio: 2,
		trigger: { player: "damageEnd" },
		async cost(event, trigger, player) {
			const num = Math.min(Math.max(1, player.getStorage("twjichou").length), 5);
			const list = player
				.getStorage("twjichou")
				.filter(name => !player.getStorage(event.skill).includes(name))
				.map(name => ["锦囊", "", name]);
			if (list.length) {
				const result = await player
					.chooseButton([
						`###${get.prompt(event.skill)}###摸${get.cnNumber(num)}张牌或者视为使用一张牌`,
						[[[num, `摸${get.cnNumber(num)}张牌`]], "tdnodes"],
						[list, "vcard"],
					])
					.set("filterButton", button => {
						const { player, numx } = get.event();
						const { link } = button;
						if (!Array.isArray(link)) {
							return true;
						}
						return player.hasUseTarget({ name: link[2], nature: link[3] });
					})
					.set("ai", button => {
						const { player, numx } = get.event();
						const { link } = button;
						const val = numx > 3 ? Math.min(1.5, 1 + (numx - 3) * 0.1) : 1;
						if (Array.isArray(link)) {
							if (player.getUseValue({ name: link[2], nature: link[3] }) > 4 * val) {
								return 1;
							}
						}
						if (typeof link == "number") {
							return 1;
						}
						return 0;
					})
					.set("numx", num)
					.forResult();
				event.result = {
					bool: result?.bool,
					cost_data: result?.links,
				};
			} else {
				event.result = await player.chooseBool(get.prompt(event.skill), `摸${get.cnNumber(num)}张牌`).forResult();
				if (event.result?.bool) {
					event.result.cost_data = [num];
				}
			}
		},
		async content(event, trigger, player) {
			const { cost_data: links } = event;
			if (typeof links[0] == "number") {
				await player.draw(links[0]);
			} else {
				const card = get.autoViewAs({ name: links[0][2], nature: links[0][3], isCard: true });
				player.markAuto(event.name, [card.name]);
				await player.chooseUseTarget(card, true);
			}
		},
		marktext: "论",
		intro: { content: "已记录牌名：$" },
		onremove: true,
		ai: {
			maixie: true,
			maixie_defend: true,
			threaten: 0.7,
		},
	},
};

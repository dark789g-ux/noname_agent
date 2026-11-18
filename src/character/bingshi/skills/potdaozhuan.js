import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "potdaozhuan">} */
export const groupSkills = {
	//势于吉
	potdaozhuan: {
		audio: 4,
		enable: "chooseToUse",
		logAudio: index => (typeof index === "number" ? "potdaozhuan" + index + ".mp3" : 2),
		filter(event, player) {
			if (event.potdaozhuan) {
				return false;
			}
			let num = player.countCards("he");
			if (_status.currentPhase?.isIn() && _status.currentPhase !== player) {
				num += _status.currentPhase.countCards("he");
			}
			if (num <= 0) {
				return false;
			}
			return get
				.inpileVCardList(info => {
					const name = info[2];
					if (get.type(name) !== "basic") {
						return false;
					}
					return !player.getStorage("potdaozhuan_used").includes(name);
				})
				.some(card => event.filterCard(new lib.element.VCard({ name: card[2], nature: card[3], isCard: true }), player, event));
		},
		usable: 1,
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog("道转", [get.inpileVCardList(info => get.type(info[2]) === "basic"), "vcard"]);
			},
			filter(button, player) {
				const event = get.event().getParent();
				if (player.getStorage("potdaozhuan_used").includes(button.link[2])) {
					return false;
				}
				return event.filterCard(new lib.element.VCard({ name: button.link[2], nature: button.link[3], isCard: true }), player, event);
			},
			check(button) {
				const event = get.event().getParent();
				if (event.type !== "phase") {
					return 1;
				}
				return get.player().getUseValue(new lib.element.VCard({ name: button.link[2], nature: button.link[3], isCard: true }));
			},
			prompt(links, player) {
				let prompt = "将你";
				if (_status.currentPhase?.isIn() && _status.currentPhase !== player) {
					prompt += "或" + get.translation(_status.currentPhase);
				}
				prompt += "的一张牌置入弃牌堆，";
				return '###道转###<div class="text center">' + prompt + "视为使用" + (get.translation(links[0][3]) || "") + "【" + get.translation(links[0][2]) + "】</div>";
			},
			backup(links) {
				return {
					filterCard: () => false,
					selectCard: -1,
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						isCard: true,
					},
					log: false,
					async precontent(event, trigger, player) {
						const goon = _status.currentPhase?.isIn() && _status.currentPhase !== player;
						let prompt = "将你";
						if (goon) {
							prompt += "或" + get.translation(_status.currentPhase);
						}
						prompt += "的一张牌置入弃牌堆";
						let dialog = ["道转：" + prompt];
						if (player.countCards("h")) {
							dialog.push('<div class="text center">你的手牌</div>');
							dialog.push(player.getCards("h"));
						}
						if (player.countCards("e")) {
							dialog.push('<div class="text center">你的装备牌</div>');
							dialog.push(player.getCards("e"));
						}
						if (goon) {
							const target = _status.currentPhase;
							if (target.countCards("h")) {
								const cards = target.getCards("h");
								dialog.push('<div class="text center">' + get.translation(target) + "的手牌</div>");
								if (player.hasSkillTag("viewHandcard", null, target, true)) {
									dialog.push(cards);
								} else {
									dialog.push([cards.slice().randomSort(), "blank"]);
								}
							}
							if (target.countCards("e")) {
								dialog.push('<div class="text center">' + get.translation(target) + "的装备牌</div>");
								dialog.push(target.getCards("e"));
							}
						}
						const result = await player
							.chooseButton(dialog)
							.set("filterButton", button => {
								const card = button.link,
									{ player, useCard, targets } = get.event();
								if (!targets?.length) {
									return true;
								}
								ui.selected.cards.add(card);
								const bool = targets.some(target => {
									if (!lib.filter.cardEnabled(useCard, player, "forceEnable")) {
										return false;
									}
									return lib.filter.targetEnabled2(useCard, player, target) && lib.filter.targetInRange(useCard, player, target);
								});
								ui.selected.cards.remove(card);
								return bool;
							})
							.set("useCard", event.result.card)
							.set("targets", event.result.targets)
							.set("ai", button => {
								const player = get.player(),
									source = get.owner(button.link);
								return get.value(button.link, get.owner(source)) * Math.sign(-get.attitude(player, source));
							})
							.forResult();
						if (result?.bool) {
							player.logSkill("potdaozhuan", null, null, null, [get.rand(1, 2)]);
							player.addTempSkill("potdaozhuan_used", "roundStart");
							player.markAuto("potdaozhuan_used", [event.result.card.name]);
							if (result.links?.length) {
								const target = _status.currentPhase;
								const owners = result.links.map(i => get.owner(i)).unique();
								await owners[0].loseToDiscardpile(result.links);
								if (owners[0] === target) {
									player.tempBanSkill("potdaozhuan", "roundStart");
									player.logSkill("potdaozhuan", null, null, null, [get.rand(3, 4)]);
								}
							}
							return;
						}
						const evt = event.getParent();
						evt.set("potdaozhuan", true);
						evt.goto(0);
					},
				};
			},
		},
		hiddenCard(player, name) {
			if (player.isTempBanned("potdaozhuan") || player.getStat("skill")["potdaozhuan"]) {
				return false;
			}
			return get.type(name) === "basic" && !player.getStorage("potdaozhuan_used").includes(name);
		},
		ai: {
			fireAttack: true,
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				if (arg === "respond") {
					return false;
				}
				return get.info("potdaozhuan").hiddenCard(
					player,
					(() => {
						switch (tag) {
							case "fireAttack":
								return "sha";
							default:
								return tag.slice("respond".length).toLowerCase();
						}
					})()
				);
			},
			order(item, player) {
				if (player && _status.event.type === "phase") {
					let max = 0,
						names = get.inpileVCardList(info => {
							const name = info[2];
							if (get.type(name) !== "basic") {
								return false;
							}
							return !player.getStorage("potdaozhuan_used").includes(name);
						});
					names = names.map(namex => new lib.element.VCard({ name: namex[2], nature: namex[3] }));
					names.forEach(card => {
						if (player.getUseValue(card) > 0) {
							let temp = get.order(card);
							if (temp > max) {
								max = temp;
							}
						}
					});
					return max + (max > 0 ? 0.2 : 0);
				}
				return 10;
			},
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
			used: {
				charlotte: true,
				onremove: true,
				intro: { content: "本轮已使用牌名：$" },
			},
		},
	},
};

import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcllqixin" | "dcjiusi">} */
export const groupSkills = {
	//二刘
	dcllqixin: {
		audio: 2,
		trigger: {
			player: ["gainAfter", "useCard"],
			global: "loseAsyncAfter",
		},
		filter(event, player) {
			if (event.name === "useCard") {
				return (event.getParent().name !== "chooseToUse" || event.getParent(2).name !== "dcllqixin") && get.type(event.card) === "basic";
			}
			if (event.name === "gain" && (event.getParent().name !== "draw" || event.getParent(2).name === "dcllqixin")) {
				return false;
			}
			if (event.name !== "gain" && event.type !== "draw") {
				return false;
			}
			return event.getg(player).length === 2;
		},
		usable: 2,
		frequent: true,
		direct: true,
		async content(event, trigger, player) {
			let result;
			if (trigger.name === "useCard") {
				result = await player.chooseBool(get.prompt(event.name), "摸两张牌").set("frequentSkill", event.name).forResult();
				if (result?.bool) {
					player.logSkill(event.name);
					await player.draw(2);
				}
			} else {
				result = await player
					.chooseToUse(
						function (card, player, event) {
							if (get.type(card) !== "basic") {
								return false;
							}
							return lib.filter.cardEnabled.apply(this, arguments);
						},
						`###${get.prompt(event.name)}###使用一张基本牌`
					)
					.set("logSkill", event.name)
					.set("addCount", false)
					.forResult();
			}
			if (!result?.bool) {
				const stat = player.getStat().triggerSkill;
				if (typeof stat[event.name] == "number") {
					stat[event.name]--;
				}
			}
		},
	},
	dcjiusi: {
		audio: 2,
		enable: "chooseToUse",
		filter(event, player) {
			if (event.type === "wuxie") {
				return false;
			}
			return get
				.inpileVCardList(info => get.type(info[2]) == "basic")
				.some(card => {
					return event.filterCard({ name: card[2], nature: card[3] }, player, event);
				});
		},
		usable: 1,
		chooseButton: {
			dialog(event, player) {
				const list = get
					.inpileVCardList(info => get.type(info[2]) == "basic")
					.filter(card => {
						return event.filterCard({ name: card[2], nature: card[3] }, player, event);
					});
				return ui.create.dialog("纠思", [list, "vcard"], "hidden");
			},
			check(button) {
				const event = get.event().getParent();
				if (event.type !== "phase") {
					return 1;
				}
				return get.player().getUseValue({ name: button.link[2], nature: button.link[3] });
			},
			prompt(links) {
				return "将武将牌翻面，视为使用" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]);
			},
			backup(links, player) {
				return {
					selectCard: -1,
					filterCard: () => false,
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						isCard: true,
					},
					log: false,
					precontent() {
						player.logSkill("dcjiusi");
						player.turnOver();
					},
				};
			},
		},
		hiddenCard(player, name) {
			if (player.getStat("skill").dcjiusi) {
				return false;
			}
			return get.type(name) == "basic" && lib.inpile.includes(name);
		},
		ai: {
			order: 10,
			respondShan: true,
			respondSha: true,
			skillTagFilter(player, tag, arg) {
				if (arg === "respond") {
					return false;
				}
				return get.info("dcjiusi").hiddenCard(player, tag.slice("respond".length).toLowerCase());
			},
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
			effect: {
				target(card, player, target) {
					if (!target.isTurnedOver() || player == target || target.getStat("skill").dcjiusi || !get.tag(card, "respond")) {
						return;
					} else if (get.cardDescription(card).indexOf("打出") > -1) {
						return;
					}
					let eff = target.hasSkill("dcllqixin") && target.getStat("triggerSkill").dcllqixin < 2 ? 2 : 1;
					return [1, eff];
				},
			},
		},
	},
};

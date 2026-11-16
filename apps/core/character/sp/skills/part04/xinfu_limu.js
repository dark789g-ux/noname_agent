import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xinfu_limu">} */
export const groupSkills = {
	xinfu_limu: {
		mod: {
			targetInRange(card, player, target) {
				if (player.countCards("j") && player.inRange(target)) {
					return true;
				}
			},
			cardUsableTarget(card, player, target) {
				if (player.countCards("j") && player.inRange(target)) {
					return true;
				}
			},
			aiOrder(player, card, num) {
				if (get.type(card, null, player) == "trick" && player.canUse(card, player) && player.canAddJudge(card)) {
					return 15;
				}
			},
		},
		locked: false,
		audio: 2,
		enable: "phaseUse",
		discard: false,
		filter(event, player) {
			if (player.hasJudge("lebu")) {
				return false;
			}
			return player.countCards("hes", { suit: "diamond" }) > 0;
		},
		viewAs: { name: "lebu" },
		//prepare:"throw",
		position: "hes",
		filterCard(card, player, event) {
			const lebu = get.autoViewAs({ name: "lebu", cards: [card] }, [card]);
			return get.suit(card) == "diamond" && lib.filter.judge(lebu, player, player);
		},
		selectTarget: -1,
		filterTarget(card, player, target) {
			return player == target;
		},
		check(card) {
			var player = _status.event.player;
			if (!player.getEquip("zhangba")) {
				let damaged = player.maxHp - player.hp - 1;
				if (
					player.countCards("h", function (cardx) {
						if (cardx == card) {
							return false;
						}
						if (cardx.name == "tao") {
							if (damaged < 1) {
								return true;
							}
							damaged--;
						}
						return ["shan", "jiu"].includes(cardx.name);
					}) > 0
				) {
					return 0;
				}
			}
			if (card.name == "shan") {
				return 15;
			}
			if (card.name == "tao" || card.name == "jiu") {
				return 10;
			}
			return 9 - get.value(card);
		},
		onuse(links, player) {
			var next = game.createEvent("limu_recover", false, _status.event.getParent());
			next.player = player;
			next.setContent(function () {
				player.recover();
			});
		},
		ai: {
			result: {
				target(player, target) {
					if (player.countCards("hes", "zhangba")) {
						return player.countCards("h", { type: "basic" });
					}
					let res = lib.card.lebu.ai.result.target(player, target);
					if (player.countCards("hs", "sha") >= player.hp) {
						res++;
					}
					if (target.isDamaged()) {
						return res + 2 * Math.abs(get.recoverEffect(target, player, target));
					}
					return res;
				},
				ignoreStatus: true,
			},
			order(item, player) {
				if (player.hp > 1 && player.countCards("j")) {
					return 0;
				}
				return 12;
			},
			effect: {
				target(card, player, target) {
					if (target.isPhaseUsing() && typeof card === "object" && get.type(card, null, target) === "delay" && !target.countCards("j")) {
						let shas =
							target.getCards("hs", i => {
								if (card === i || (card.cards && card.cards.includes(i))) {
									return false;
								}
								return get.name(i, target) === "sha" && target.getUseValue(i) > 0;
							}) - target.getCardUsable("sha");
						if (shas > 0) {
							return [1, 1.5 * shas];
						}
					}
				},
			},
		},
	},
};

import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twshouzhu" | "beOfOneHeart" | "twdaigui" | "twcairu">} */
export const groupSkills = {
	//诸葛均
	twshouzhu: {
		audio: 2,
		global: "beOfOneHeart",
		oneHeart: true,
		trigger: {
			player: "phaseUseBegin",
		},
		filter(event, player) {
			return player.getStorage("beOfOneHeartWith").some(target => {
				return target.isIn();
			});
		},
		logTarget(event, player) {
			return player.getStorage("beOfOneHeartWith").filter(target => {
				return target.isIn();
			});
		},
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			const targets = player.getStorage("beOfOneHeartWith").filter(target => {
				return target.isIn();
			});
			let count = 0;
			for (const current of targets) {
				if (!current.isIn()) {
					continue;
				}
				const { cards } = await current
					.chooseToGive(
						`${get.translation(player)}对你发动了【受嘱】`,
						"作为其的同心角色，是否交给其至多四张牌？",
						player,
						"he",
						[1, 4],
						"allowChooseAll"
					)
					.set("ai", card => {
						if (!get.event().goon) {
							return -get.value(card);
						}
						if (ui.selected.cards.length < 2) {
							return 4.5 + ui.selected.cards.length - get.value(card) + get.player().getUseValue(card) / 5;
						}
						return 0;
					})
					.set("goon", get.attitude(current, player) > 0)
					.forResult();
				if (cards && cards.length) {
					count += cards.length;
				}
			}
			if (count < 2) {
				return;
			}
			await game.asyncDraw(targets, 2);
			await game.delay();
			targets.unshift(player);
			for (const current of targets) {
				const cards = get.cards(count);
				await game.cardsGotoOrdering(cards);
				const next = current.chooseToMove("allowChooseAll");
				next.set("list", [["牌堆底", cards], ["弃牌堆"]]);
				next.set("prompt", "受嘱：点击排列牌置于牌堆底的顺序，或置入弃牌堆");
				next.set("processAI", list => {
					const cards = list[0][1],
						player = get.player();
					let bottom = [],
						discard = [];
					cards.sort((a, b) => get.value(b, player) - get.value(a, player));
					while (cards.length) {
						if (get.value(cards[0], player) <= 5) {
							break;
						}
						bottom.unshift(cards.shift());
					}
					discard = cards;
					return [bottom, discard];
				});
				const { moved } = await next.forResult();
				const bottom = moved[0];
				const discard = moved[1];
				if (bottom.length) {
					await game.cardsGotoPile(bottom);
				}
				current.popup(get.cnNumber(bottom.length) + "下");
				game.log(current, "将" + get.cnNumber(bottom.length) + "张牌置于牌堆底");
				if (discard.length) {
					await game.cardsDiscard(discard);
					game.log(current, "将", discard, "置入了弃牌堆");
				}
				await game.delayx();
			}
		},
	},
	beOfOneHeart: {
		trigger: { player: "phaseBegin" },
		filter(event, player) {
			if (!game.hasPlayer(current => current !== player)) {
				return false;
			}
			return player.getSkills().some(skill => {
				const info = get.info(skill);
				if (!info || !info.oneHeart) {
					return false;
				}
				return true;
			});
		},
		forced: true,
		ruleSkill: true,
		async content(event, trigger, player) {
			const beOfOneHeartLimit = player.storage.beOfOneHeartLimit || 1;
			const { targets } = await player
				.chooseTarget("请选择你的“同心”角色", lib.filter.notMe, [1, beOfOneHeartLimit])
				.set("ai", function (target) {
					const aiCheck = lib.skill.beOfOneHeart.aiCheck.slice();
					let eff = 0;
					while (aiCheck.length) {
						const func = aiCheck.shift();
						if (typeof func !== "function") {
							continue;
						}
						eff += func.apply(this, arguments);
					}
					return eff;
				})
				.forResult();
			if (!targets || !targets.length) {
				return;
			}
			player.line(targets, "green");
			game.log(player, "选择了", targets, "作为自己的同心角色");
			player.setStorage("beOfOneHeartWith", targets);
			player.markSkill("beOfOneHeart");
			player
				.when({ player: "phaseBegin" }, false)
				.assign({ firstDo: true })
				.step(async () => {
					delete player.storage.beOfOneHeartWith;
					player.unmarkSkill("beOfOneHeart");
				})
				.finish();
			await game.delayx();
		},
		marktext: "❤",
		aiCheck: [
			target => {
				return get.attitude(get.player(), target);
			},
		],
		intro: {
			name: "同心",
			content(_, player) {
				return `当前同心角色：${get.translation(player.getStorage("beOfOneHeartWith"))}`;
			},
		},
	},
	twdaigui: {
		audio: 2,
		trigger: { player: "phaseUseEnd" },
		filter(event, player) {
			if (!player.countCards("h")) {
				return false;
			}
			const color = get.color(player.getCards("h")[0]);
			return player.getCards("h").every(card => {
				return get.color(card) === color;
			});
		},
		async cost(event, trigger, player) {
			const maxLimit = player.countCards("h");
			event.result = await player
				.chooseTarget(
					get.prompt(event.skill),
					`选择至多${get.cnNumber(maxLimit)}名角色并亮出牌堆底等量的牌，令这些角色依次选择并获得其中一张。`,
					[1, maxLimit]
				)
				.set("ai", target => {
					const player = get.player();
					return get.attitude(player, target) * (player === target && player.needsToDiscard(1) ? 0.4 : 1);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { targets } = event;
			const cards = get.bottomCards(targets.length);
			await game.cardsGotoOrdering(cards);
			const videoId = lib.status.videoId++;
			game.addVideo("cardDialog", null, ["待归", get.cardsInfo(cards), videoId]);
			game.broadcastAll(
				function (cards, videoId) {
					const dialog = ui.create.dialog("待归", cards, true);
					_status.dieClose.push(dialog);
					dialog.videoId = videoId;
				},
				cards,
				videoId
			);
			await game.delay();
			const chooseableCards = cards.slice();
			for (const current of targets) {
				if (!current.isIn() || !chooseableCards.length) {
					continue;
				}
				const result = await current
					.chooseButton(true)
					.set("dialog", videoId)
					.set("closeDialog", false)
					.set("dialogdisplay", true)
					.set("cardFilter", chooseableCards.slice())
					.set("filterButton", button => {
						return get.event().cardFilter.includes(button.link);
					})
					.set("ai", button => {
						return get.value(button.link, _status.event.player);
					})
					.forResult();
				if (!result?.links?.length) {
					continue;
				}
				const [card] = result.links;
				if (card) {
					current.gain(card, "gain2");
					chooseableCards.remove(card);
				}
				const capt = `${get.translation(current)}选择了${get.translation(card)}`;
				game.broadcastAll(
					function (card, id, name, capt) {
						const dialog = get.idDialog(id);
						if (dialog) {
							dialog.content.firstChild.innerHTML = capt;
							for (let i = 0; i < dialog.buttons.length; i++) {
								if (dialog.buttons[i].link == card) {
									game.createButtonCardsetion(name, dialog.buttons[i]);
									break;
								}
							}
							game.addVideo("dialogCapt", null, [dialog.videoId, dialog.content.firstChild.innerHTML]);
						}
					},
					card,
					videoId,
					current.getName(true),
					capt
				);
			}
			if (chooseableCards.length) {
				await game.cardsDiscard(chooseableCards);
			}
			game.broadcastAll(function (id) {
				const dialog = get.idDialog(id);
				if (dialog) {
					dialog.close();
					_status.dieClose.remove(dialog);
				}
			}, videoId);
			game.addVideo("cardDialog", null, videoId);
		},
	},
	twcairu: {
		audio: 2,
		enable: ["chooseToUse", "chooseToRespond"],
		filter(event, player) {
			return ["huogong", "tiesuo", "wuzhong"].some(name => {
				if (player.getStorage("twcairu_used").filter(namex => namex == name).length > 1) {
					return false;
				}
				return event.filterCard({ name }, player, event);
			});
		},
		chooseButton: {
			dialog(event, player) {
				const list = ["huogong", "tiesuo", "wuzhong"]
					.filter(name => {
						if (player.getStorage("twcairu_used").filter(namex => namex == name).length > 1) {
							return false;
						}
						return event.filterCard({ name }, player, event);
					})
					.map(name => [get.translation(get.type(name)), "", name]);
				return ui.create.dialog("才濡", [list, "vcard"]);
			},
			check(button) {
				return get.player().getUseValue({ name: button.link[2] });
			},
			backup(links, player) {
				return {
					audio: "twcairu",
					filterCard(card, player) {
						const color = get.color(card, player);
						return !ui.selected.cards.length || get.color(ui.selected.cards[0]) != color;
					},
					selectCard: 2,
					complexCard: true,
					popname: true,
					check(card) {
						return 5 - get.value(card);
					},
					position: "hes",
					viewAs: { name: links[0][2] },
					log: false,
					precontent() {
						player.logSkill("twcairu");
						if (!player.storage.twcairu_used) {
							player.storage.twcairu_used = [];
							player.when({ global: "phaseAfter" }).step(async () => {
								delete player.storage.twcairu_used;
							});
						}
						player.storage.twcairu_used.push(event.result.card.name);
					},
				};
			},
			prompt(links, player) {
				return "将两张颜色不同的牌当【" + get.translation(links[0][2]) + "】使用";
			},
		},
		subSkill: { backup: {} },
		ai: {
			order(item, player) {
				if (!player || _status.event.type != "phase") {
					return 0.001;
				}
				let max = 0,
					names = ["huogong", "tiesuo", "wuzhong"].filter(name => {
						if (player.getStorage("twcairu_used").includes(name)) {
							return false;
						}
						return player.hasValueTarget(name, true, true);
					});
				if (!names.length) {
					return 0;
				}
				names = names.map(namex => ({ name: namex }));
				names.forEach(card => {
					if (player.getUseValue(card) > 0) {
						let temp = get.order(card);
						if (temp > max) {
							max = temp;
						}
					}
				});
				if (max > 0) {
					max += 0.3;
				}
				return max;
			},
			result: { player: 1 },
		},
	},
};

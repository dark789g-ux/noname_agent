import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xueji_old" | "oldhuxiao" | "oldwuji" | "xueji" | "huxiao" | "huxiao3" | "aocai" | "hongyuan">} */
export const groupSkills = {
	xueji_old: {
		audio: "xueji",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.hp < player.maxHp && player.countCards("he", { color: "red" }) > 0;
		},
		filterTarget(card, player, target) {
			return player != target && get.distance(player, target, "attack") <= 1;
		},
		selectTarget() {
			return [1, _status.event.player.maxHp - _status.event.player.hp];
		},
		position: "he",
		filterCard(card) {
			return get.color(card) == "red";
		},
		check(card) {
			return 8 - get.useful(card);
		},
		content() {
			"step 0";
			target.damage();
			"step 1";
			target.draw();
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					return get.damageEffect(target, player);
				},
			},
			threaten(player, target) {
				if (target.hp == 1) {
					return 2;
				}
				if (target.hp == 2) {
					return 1.5;
				}
				return 0.5;
			},
			maixie: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage")) {
						if (target.hp == target.maxHp && target.hasFriend()) {
							return [0, 1];
						}
					}
					if (get.tag(card, "recover") && player.hp >= player.maxHp - 1) {
						return [0, 0];
					}
				},
			},
		},
	},
	//FW关银屏
	oldhuxiao: {
		audio: "huxiao",
		trigger: { player: "shaMiss" },
		forced: true,
		content() {
			if (player.stat[player.stat.length - 1].card.sha > 0) {
				player.stat[player.stat.length - 1].card.sha--;
			}
		},
	},
	oldwuji: {
		audio: "wuji",
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return player.getStat("damage") >= 3;
		},
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "orange",
		content() {
			"step 0";
			player.removeSkills("oldhuxiao");
			player.gainMaxHp();
			"step 1";
			player.recover();
			player.awakenSkill(event.name);
		},
	},
	xueji: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("he", { color: "red" }) > 0;
		},
		filterTarget: true,
		selectTarget() {
			var player = _status.event.player;
			return [1, Math.max(1, player.getDamagedHp())];
		},
		position: "he",
		filterCard: { color: "red" },
		check(card) {
			return 8 - get.value(card);
		},
		multitarget: true,
		multiline: true,
		line: "fire",
		content() {
			"step 0";
			event.delay = false;
			for (var i = 0; i < targets.length; i++) {
				if (!targets[i].isLinked()) {
					targets[i].link(true);
					event.delay = true;
				}
			}
			"step 1";
			if (event.delay) {
				game.delay();
			}
			"step 2";
			targets[0].damage("fire", "nocard");
		},
		ai: {
			damage: true,
			fireAttack: true,
			threaten: 1.5,
			order: 7,
			result: {
				target(player, target) {
					var eff = get.damageEffect(target, player, target, "fire");
					if (target.isLinked()) {
						return eff / 10;
					} else {
						return eff;
					}
				},
			},
		},
	},
	huxiao: {
		audio: 2,
		trigger: { source: "damageSource" },
		forced: true,
		filter(event, player) {
			if (event._notrigger.includes(event.player) || !event.player.isIn()) {
				return false;
			}
			return event.hasNature("fire");
		},
		logTarget: "player",
		content() {
			if (!player.storage.huxiao3) {
				player.storage.huxiao3 = [];
			}
			player.storage.huxiao3.add(trigger.player);
			trigger.player.draw();
			player.addTempSkill("huxiao3");
		},
	},
	huxiao3: {
		onremove: true,
		mark: true,
		intro: {
			content: "players",
		},
		mod: {
			cardUsableTarget(card, player, target) {
				if (player.storage.huxiao3 && player.storage.huxiao3.includes(target)) {
					return true;
				}
			},
		},
	},
	//诸葛恪
	aocai: {
		audio: 2,
		audioname: ["gz_zhugeke"],
		enable: ["chooseToUse", "chooseToRespond"],
		hiddenCard(player, name) {
			if (player != _status.currentPhase && get.type(name) == "basic" && lib.inpile.includes(name)) {
				return true;
			}
		},
		filter(event, player) {
			if (event.responded || player == _status.currentPhase || event.aocai) {
				return false;
			}
			return lib.inpile.some(i => get.type(i) == "basic" && event.filterCard(get.autoViewAs({ name: i }, "unsure"), player, event));
		},
		delay: false,
		async content(event, trigger, player) {
			const evt = event.getParent(2);
			const cards = get.cards(get.mode() != "guozhan" && player.countCards("h") == 0 ? 4 : 2, true);
			const cardsx = cards.slice().map(card => {
				const cardx = ui.create.card();
				cardx.init(get.cardInfo(card));
				cardx._cardid = card.cardid;
				return cardx;
			});
			evt.set("aocai", true);
			player.directgains(cardsx, null, "aocai_hs");
			const result = await player
				.chooseCard(
					"傲才：选择要" + (evt.name == "chooseToUse" ? "使用" : "打出") + "的牌",
					(card, player) => {
						return get.event().cards.includes(card);
					},
					"s"
				)
				.set(
					"cards",
					cardsx.filter(card => {
						if (player.hasSkill("aozhan") && card.name == "tao") {
							return (
								evt.filterCard(
									{
										name: "sha",
										isCard: true,
										cards: [card],
									},
									evt.player,
									evt
								) ||
								evt.filterCard(
									{
										name: "shan",
										isCard: true,
										cards: [card],
									},
									evt.player,
									evt
								)
							);
						}
						return evt.filterCard(card, evt.player, evt);
					})
				)
				.set("ai", card => {
					if (get.type(card) == "equip") {
						return 0;
					}
					const evt = get.event().getParent(3),
						player = get.event().player;
					if (evt.type == "phase" && !player.hasValueTarget(card, null, true)) {
						return 0;
					}
					if (evt && evt.ai) {
						const tmp = _status.event;
						_status.event = evt;
						const result = (evt.ai || event.ai1)(card, player, evt);
						_status.event = tmp;
						return result;
					}
					return 1;
				})
				.forResult();
			let card;
			if (result.bool) {
				card = cards.find(card => card.cardid === result.cards[0]._cardid);
			}
			const cards2 = player.getCards("s", card => card.hasGaintag("aocai_hs"));
			if (player.isOnline2()) {
				player.send(
					(cards, player) => {
						cards.forEach(i => i.delete());
						if (player == game.me) {
							ui.updatehl();
						}
					},
					cards2,
					player
				);
			}
			cards2.forEach(i => i.delete());
			if (player == game.me) {
				ui.updatehl();
			}
			if (card) {
				let name = card.name,
					aozhan = player.hasSkill("aozhan") && name == "tao";
				if (aozhan) {
					name = evt.filterCard(
						{
							name: "sha",
							isCard: true,
							cards: [card],
						},
						evt.player,
						evt
					)
						? "sha"
						: "shan";
				}
				if (evt.name == "chooseToUse") {
					game.broadcastAll(
						(result, name) => {
							lib.skill.aocai_backup.viewAs = { name: name, cards: [result], isCard: true };
						},
						card,
						name
					);
					evt.set("_backupevent", "aocai_backup");
					evt.set("openskilldialog", "请选择" + get.translation(card) + "的目标");
					evt.backup("aocai_backup");
				} else {
					delete evt.result.used;
					delete evt.result.skill;
					evt.result.card = get.autoViewAs(card);
					if (aozhan) {
						evt.result.card.name = name;
					}
					evt.result.cards = [card];
					evt.redo();
					return;
				}
			}
			evt.goto(0);
		},
		ai: {
			effect: {
				target(card, player, target, effect) {
					if (get.tag(card, "respondShan")) {
						return 0.7;
					}
					if (get.tag(card, "respondSha")) {
						return 0.7;
					}
				},
			},
			order: 11,
			respondShan: true,
			respondSha: true,
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
			backup: {
				precontent() {
					var name = event.result.card.name,
						cards = event.result.card.cards.slice(0);
					event.result.cards = cards;
					var rcard = cards[0],
						card;
					if (rcard.name == name) {
						card = get.autoViewAs(rcard);
					} else {
						card = get.autoViewAs({ name, isCard: true });
					}
					event.result.card = card;
					event.result._apply_args = { addSkillCount: false };
				},
				filterCard: () => false,
				selectCard: -1,
				log: false,
			},
		},
	},
	hongyuan: {
		trigger: { player: "phaseDrawBegin2" },
		direct: true,
		audio: 2,
		filter(event, player) {
			return !event.numFixed && event.num > 0;
		},
		content() {
			"step 0";
			var check;
			if (player.countCards("h") == 0) {
				check = false;
			} else {
				check =
					game.countPlayer(function (current) {
						return player != current && get.attitude(player, current) > 1;
					}) >= 2;
			}
			if (get.is.versus()) {
				event.versus = true;
				player.chooseBool(get.prompt2("hongyuan")).ai = function () {
					return (
						game.countPlayer(function (current) {
							return player.side == current.side;
						}) > 2
					);
				};
			} else {
				player
					.chooseTarget(
						get.prompt2("hongyuan"),
						[1, 2],
						function (card, player, target) {
							return player != target;
						},
						function (target) {
							if (!_status.event.check) {
								return 0;
							}
							return get.attitude(_status.event.player, target);
						}
					)
					.set("check", check);
			}
			"step 1";
			if (result.bool) {
				var targets;
				if (event.versus) {
					targets = game.filterPlayer(function (current) {
						return current != player && current.side == player.side;
					});
				} else {
					targets = result.targets;
				}
				player.logSkill("hongyuan", targets);
				game.asyncDraw(targets);
				trigger.num--;
			}
		},
	},
};

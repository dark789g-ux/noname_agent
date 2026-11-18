import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dctongguan" | "dcmengjie">} */
export const groupSkills = {
	//赵直
	dctongguan: {
		audio: 2,
		trigger: {
			global: "phaseBegin",
		},
		filter(event, player) {
			return (
				event.player
					.getAllHistory()
					.filter(history => {
						return history.isMe && !history.isSkipped;
					})
					.indexOf(event.player.getHistory()) === 0 &&
				lib.skill.dctongguan.derivation.some(i => {
					return (player.getStorage("dctongguan")[i] || 0) < 2;
				})
			);
		},
		forced: true,
		locked: false,
		logTarget: "player",
		derivation: ["dctongguan_wuyong", "dctongguan_gangying", "dctongguan_duomou", "dctongguan_guojue", "dctongguan_renzhi"],
		content() {
			"step 0";
			var skills = lib.skill.dctongguan.derivation.slice();
			player
				.chooseControl(
					skills.filter(i => {
						return (player.getStorage("dctongguan")[i] || 0) < 2;
					})
				)
				.set(
					"choiceList",
					skills.map(i => {
						var info = "";
						switch (player.getStorage("dctongguan")[i]) {
							case 1:
								info = ' style="opacity:0.65;"';
								break;
							case 2:
								info = ' style="text-decoration:line-through; opacity:0.3;"';
								break;
						}
						return '<div class="skill">「' + get.translation(lib.translate[i + "_ab"] || get.translation(i).slice(0, 2)) + "」</div>" + "<div" + info + ">" + get.skillInfoTranslation(i, player, false) + "（已选过" + get.cnNumber(player.getStorage("dctongguan")[i] || 0) + "次）" + "</div>";
					})
				)
				.set("displayIndex", false)
				.set("prompt", "统观：为" + get.translation(trigger.player) + "选择一个属性")
				.set("ai", function () {
					var controls = _status.event.controls,
						target = _status.event.getTrigger().player;
					var str = target
						.getSkills(null, false, false)
						.map(i => get.skillInfoTranslation(i, null, false))
						.join("");
					var choices = [];
					if (controls.includes("dctongguan_wuyong") && /你对\S{1,15}造成\S{1,10}伤害/.test(str)) {
						choices.push("dctongguan_wuyong");
					}
					if (controls.includes("dctongguan_gangying") && /回复\S{1,5}体力/.test(str) && _status.event.player.getFriends().length) {
						choices.push("dctongguan_gangying");
					}
					if (controls.includes("dctongguan_duomou") && /你(可|可以)?摸\S{1,3}张牌/.test(str)) {
						choices.push("dctongguan_duomou");
					}
					if (controls.includes("dctongguan_guojue") && /(当【过河拆桥】使用|((弃置|获得)\S{1,5}其他角色\S{1,7}牌|))/.test(str)) {
						choices.push("dctongguan_guojue");
					}
					if (controls.includes("dctongguan_renzhi") && /交给\S{0,5}其他角色/.test(str) && _status.event.player.getFriends().length) {
						choices.push("dctongguan_renzhi");
					}
					if (choices.length) {
						return choices.randomGet();
					}
					return _status.event.controls.randomGet();
				});
			"step 1";
			if (result.control) {
				var skill = result.control;
				player.localMarkSkill(skill, trigger.player, event);
				// game.log(player,'为',trigger.player,'选择了','#g「'+get.translation(skill)+'」','属性');
				game.log(player, "为", trigger.player, "选择了", "#g一个属性");
				// player.popup(skill);
				trigger.player.addSkill(skill);
				if (!player.storage.dctongguan) {
					player.storage.dctongguan = {};
				}
				if (!player.storage.dctongguan[skill]) {
					player.storage.dctongguan[skill] = 0;
				}
				player.storage.dctongguan[skill]++;
			}
		},
		localMark(skill, player) {
			var name = skill,
				info;
			if (player.marks[name]) {
				player.updateMarks();
			}
			if (lib.skill[name]) {
				info = lib.skill[name].intro;
			}
			if (!info) {
				return;
			}
			if (player.marks[name]) {
				player.marks[name].info = info;
			} else {
				player.marks[name] = player.mark(name, info);
			}
			player.updateMarks();
		},
		ai: {
			combo: "dcmengjie",
		},
		subSkill: {
			forceFinish: { charlotte: true },
			wuyong: {
				marktext: "勇",
				intro: {
					name: "武勇",
					content: "属性目标：造成伤害",
				},
				charlotte: true,
				silent: true,
				nopop: true,
			},
			gangying: {
				marktext: "刚",
				intro: {
					name: "刚硬",
					content: "属性目标：回复体力，或手牌数大于体力值",
				},
				charlotte: true,
				silent: true,
				nopop: true,
			},
			duomou: {
				marktext: "谋",
				intro: {
					name: "多谋",
					content: "属性目标：于摸牌阶段外摸牌",
				},
				charlotte: true,
				silent: true,
				nopop: true,
			},
			guojue: {
				marktext: "决",
				intro: {
					name: "果决",
					content: "属性目标：弃置或获得其他角色牌",
				},
				charlotte: true,
				silent: true,
				nopop: true,
			},
			renzhi: {
				marktext: "仁",
				intro: {
					name: "仁智",
					content: "属性目标：交给其他角色牌",
				},
				charlotte: true,
				silent: true,
				nopop: true,
			},
		},
	},
	dcmengjie: {
		audio: 2,
		trigger: {
			global: "phaseEnd",
		},
		forced: true,
		direct: true,
		locked: false,
		filter(event, player) {
			var target = event.player;
			if (
				(target.hasSkill("dctongguan_gangying") &&
					(target.countCards("h") > target.hp ||
						game.getGlobalHistory("changeHp", function (evt) {
							return evt.player == target && (evt.getParent().name == "recover" || target.countCards("h") > target.hp);
						}).length > 0)) ||
				(target.hasSkill("dctongguan_wuyong") && target.getHistory("sourceDamage").length) ||
				(target.hasSkill("dctongguan_duomou") && target.getHistory("gain", evt => evt.getParent().name == "draw" && evt.getParent("phaseDraw").name != "phaseDraw").length)
			) {
				return true;
			}
			var guojue = false,
				renzhi = false;
			game.countPlayer2(current => {
				if (current == target) {
					return false;
				}
				if (
					!guojue &&
					current.hasHistory("lose", evt => {
						if (evt.type == "discard") {
							if ((evt.discarder || evt.getParent(2).player) != target) {
								return false;
							}
							if (!evt.getl(current).cards2.length) {
								return false;
							}
							return true;
						} else if (evt.type == "gain") {
							var evtx = evt.getParent();
							if (evtx.giver || evtx.getParent().name == "gift") {
								return false;
							}
							var cards = evtx.getg(target);
							if (!cards.length) {
								return false;
							}
							var cards2 = evtx.getl(current).cards2;
							for (var card of cards2) {
								if (cards.includes(card)) {
									return true;
								}
							}
						}
						return false;
					})
				) {
					guojue = true;
				}
				if (
					!renzhi &&
					current.hasHistory("gain", evt => {
						if (evt.giver != target || evt.getParent().name == "gift") {
							return false;
						}
						return evt.cards.length;
					})
				) {
					renzhi = true;
				}
			});
			return (target.hasSkill("dctongguan_guojue") && guojue) || (target.hasSkill("dctongguan_renzhi") && renzhi);
		},
		rules: [
			target => target.getHistory("sourceDamage").length,
			target =>
				target.countCards("h") > target.hp ||
				game.getGlobalHistory("changeHp", function (evt) {
					return evt.player == target && evt.getParent().name == "recover";
				}).length > 0 ||
				target.countCards("h") > target.hp,
			target => target.getHistory("gain", evt => evt.getParent().name == "draw" && evt.getParent("phaseDraw").name != "phaseDraw").length,
			(target, bool) => bool,
			(target, bool) => bool,
		],
		content() {
			"step 0";
			event.nowProperty = 0;
			var target = trigger.player;
			var guojue = false,
				renzhi = false;
			game.countPlayer2(current => {
				if (current == target) {
					return false;
				}
				if (
					!guojue &&
					current.hasHistory("lose", evt => {
						if (evt.type == "discard") {
							if ((evt.discarder || evt.getParent(2).player) != target) {
								return false;
							}
							if (!evt.getl(current).cards2.length) {
								return false;
							}
							return true;
						} else if (evt.type == "gain") {
							var evtx = evt.getParent();
							if (evtx.giver || evtx.getParent().name == "gift") {
								return false;
							}
							var cards = evtx.getg(target);
							if (!cards.length) {
								return false;
							}
							var cards2 = evtx.getl(current).cards2;
							for (var card of cards2) {
								if (cards.includes(card)) {
									return true;
								}
							}
						}
						return false;
					})
				) {
					guojue = true;
				}
				if (
					!renzhi &&
					current.hasHistory("gain", evt => {
						if (evt.giver != target || evt.getParent().name == "gift") {
							return false;
						}
						return evt.cards.length;
					})
				) {
					renzhi = true;
				}
			});
			event.guojue = guojue;
			event.renzhi = renzhi;
			"step 1";
			if (event.nowProperty >= 5) {
				event.finish();
				return;
			}
			var skills = lib.skill.dctongguan.derivation;
			if (trigger.player.hasSkill(skills[event.nowProperty]) && lib.skill.dcmengjie.rules[event.nowProperty](trigger.player, event[event.nowProperty == 3 ? "guojue" : "renzhi"])) {
				event.goto(2 + event.nowProperty * 2);
			} else {
				event.redo();
			}
			event.nowProperty++;
			"step 2";
			if (!game.hasPlayer(current => current != player)) {
				event._result = { bool: false };
			} else {
				player.chooseTarget("梦解：对一名其他角色造成1点伤害", true, lib.filter.notMe).set("ai", target => get.damageEffect(target, player, player));
			}
			"step 3";
			if (result.bool) {
				player.logSkill("dcmengjie", result.targets[0]);
				result.targets[0].damage();
			}
			game.delayx();
			event.goto(1);
			"step 4";
			if (game.hasPlayer(target => target != player && target.isDamaged())) {
				player
					.chooseTarget("梦解：令一名角色回复1点体力", function (card, player, target) {
						return target.isDamaged();
					})
					.set("ai", target => get.recoverEffect(target, player, player));
			} else {
				event._result = { bool: false };
			}
			"step 5";
			if (result.bool) {
				player.logSkill("dcmengjie", result.targets[0]);
				result.targets[0].recover();
			}
			game.delayx();
			event.goto(1);
			"step 6";
			player.logSkill("dcmengjie");
			player.draw(2);
			"step 7";
			game.delayx();
			event.goto(1);
			"step 8";
			if (game.hasPlayer(target => target.countDiscardableCards(player, "hej"))) {
				player
					.chooseTarget("梦解：弃置一名角色区域内至多两张牌", true, (card, player, target) => {
						return target.countDiscardableCards(player, "hej");
					})
					.set("ai", target => get.effect(target, { name: "guohe" }, player, player));
			} else {
				event._result = { bool: false };
			}
			"step 9";
			if (result.bool) {
				player.logSkill("dcmengjie", result.targets[0]);
				player.discardPlayerCard(result.targets[0], true, "hej", [1, 2]);
			}
			game.delayx();
			event.goto(1);
			"step 10";
			if (!game.hasPlayer(current => current != player)) {
				event._result = { bool: false };
			} else {
				player
					.chooseTarget("梦解：令一名其他角色将手牌补至上限", true, (card, player, target) => {
						return target != player;
					})
					.set("ai", target => {
						var att = get.attitude(_status.event.player, target);
						if (target.hasSkillTag("nogain")) {
							att /= 6;
						}
						if (att > 2) {
							return Math.min(5, target.maxHp) - target.countCards("h");
						}
						return att / 3;
					});
			}
			"step 11";
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("dcmengjie", target);
				var num = Math.min(5, target.maxHp - target.countCards("h"));
				target.draw(num);
			}
			game.delayx();
			event.goto(1);
		},
		ai: {
			combo: "dctongguan",
		},
	},
};

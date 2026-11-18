import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olguifu" | "olmoubian" | "olzhouxi" | "olrumo">} */
export const groupSkills = {
	//魔司马懿 —— by 星の语
	//舍身入魔，佛奈我何！
	olguifu: {
		audio: 2,
		trigger: {
			global: "roundStart",
			player: "changeHpAfter",
		},
		filter(event, player) {
			return event.name != "changeHp" || event.changedHp != 0;
		},
		check: () => true,
		frequent: true,
		prompt2: "随机从牌堆或弃牌堆获得一张不计入手牌上限的【闪】",
		async content(event, trigger, player) {
			const card = get.cardPile("shan", null, "random");
			if (!card) {
				player.chat("桀桀桀，居然没闪了吗");
				return;
			}
			const next = player.gain(card, "gain2");
			next.gaintag.add(event.name);
			await next;
		},
		group: ["olguifu_viewAs", "olguifu_record"],
		locked: false,
		mod: {
			ignoredHandcard(card, player) {
				if (card.hasGaintag("olguifu")) {
					return true;
				}
			},
			cardDiscardable(card, player, name) {
				if (name == "phaseDiscard" && card.hasGaintag("olguifu")) {
					return false;
				}
			},
			cardUsable(card, player) {
				if (card.storage?.olguifu_viewAs) {
					return Infinity;
				}
			},
		},
		subSkill: {
			viewAs: {
				enable: "chooseToUse",
				hiddenCard(player, name) {
					if (player.storage.olguifu_record?.card?.includes(name) && !player.getStorage("olguifu_used").includes(name) && player.hasCard(card => card.hasGaintag("olguifu"), "h")) {
						return true;
					}
				},
				filter(event, player) {
					const names = (player.storage.olguifu_record?.card || []).slice(0).removeArray(player.getStorage("olguifu_used"));
					return player.hasCard(card => card.hasGaintag("olguifu"), "h") && names.some(name => event.filterCard(get.autoViewAs({ name: name, storage: { olguifu_viewAs: true } }, "unsure"), player, event));
				},
				chooseButton: {
					dialog(event, player) {
						const list = [];
						for (const name of player.storage.olguifu_record.card) {
							list.push([get.type(name), "", name]);
							//if (name == "sha") {
							//	for (const nature of lib.inpile_nature) {
							//		list.push([get.type(name), "", name, nature]);
							//	}
							//}
						}
						return ui.create.dialog("诡伏", [list, "vcard"], "hidden");
					},
					filter(button, player) {
						if (player.getStorage("olguifu_used").includes(button.link[2])) {
							return false;
						}
						return get
							.event()
							.getParent()
							.filterCard(get.autoViewAs({ name: button.link[2], nature: button.link[3], storage: { olguifu_viewAs: true } }, "unsure"), player, get.event().getParent());
					},
					check(button) {
						return get.player().getUseValue(get.autoViewAs({ name: button.link[2], nature: button.link[3] }, "unsure"));
					},
					backup(links, player) {
						return {
							audio: "olguifu",
							filterCard(card, player) {
								return get.itemtype(card) == "card" && card.hasGaintag("olguifu");
							},
							viewAs: {
								name: links[0][2],
								nature: links[0][3],
								storage: {
									olguifu_viewAs: true,
								},
							},
							position: "h",
							check(card) {
								return 8 - get.value(card);
							},
							log: false,
							precontent() {
								const skill = "olguifu",
									card = event.result.card;
								player.logSkill(skill);
								player.addTempSkill(skill + "_used");
								player.markAuto(skill + "_used", card.name);
								event.getParent().addCount = false;
							},
						};
					},
					prompt(links, player) {
						const name = links[0][2],
							nature = links[0][3];
						return "将一张「诡伏」牌当作" + (get.translation(nature) || "") + get.translation(name) + "使用";
					},
				},
				ai: {
					order: 7,
					result: {
						player: 1,
					},
				},
			},
			used: {
				charlotte: true,
				onremove: true,
				intro: { content: "已转化过$" },
			},
			record: {
				audio: "olguifu",
				init(player, skill) {
					player.storage[skill] = { card: [], skill: [] };
				},
				trigger: { global: "damageSource" },
				filter(event, player) {
					const storage = player.storage.olguifu_record;
					if (event.card?.name) {
						return !storage.card.includes(event.card.name);
					}
					const skill = game.findSkill(event);
					return skill && !storage.skill.includes(skill);
				},
				forced: true,
				locked: false,
				content() {
					let storage = player.storage[event.name];
					const skill = game.findSkill(trigger);
					if (trigger.card) {
						storage["card"].add(trigger.card.name);
					} else if (skill) {
						storage["skill"].add(skill);
					}
					player.markSkill(event.name);
				},
				intro: {
					markcount(storage, player) {
						if (!storage) {
							return "当前暂无记录";
						}
						return Object.values(storage).flat().length;
					},
					content(storage, player) {
						if (!storage) {
							return "当前暂无记录";
						}
						const cards = storage["card"],
							skills = storage["skill"];
						let str = "";
						if (cards.length) {
							str += `<li>记录的牌：${cards.map(card => get.poptip(card)).join("、")}<br>`;
						}
						if (skills.length) {
							str += `<li>记录的技能：${skills.map(skill => get.poptip(skill)).join("、")}`;
						}
						if (!str) {
							return "无记录的牌或技能";
						}
						return str;
					},
				},
				onremove: true,
			},
		},
	},
	olmoubian: {
		audio: 4,
		derivation: ["olzhouxi"],
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			const storage = player.storage.olguifu_record;
			if (!storage) {
				return false;
			}
			return Object.values(storage).flat().length >= 3 && !player.hasSkill("olrumo");
		},
		skillAnimation: "epic",
		animationColor: "thunder",
		check: () => true,
		async content(event, trigger, player) {
			player.addSkill("olrumo");
			const skills = player.storage.olguifu_record?.skill;
			if (skills?.length) {
				await player.addSkills(skills);
			}
			await player.addSkills(["olzhouxi"]);
		},
		ai: {
			combo: "olguifu",
		},
	},
	olzhouxi: {
		audio: 2,
		damageSkills: ["oljuece", "reganglie", "nzry_kuizhu", "zhefu", "tianjie", "xinleiji", "zhendu", "olqiangxi", "duwu", "olsanyao", "oljianhe", "clanlieshi", "xueji", "quhu", "olshuzi"],
		initList() {
			//先用许劭评鉴那个函数初始化一下角色列表
			if (!_status.characterlist) {
				game.initCharacterList();
			}
			//获取各个角色的技能并去重
			const skills = _status.characterlist
				.map(i => get.character(i, 3))
				.flat()
				.unique();
			//展开技能
			game.expandSkills(skills, true);
			const list = [];
			//筛选技能
			for (let skill of skills) {
				let info = get.info(skill);
				//获取技能的内容，后者是一些主动技会用到的内容
				info = info.content || info.chooseButton?.backup;
				//将内容转为字符串
				const str = info?.toString();
				//检测是否包含“.damage(”子串，即造成伤害的函数
				if (str?.includes(".damage(")) {
					skill = get.sourceSkillFor(skill);
					info = get.info(skill);
					//双重检测，如果技能描述中不带伤害字样的去除
					if (!skill || !get.skillInfoTranslation(skill).includes("伤害")) {
						continue;
					}
					//去除觉醒技、隐匿技、势力技、主公技
					if (!info || info.silent || info.juexingji || info.hiddenSkill || info.groupSkill || info.zhuSkill) {
						continue;
					}
					//去除有联动的技能和负面技能
					if (info.ai && (info.ai.combo || info.ai.notemp || info.ai.neg)) {
						continue;
					}
					list.add(skill);
				}
			}
			//最后用全局变量存储，就不需要反复执行这个函数了
			_status.damageSkills = list;
		},
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			if (!_status.damageSkills) {
				lib.skill.olzhouxi.initList();
			}
			const skills = _status.damageSkills.filter(skill => !player.hasSkill(skill, null, null, false)).randomGets(3);
			/*const skills = get
				.info(event.name)
				.damageSkills
				.filter(skill => !player.hasSkill(skill))
				.randomGets(3);*/
			if (!skills.length) {
				return;
			}
			const result = await player
				.chooseButton([`###${get.translation(event.name)}###你从三个可造成伤害的技能中选择一个获得直到你的下回合开始。`, [skills, "skill"]], true)
				.set("ai", () => 1 + Math.random())
				.forResult();
			if (!result?.links) {
				return;
			}
			const skill = result.links[0];
			await player.addTempSkills(skill, { player: "phaseBegin" });
		},
		group: ["olzhouxi_tiaoxin"],
		subSkill: {
			tiaoxin: {
				audio: "olzhouxi",
				trigger: { global: "roundEnd" },
				filter(event, player) {
					return lib.skill.olzhouxi_tiaoxin.logTarget(event, player).length > 0;
				},
				forced: true,
				logTarget(event, player) {
					return player
						.getRoundHistory("sourceDamage", evt => evt.num > 0)
						?.map(evt => evt.player)
						.unique()
						.filter(target => target.isIn() && target.canUse({ name: "sha", isCard: true }, player, false, false))
						.sortBySeat();
				},
				async content(event, trigger, player) {
					const targets = lib.skill.olzhouxi_tiaoxin.logTarget(trigger, player);
					if (!targets.length) {
						return;
					}
					const card = get.autoViewAs({ name: "sha", isCard: true });
					for (const target of targets) {
						if (target.canUse(card, player, false, false)) {
							await target.useCard(card, player, false);
						}
					}
				},
			},
		},
	},
	olrumo: {
		charlotte: true,
		trigger: { global: "roundEnd" },
		filter(event, player) {
			return !player.getRoundHistory("sourceDamage", evt => evt.num > 0).length;
		},
		forced: true,
		popup: false,
		content() {
			player.loseHp();
		},
		nopop: true,
		mark: true,
		marktext: "魔",
		intro: { content: "你已入魔" },
	},
};

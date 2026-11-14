import { _status, game, get, lib, ui, ai } from "noname";
import { GameEvent, initializeEvent, type RawGameDrawEvent } from "../gameEvent.js";
import { Player } from "../player.js";
import type { LegacyChooseButtonCreateDialog } from "../Player/legacyParams";
import { delay } from "@/util/index.js";
import { tryLLMDecide } from "@/llm/index.js";
import { forwardEventLogSkill, getLogSkillName } from "../GameEvent/logSkill.js";
import { getButtonSubtypes } from "../GameEvent/buttonSubtypes.js";
import { isImportModePayload, isSelectionResultObject as isBoundarySelectionResultObject, normalizeSelectionResult as normalizeBoundarySelectionResult, type SelectionResultRuntime } from "../GameEvent/resultBoundary.js";
import { getRegisteredSkill, requireRegisteredSkill } from "../../skillRegistry.js";
import { isRecord, isAIResult, isSelectionResultObject, normalizeSelectionResult, isCardLinks, isVCardLinks, isCardMatrix, normalizeChooseButtonTargetResult, applyLLMDecision, attachChooseButtonSelectionSpec } from "./selectionResults.js";

export const dieContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
	die: [
		async (event, trigger, player) => {
			const { reason, source } = event;
			event.forceDie = true;
			//只有真正死亡才会影响每轮起始的角色（注意：不是每个模式都有这个属性，只有个别几个模式有，身份22斗地主都是判断的onround来决定是否进入下一轮）
			if (_status.roundStart == player && !event.reserveOut) {
				_status.roundStart = player.next || player.getNext() || game.players[0];
			}
			if (ui.land && ui.land.player == player) {
				game.addVideo("destroyLand");
				ui.land.destroy();
			}
			//因为隐匿等原因看不到武将牌的需要展示出来
			let unseen = false;
			if (player.classList.contains("unseen")) {
				player.classList.remove("unseen");
				unseen = true;
			}
			//加载侧边的历史记录栏关于这次死亡事件的信息
			const logvid = game.logv(player, "die", source || undefined);
			event.logvid = logvid?.logvid;
			if (unseen) {
				player.classList.add("unseen");
			}
			if (source) {
				game.log(player, "被", source, "杀害");
				const stat = source.stat[source.stat.length - 1];
				if (stat) {
					if (stat.kill == undefined) {
						stat.kill = 1;
					} else {
						stat.kill++;
					}
				}
			} else {
				game.log(player, "阵亡");
			}

			/*player.removeEquipTrigger();
			for (const i in lib.skill.globalmap) {
				if (lib.skill.globalmap[i].includes(player)) {
					lib.skill.globalmap[i].remove(player);
					if (lib.skill.globalmap[i].length == 0 && !lib.skill[i].globalFixed) {
						game.removeGlobalSkill(i);
					}
				}
			}*/
			game.broadcastAll(player => {
				player.classList.add("dead");
				player.removeLink();
				player.classList.remove("turnedover");
				player.classList.remove("out");
				player.node.count.innerHTML = "0";
				player.node.hp.hide();
				player.node.equips.hide();
				player.node.count.hide();
				player.previous.next = player.next;
				player.next.previous = player.previous;
				game.players.remove(player);
				game.dead.push(player);
				_status.dying.remove(player);
			}, player);

			//是否播放阵亡语音
			if (!event.noDieAudio) {
				game.tryDieAudio(player);
			}
			//添加死亡动画（包括录像的）
			if (!event.reserveOut) {
				game.addVideo("diex", player);
				if (event.animate !== false) {
					player.$die();
				}
			}
			//将体力值修改为0
			/*if (event.reserveOut && !game.countPlayer()) {
				game.over();
			} else */
			if (player.hp != 0) {
				await player.changeHp(0 - Number(player.hp), false).set("forceDie", true);
			}
		},
		async (event, trigger, player) => {
			const { source } = event;
			//是否执行展示身份牌和胜负判断的操作
			if (player.dieAfter && !event.reserveOut && !event.noDieAfter) {
				await player.dieAfter(source);
			}
		},
		async (event, trigger, player) => {
			game.callHook("checkDie", [event, player]);
			await event.trigger("die");
		},
		async (event, trigger, player) => {
			const { reason, source } = event;
			if (player.isDead()) {
				// || event.reserveOut
				//死亡移除武将牌的标记显示，有些不想移除的可以放进excludeMark排除（比如十常侍的常侍标记）
				if (!game.reserveDead) {
					const exclude = event.excludeMark;
					for (const mark in player.marks) {
						if (exclude.includes(mark)) {
							continue;
						}
						player.unmarkSkill(mark);
					}
					let count = 1;
					const list = Array.from(player.node.marks.childNodes);
					count += exclude.filter(name => list.some(i => "name" in i && i.name == name)).length;
					const func = (player, count, exclude) => {
						while (player.node.marks.childNodes.length > count) {
							let node = player.node.marks.lastChild;
							if (exclude.includes(node.name)) {
								node = node.previousSibling;
							}
							node.remove();
						}
					};
					func(player, count, exclude);
					game.broadcast(
						(func, player, count, exclude) => {
							func(player, count, exclude);
						},
						func,
						player,
						count,
						exclude
					);
					player.removeTip();
				}
				//移除临时技能
				for (const i in player.tempSkills) {
					player.removeSkill(i);
				}
				const skills = player.getSkills();
				for (const skill of skills) {
					if (requireRegisteredSkill(lib.skill, skill).temp) {
						player.removeSkill(skill);
					}
				}
				//武将牌返回武将牌堆
				if (_status.characterlist && !event.reserveOut) {
					if (lib.character[String(player.name)]) {
						const name = player.name;
						if (name === undefined) throw new TypeError("Returning a character requires an initialized name");
						if (!name.startsWith("gz_shibing") && !name.startsWith("gz_jun_")) _status.characterlist.add(player.name);
					}
					if (lib.character[String(player.name1)]) {
						const name1 = player.name1;
						if (name1 === undefined) throw new TypeError("Returning a character requires an initialized primary name");
						if (!name1.startsWith("gz_shibing") && !name1.startsWith("gz_jun_")) _status.characterlist.add(player.name1);
					}
					const name2 = player.name2;
					if (name2 && lib.character[name2] && !name2.startsWith("gz_shibing") && !name2.startsWith("gz_jun_")) {
						_status.characterlist.add(name2);
					}
				}
				//死亡弃置所有牌包括s和x区域的
				event.cards = player.getCards("hejsx");
				if (event.cards.length) {
					await player.discard(event.cards).set("forceDie", true);
					//player.$throw(event.cards,1000);
				}
			}
		},
		async (event, trigger, player) => {
			const { source } = event;
			//是否执行击杀奖惩的操作
			if (player.dieAfter2 && !event.reserveOut && !event.noDieAfter2) {
				await player.dieAfter2(source);
			}
		},
		async (event, trigger, player) => {
			const { reason, source } = event;
			if (!event.reserveOut) {
				//真正的死亡才会显示再战那些按钮，以及隐藏一些按钮什么的
				game.broadcastAll(player => {
					if (game.online && player == game.me && !_status.over && !game.controlOver && !ui.exit) {
						if (lib.mode[lib.configOL.mode].config.dierestart) {
							ui.create.exit();
						}
					}
				}, player);
				if (!_status.connectMode && player == game.me && !_status.over && !game.controlOver) {
					ui.control.show();
					if (get.config("revive") && lib.mode[lib.config.mode].config.revive && !ui.revive) {
						ui.revive = ui.create.control("revive", ui.click.dierevive);
					}
					if (get.config("continue_game") && !ui.continue_game && lib.mode[lib.config.mode].config.continue_game && !_status.brawl && !game.no_continue_game) {
						ui.continue_game = ui.create.control("再战", game.reloadCurrent);
					}
					if (get.config("dierestart") && lib.mode[lib.config.mode].config.dierestart && !ui.restart) {
						ui.restart = ui.create.control("restart", game.reload);
					}
				}

				if (!_status.connectMode && player == game.me && !game.modeSwapPlayer) {
					// _status.auto=false;
					if (ui.auto) {
						// ui.auto.classList.remove('glow');
						ui.auto.hide();
					}
					if (ui.wuxie) {
						ui.wuxie.hide();
					}
				}

				if (typeof _status.coin == "number" && source && !_status.auto) {
					if (source == game.me || source.isUnderControl()) {
						_status.coin += 10;
					}
				}
			}
			if (source && lib.config.border_style == "auto" && (lib.config.autoborder_count == "kill" || lib.config.autoborder_count == "mix")) {
				switch (source.node.framebg.dataset.auto) {
					case "gold":
					case "silver":
						source.node.framebg.dataset.auto = "gold";
						break;
					case "bronze":
						source.node.framebg.dataset.auto = "silver";
						break;
					default:
						source.node.framebg.dataset.auto = lib.config.autoborder_start || "bronze";
				}
				if (lib.config.autoborder_count == "kill") {
					source.node.framebg.dataset.decoration = source.node.framebg.dataset.auto;
				} else {
					let dnum = 0;
					for (const stat of source.stat) {
						if (stat.damage != undefined) {
							dnum += stat.damage;
						}
					}
					source.node.framebg.dataset.decoration = "";
					switch (source.node.framebg.dataset.auto) {
						case "bronze":
							if (dnum >= 4) {
								source.node.framebg.dataset.decoration = "bronze";
							}
							break;
						case "silver":
							if (dnum >= 8) {
								source.node.framebg.dataset.decoration = "silver";
							}
							break;
						case "gold":
							if (dnum >= 12) {
								source.node.framebg.dataset.decoration = "gold";
							}
							break;
					}
				}
				source.classList.add("topcount");
			}
		},
	],
	//进入休整状态
	async rest(event, trigger, player) {
		const { type = "phase", count = -1 } = event.restMap; //, audio
		const playerid = player.playerid;
		if (typeof playerid !== "string" || _status._rest_return?.[playerid]) {
			return;
		}
		/*if (audio) {
			game.broadcastAll(audio => {
				if (lib.config.background_speak) {
					game.playAudio("die", audio);
				}
			}, audio);
		}*/

		game.log(player, "进入了修整状态");
		player.classList.remove("dead");
		game.dead.remove(player);
		game.players.add(player);
		game.arrangePlayers();
		game.broadcastAll(
			(id, type, count) => {
				if (typeof id !== "string") {
					return;
				}
				_status._rest_return ??= {};
				_status._rest_return[id] = {
					type: type,
					count: count,
				};
			},
			playerid,
			type,
			count
		);
		player.markSkill("_rest_return");

		game.log(player, "移出了游戏");
		game.broadcastAll(player => {
			player.classList.add("out");
		}, player);
		player.addSkill("undist");

		await event.trigger("rest");
	},
	//结束休整状态
	async restEnd(event, trigger, player) {
		const { hp = player.maxHp } = event.restEndMap; //, audio
		const playerid = player.playerid;
		if (typeof playerid !== "string" || !_status._rest_return?.[playerid]) {
			return;
		}
		/*if (typeof audio == "string") {
			game.broadcastAll(audio => {
				if (lib.config.background_speak) {
					game.playAudio("die", audio);
				}
			}, audio);
		}*/

		game.log(player, "结束了休整");
		game.broadcastAll(id => {
			if (typeof id === "string" && _status._rest_return) {
				delete _status._rest_return[id];
			}
		}, playerid);
		player.unmarkSkill("_rest_return");

		game.log(player, "移回了游戏");
		game.broadcastAll(player => {
			player.classList.remove("out");
		}, player);
		player.removeSkill("undist");

		await player.reviveEvent(hp, false);
		await event.trigger("restEnd");
	},
	//复活事件
	async revive(event, trigger, player) {
		const { hp, log } = event;
		if (log !== false) {
			game.log(player, "复活");
		}
		game.broadcastAll(
			(player, hp) => {
				if (Number(player.maxHp) < 1) {
					player.maxHp = 1;
				}
				player.hp = hp;
				game.addVideo("revive", player);
				player.classList.remove("dead");
				player.removeAttribute("style");
				player.node.avatar.style.transform = "";
				player.node.avatar2.style.transform = "";
				player.node.hp.show();
				player.node.equips.show();
				player.node.count.show();
				player.update();
				let playerx;
				playerx = player.previousSeat;
				while (playerx.isDead()) {
					playerx = playerx.previousSeat;
				}
				playerx.next = player;
				player.previous = playerx;
				playerx = player.nextSeat;
				while (playerx.isDead()) {
					playerx = playerx.nextSeat;
				}
				playerx.previous = player;
				player.next = playerx;
				game.players.add(player);
				game.dead.remove(player);
				if (player == game.me) {
					if (ui.auto) {
						ui.auto.show();
					}
					if (ui.wuxie) {
						ui.wuxie.show();
					}
					if (ui.revive) {
						ui.revive.close();
						delete ui.revive;
					}
					if (ui.exit) {
						ui.exit.close();
						delete ui.exit;
					}
					if (ui.swap) {
						ui.swap.close();
						delete ui.swap;
					}
					if (ui.restart) {
						ui.restart.close();
						delete ui.restart;
					}
					if (ui.continue_game) {
						ui.continue_game.close();
						delete ui.continue_game;
					}
					if (player.node.dieidentity) {
						player.node.dieidentity.delete();
						delete player.node.dieidentity;
					}
				}
			},
			player,
			hp
		);
	},
};

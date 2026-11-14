/* eslint-disable no-var, prefer-rest-params -- 保留原实现的函数作用域及 arguments 协议。 */
import { ai } from "noname";
import { get } from "noname";
import { game } from "noname";
import { _status } from "noname";
import { ui } from "noname";
import { lib } from "noname";

export function createYingbian() {
	return {
		condition: {
			color: new Map([
				["zhuzhan", "wood"],
				["kongchao", "soil"],
				["fujia", "orange"],
				["canqu", "fire"],
				["force", "metal"],
			]),
			complex: new Map([
				[
					"zhuzhan",
					function (evt) {
						const yingbianZhuzhan = game.createEvent("yingbianZhuzhan");
						yingbianZhuzhan.player = evt.player;
						yingbianZhuzhan.card = evt.card;
						yingbianZhuzhan._trigger = evt;
						yingbianZhuzhan.yingbianZhuzhanAI = evt.yingbianZhuzhanAI;
						yingbianZhuzhan.afterYingbianZhuzhan = evt.afterYingbianZhuzhan;
						yingbianZhuzhan.setContent([
							async event => {
								event._global_waiting = true;
								event.send = (player, card, source, targets, id, id2, yingbianZhuzhanAI, skillState) => {
									if (skillState) {
										player.applySkills(skillState);
									}
									var type = get.type2(card),
										str = get.translation(source);
									if (targets && targets.length) {
										str += `对${get.translation(targets)}`;
									}
									str += `使用了${get.translation(card)}，是否弃置一张${get.translation(type)}为其助战？`;
									player.chooseCard({
										filterCard: (card, player) => get.type2(card) == type && lib.filter.cardDiscardable(card, player),
										prompt: str,
										position: "h",
										_global_waiting: true,
										id: id,
										id2: id2,
										ai:
											typeof yingbianZhuzhanAI == "function"
												? yingbianZhuzhanAI(player, card, source, targets)
												: cardx => {
														var info = get.info(card);
														if (info && info.ai && info.ai.yingbian) {
															var ai = info.ai.yingbian(card, source, targets, player);
															if (!ai) {
																return 0;
															}
															return ai - get.value(cardx);
														} else if (get.attitude(player, source) <= 0) {
															return 0;
														}
														return 5 - get.value(cardx);
													},
									});
									if (!game.online) {
										return;
									}
									_status.event._resultid = id;
									game.resume();
								};
							},
							async (event, trigger, player) => {
								var type = get.type2(event.card);
								event.list = game.filterPlayer(current => current != player && current.countCards("h") > 0 && (_status.connectMode || current.hasCard(cardx => get.type2(cardx) == type, "h"))).sortBySeat(_status.currentPhase || player);
								event.id = get.id();
							},
							async (event, trigger, player) => {
								if (!event.list.length) {
									event.finish();
								} else if (_status.connectMode && (event.list[0].isOnline() || event.list[0] == game.me)) {
									event.goto(4);
								} else {
									event.send((event.current = event.list.shift()), event.card, player, trigger.targets, event.id, trigger.parent.id, trigger.yingbianZhuzhanAI);
								}
							},
							async event => {
								if (event._result.bool) {
									event.zhuzhanresult = event.current;
									event.zhuzhanresult2 = event._result;
									if (event.current != game.me) {
										game.delayx();
									}
									event.goto(8);
								} else {
									event.goto(2);
								}
							},
							async (event, trigger, player) => {
								var id = event.id,
									sendback = (result, player) => {
										if (result && result.id == id && !event.zhuzhanresult && result.bool) {
											event.zhuzhanresult = player;
											event.zhuzhanresult2 = result;
											game.broadcast("cancel", id);
											if (_status.event.id == id && _status.event.name == "chooseCard" && _status.paused) {
												return () => {
													event.resultOL = _status.event.resultOL;
													ui.click.cancel();
													if (ui.confirm) {
														ui.confirm.close();
													}
												};
											}
										} else if (_status.event.id == id && _status.event.name == "chooseCard" && _status.paused) {
											return () => (event.resultOL = _status.event.resultOL);
										}
									},
									withme = false,
									withol = false,
									list = event.list;
								for (var i = 0; i < list.length; i++) {
									var current = list[i];
									if (current.isOnline()) {
										withol = true;
										current.wait(sendback);
										current.send(event.send, current, event.card, player, trigger.targets, event.id, trigger.parent.id, trigger.yingbianZhuzhanAI, get.skillState(current));
										list.splice(i--, 1);
									} else if (current == game.me) {
										withme = true;
										event.send(current, event.card, player, trigger.targets, event.id, trigger.parent.id, trigger.yingbianZhuzhanAI);
										list.splice(i--, 1);
									}
								}
								if (!withme) {
									event.goto(6);
								}
								if (_status.connectMode && (withme || withol)) {
									game.players.forEach(value => {
										if (value != player) {
											value.showTimer();
										}
									});
								}
								event.withol = withol;
							},
							async event => {
								if (!event._result || !event._result.bool || event.zhuzhanresult) {
									return;
								}
								game.broadcast("cancel", event.id);
								event.zhuzhanresult = game.me;
								event.zhuzhanresult2 = event._result;
							},
							async event => {
								if (event.withol && !event.resultOL) {
									game.pause();
								}
							},
							async event => {
								game.players.forEach(value => value.hideTimer());
							},
							async (event, trigger, player) => {
								if (event.zhuzhanresult) {
									var target = event.zhuzhanresult;
									target.line(player, "green");
									target.modedDiscard(event.zhuzhanresult2.cards);
									if (typeof event.afterYingbianZhuzhan == "function") {
										event.afterYingbianZhuzhan(event, trigger);
									}
									var yingbianCondition = event.name.slice(8).toLowerCase(),
										yingbianConditionTag = `yingbian_${yingbianCondition}_tag`;
									target.popup(yingbianConditionTag, lib.yingbian.condition.color.get(yingbianCondition));
									game.log(target, "响应了", player, "发起的", yingbianConditionTag);
									target.addExpose(0.2);
									event.result = {
										bool: true,
									};
								} else {
									event.result = {
										bool: false,
									};
								}
							},
						]);
						yingbianZhuzhan._args = Array.from(arguments);
						return yingbianZhuzhan;
					},
				],
			]),
			simple: new Map([
				["kongchao", event => !event.player.countCards("h")],
				["fujia", event => event.player.isMaxHandcard()],
				["canqu", event => event.player.getHp() == 1],
			]),
		},
		effect: new Map([
			[
				"add",
				(event, trigger, player) => {
					trigger.yingbian_addTarget = true;
				},
			],
			[
				"remove",
				(event, trigger, player) => {
					trigger.yingbian_removeTarget = true;
				},
			],
			[
				"damage",
				(event, trigger, player) => {
					if (typeof trigger.baseDamage != "number") {
						trigger.baseDamage = 1;
					}
					trigger.baseDamage++;
					game.log(event.card, "的伤害值基数+1");
				},
			],
			[
				"draw",
				(event, trigger, player) => {
					player.draw();
				},
			],
			[
				"gain",
				(event, trigger, player) => {
					const cardx = trigger.respondTo;
					if (cardx && cardx[1] && cardx[1].cards && cardx[1].cards.filterInD("od").length) {
						player.gain(cardx[1].cards.filterInD("od"), "gain2");
					}
				},
			],
			[
				"hit",
				(event, trigger, player) => {
					trigger.directHit.addArray(game.players).addArray(game.dead);
					game.log(event.card, "不可被响应");
				},
			],
			[
				"all",
				(event, trigger, player) => {
					event.card.yingbian_all = true;
					game.log(event.card, "执行所有选项");
				},
			],
		]),
		prompt: new Map([
			["add", "目标+1"],
			["remove", "目标-1"],
			["damage", "伤害+1"],
			["draw", "摸一张牌"],
			["gain", "获得响应的牌"],
			["hit", "此牌不可被响应"],
			["all", "无视条件执行所有选项"],
		]),
	};
}

import type { IdentityPlayerAI } from "../runtimeTypes.js";
import html from "dedent";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";

export function createIdentityPlayerActions() {
	return {
		/**
		 * 洞察一名角色的阵营（友方/敌方）
		 *
		 * @this {Player}
		 * @param {Player} target
		 * @returns {GameEvent}
		 */
		insightInto(this: Player, target) {
			const next = game.createEvent("stratagemInsight");
			next.player = this;
			next.target = target;
			next.setContent("stratagemInsight");
			return next;
		},

		/**
		 * 增加暴露值
		 *
		 * 暴露值越高，AI越容易透视身份
		 *
		 * @this {Player}
		 * @param {number} num - 添加的暴露值；暴露值最大不超过0.95
		 * @returns {Player}
		 */
		addExpose(this: Player, num) {
			if (!game.zhu || !game.zhu.isZhu || !game.zhu.identityShown) {
				return this;
			}
			if (typeof (this.ai as IdentityPlayerAI).shown == "number" && !this.identityShown && (this.ai as IdentityPlayerAI).shown < 1) {
				(this.ai as IdentityPlayerAI).shown += num;
				if ((this.ai as IdentityPlayerAI).shown > 0.95) {
					(this.ai as IdentityPlayerAI).shown = 0.95;
				}
			}
			return this;
		},

		/**
		 * 3v3v2模型展示野心
		 *
		 * @this {Player}
		 */
		async yexinbilu(this: Player) {
			game.broadcastAll(player => {
				player.showIdentity();
			}, this);
			await this.gainMaxHp();
			await this.recover();
		},

		/**
		 * 在角色死亡后创建并同步死亡身份标记。
		 *
		 * @this { Player }
		 * @returns { void }
		 */
		$dieAfter(this: Player) {
			if (_status.video) {
				return;
			}
			if (!this.node.dieidentity) {
				let str;
				if (this.special_identity) {
					str = get.translation(this.special_identity);
				} else {
					str = get.translation(`${this.identity}2`);
				}
				const node = ui.create.div(".damage.dieidentity", str, this);
				if (str === "野心家") {
					node.style.fontSize = "40px";
				}
				ui.refresh(node);
				node.style.opacity = 1 as unknown as string;
				this.node.dieidentity = node;
			}
			const trans = this.style.transform;
			if (trans) {
				if (trans.indexOf("rotateY") !== -1) {
					this.node.dieidentity.style.transform = "rotateY(180deg)";
				} else if (trans.indexOf("rotateX") !== -1) {
					this.node.dieidentity.style.transform = "rotateX(180deg)";
				} else {
					this.node.dieidentity.style.transform = "";
				}
			} else {
				this.node.dieidentity.style.transform = "";
			}
		},

		/**
		 * 处理角色死亡后的击杀奖励与紫势力野心家公开逻辑。
		 *
		 * @this { Player }
		 * @param { Player } [source] - 击杀来源角色。
		 * @returns { void }
		 */
		dieAfter2(this: Player, source) {
			if (_status.mode === "stratagem") {
				return;
			}
			if (_status.mode === "purple") {
				if (source) {
					if (this.identity === "rZhu" || this.identity === "bZhu") {
						if (this.identity.slice(0, 1) !== source.identity.slice(0, 1)) {
							source.recover();
						}
					} else if (this.identity === "rZhong" || this.identity === "bZhong") {
						if (this.identity.slice(0, 1) !== source.identity.slice(0, 1)) {
							source.draw(2);
						} else if (source.identity.indexOf("Zhu") === 1) {
							source.discard(source.getCards("h"));
						}
					} else if (this.identity === "rNei" || this.identity === "bNei") {
						if (this.identity.slice(0, 1) === source.identity.slice(0, 1)) {
							source.draw(3);
						}
					}
				}
				if (!_status.yeconfirm) {
					_status.yeconfirm = true;
					game.addGlobalSkill("yexinbilu");
					game.broadcastAll(() => {
						if (game.me!.identity === "rYe" || game.me!.identity === "bYe") {
							const player = game.findPlayer(current => current !== game.me && (current.identity === "bYe" || current.identity === "rYe"));
							if (player) {
								player.showIdentity();
							}
						}
					});
				}
			}
			if (this.identity === "fan" && source) {
				source.draw(3);
			} else if (this.identity === "commoner" && source) {
				source.draw(2);
			} else if (this.identity === "mingzhong" && source) {
				if (source.identity === "zhu") {
					source.discard(source.getCards("he"));
				} else {
					source.draw(3);
				}
			} else if (this.identity === "zhong" && source && source.identity === "zhu" && source.isZhu) {
				source.discard(source.getCards("he"));
			}
		},

		/**
		 * 处理角色死亡后的身份公开、主公转移和认输提示。
		 *
		 * @this { Player }
		 * @param { Player } [source] - 击杀来源角色。
		 * @returns { void }
		 */
		dieAfter(this: Player, source) {
			if (!this.identityShown) {
				game.broadcastAll(
					(player, identity, identity2) => {
						player.setIdentity(player.identity);
						player.identityShown = true;
						player.node.identity.classList.remove("guessing");
						if (identity) {
							(player.node.identity.firstChild! as HTMLElement).innerHTML = get.translation(`${identity}_bg`);
							game.log(player, "的身份是", `#g${get.translation(identity)}`);
						} else {
							game.log(player, "的身份是", `#g${get.translation(`${identity2}2`)}`);
						}
					},
					this,
					this.special_identity,
					this.identity
				);
			}
			if (this.special_identity) {
				game.broadcastAll(
					(zhu, identity) => {
						zhu.removeSkill(identity);
					},
					game.zhu,
					this.special_identity
				);
			}
			game.checkResult();
			if (_status.mode === "purple") {
				const red: any[] = [];
				const blue: any[] = [];
				game.countPlayer((current => {
					const identity = current.identity.slice(1);
					if (identity !== "Zhu") {
						if (current.identity.indexOf("r") === 0) {
							red.push(current);
						} else {
							blue.push(current);
						}
					}
				}) as unknown as Parameters<typeof game.countPlayer>[0]);
				if (red.length <= 1 && blue.length <= 1) {
					game.broadcastAll(game.showIdentity!);
				}
				return;
			}
			if (game.zhu && game.zhu.isZhu && (get.population("zhong") + get.population("nei") === 0 || get.population("zhong") + get.population("fan") === 0) && get.population("commoner") === 0) {
				game.broadcastAll(() => {
					if (game.showIdentity) {
						game.showIdentity();
					}
					if (game.zhu && game.zhu.isAlive() && get.population("nei") === 1 && get.config("nei_fullscreenpop", undefined)) {
						game.me!.$fullscreenpop('<span style="font-family:xinwei"><span data-nature="fire">主公</span><span data-nature="soil"> vs </span><span data-nature="thunder">内奸</span></span>', null as unknown as string, null as unknown as Parameters<Player["$fullscreenpop"]>[2], false);
					}
				});
			}
			if (game.zhu && game.zhu.storage.enhance_zhu && !game.zhu.storage.enhance_zhu.startsWith("sixiang_") && get.population("fan") < 3) {
				game.zhu.removeSkill(game.zhu.storage.enhance_zhu);
				delete game.zhu.storage.enhance_zhu;
			}
			if (this === game.zhong) {
				game.broadcastAll(player => {
					game.zhu = player;
					game.zhu.identityShown = true;
					(game.zhu.ai as IdentityPlayerAI).shown = 1;
					game.zhu.setIdentity();
					game.zhu.isZhu = true;
					const skills = player.getStockSkills(true, true).filter(skill => {
						if (player.hasSkill(skill)) {
							return false;
						}
						const info = get.info(skill);
						return info && info.zhuSkill;
					});
					if (skills.length) {
						player.addSkills(skills);
					}
					game.zhu.node.identity.classList.remove("guessing");
					if (lib.config.animation && !lib.config.low_performance) {
						game.zhu.$legend();
					}
					delete game.zhong;
					if (_status.clickingidentity && _status.clickingidentity[0] === game.zhu) {
						for (const node of _status.clickingidentity[1]) {
							node.delete();
							node.style.transform = "";
						}
						delete _status.clickingidentity;
					}
				}, game.zhu);
				game.delay(2);
				game.zhu.playerfocus(1000);
			}

			if (!_status.over) {
				let giveup;
				if (get.population("fan") + get.population("nei") === 1) {
					giveup = game.players.find(current => current.identity === "fan" || current.identity === "nei");
				} else if (get.population("zhong") + get.population("mingzhong") + get.population("nei") === 0) {
					giveup = game.zhu;
				}
				if (giveup) {
					giveup.showGiveup();
				}
			}
		},

		/**
		 * 根据一次行动的目标和牌/技能效果更新玩家的 AI 暴露度，并在允许时刷新自动身份标记。
		 *
		 * `targets` 为数字时会直接叠加到暴露度；为目标数组时会结合目标已暴露程度、身份和行动收益推断本玩家的阵营倾向。
		 *
		 * @this { Player }
		 * @param { Player[] | number } targets - 行动目标列表，或要直接增加的暴露值。
		 * @param { Card | VCard } card - 触发暴露判断的牌或技能。
		 */
		logAi(this: Player, targets, card) {
			if ((this.ai as IdentityPlayerAI).shown == 1 || this.isMad()) {
				return;
			}
			const stratagemMode = get.mode() == "identity" && _status.mode == "stratagem";
			if (stratagemMode && (!game.zhu || !game.zhu.isZhu || !game.zhu.identityShown)) {
				return;
			}
			if (typeof targets == "number") {
				(this.ai as IdentityPlayerAI).shown += targets;
			} else {
				let effect = 0;
				const info = get.info(card);
				if (info.ai && info.ai.expose) {
					if (_status.event.name != "_wuxie" || card.name != "wuxie") {
						(this.ai as IdentityPlayerAI).shown += info.ai.expose;
					} else {
						const infomap = _status.event._info_map;
						if (infomap && this != infomap.target && infomap.player && (infomap.player.ai as IdentityPlayerAI).shown) {
							(this.ai as IdentityPlayerAI).shown += 0.2;
						}
					}
				}
				for (const target of targets) {
					const shown = Math.abs((target.ai as IdentityPlayerAI).shown);
					let coefficient = 1;
					if (shown < 0.2 || target.identity == "nei") {
						coefficient = 0;
					} else if (shown < 0.4) {
						coefficient = 0.5;
					} else if (shown < 0.6) {
						coefficient = 0.8;
					}
					const eff = get.effect(target, card, this);
					effect += eff * coefficient;
					if (eff == 0 && shown == 0 && ["zhong", "rZhong", "bZhong"].includes(this.identity) && target != this) {
						effect += 0.1;
					}
				}
				const targetsSelfOnly = targets.length == 1 && targets[0] == this;
				if (effect > 0 && !targetsSelfOnly) {
					const coefficient = effect < 1 ? 0.5 : 1;
					const expose = targets.length == 1 ? 0.2 : 0.1;
					(this.ai as IdentityPlayerAI).shown += expose * coefficient;
				} else if (effect < 0 && !targetsSelfOnly && this == game.me && ["nei", "commoner", "rYe", "bYe"].includes(game.me.identity)) {
					const expose = targets.length == 1 ? 0.2 : 0.1;
					(this.ai as IdentityPlayerAI).shown -= expose;
				}
			}
			if (!stratagemMode && this != game.me) {
				(this.ai as IdentityPlayerAI).shown *= 2;
			}
			if ((this.ai as IdentityPlayerAI).shown > 0.95) {
				(this.ai as IdentityPlayerAI).shown = 0.95;
			}
			if ((this.ai as IdentityPlayerAI).shown < -0.5) {
				(this.ai as IdentityPlayerAI).shown = -0.5;
			}
			if (_status.mode == "purple") {
				return;
			}
			if (stratagemMode) {
				return;
			}

			const marknow = !_status.connectMode && this != game.me && get.config("auto_mark_identity", undefined) && (this.ai as IdentityPlayerAI).identity_mark != "finished";
			if (marknow && _status.clickingidentity && _status.clickingidentity[0] == this) {
				for (const identityNode of _status.clickingidentity[1]) {
					identityNode.delete();
					identityNode.style.transform = "";
				}
				delete _status.clickingidentity;
			}
			if (!Array.isArray(targets)) {
				targets = [];
			}
			let effect = 0;
			let zhu = game.zhu;
			if (_status.mode == "zhong" && !game.zhu.isZhu) {
				zhu = game.zhong!;
			}
			const targetsSelfOnly = targets.length == 1 && targets[0] == this;
			const hiddenIdentity = this.identity == "nei" || this.identity == "commoner";
			if (!targetsSelfOnly && !hiddenIdentity && (this.ai as IdentityPlayerAI).shown > 0) {
				effect = this.identity == "fan" ? -1 : 1;
			} else if (!targetsSelfOnly && hiddenIdentity) {
				for (const target of targets) {
					const shown = Math.abs((target.ai as IdentityPlayerAI).shown);
					let coefficient = 1;
					if (shown < 0.2 || target.identity == "nei") {
						coefficient = 0;
					} else if (shown < 0.4) {
						coefficient = 0.5;
					} else if (shown < 0.6) {
						coefficient = 0.8;
					}
					effect += get.effect(target, card, this, zhu) * coefficient;
				}
			}
			if (!hiddenIdentity) {
				if (!marknow) {
					return;
				}
				if (effect > 0 && this.identity != "fan") {
					this.setIdentity("zhong");
					(this.ai as IdentityPlayerAI).identity_mark = "finished";
				} else if (effect < 0 && this.identity == "fan") {
					this.setIdentity("fan");
					(this.ai as IdentityPlayerAI).identity_mark = "finished";
				}
				return;
			}
			const markIdentity = identity => {
				if (marknow) {
					this.setIdentity(identity);
				}
				(this.ai as IdentityPlayerAI).identity_mark = identity || "finished";
			};
			if (effect > 0) {
				markIdentity((this.ai as IdentityPlayerAI).identity_mark == "fan" ? undefined : "zhong");
			} else if (effect < 0 && get.population("fan") > 0) {
				markIdentity((this.ai as IdentityPlayerAI).identity_mark == "zhong" ? undefined : "fan");
			}
		},
	};
}

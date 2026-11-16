import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dclingyue" | "dcpandi">} */
export const groupSkills = {
	//孙翎鸾
	dclingyue: {
		audio: 2,
		trigger: { global: "damageSource" },
		forced: true,
		filter(event, player) {
			if (!event.source || !event.source.isIn()) {
				return false;
			}
			var history = event.source.actionHistory;
			for (var i = history.length - 1; i >= 0; i--) {
				if (i == history.length - 1) {
					if (history[i].sourceDamage.indexOf(event) > 0) {
						return false;
					}
				} else if (history[i].sourceDamage.some(evt => evt != event)) {
					return false;
				}
				if (history[i].isRound) {
					break;
				}
			}
			return true;
		},
		content() {
			var num = 1,
				current = _status.currentPhase;
			if (current && trigger.source != current) {
				var num = 0,
					players = game.players.slice(0).concat(game.dead);
				for (var target of players) {
					target.getHistory("sourceDamage", function (evt) {
						num += evt.num;
					});
				}
			}
			player.draw(num);
		},
	},
	dcpandi: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			var players = event.dcpandi;
			if (!players || !players.length) {
				return false;
			}
			var source = player.storage.dcpandi_effect;
			return get.itemtype(source) != "player" || !source.isIn();
		},
		pandi_wrapKey() {
			var str = "";
			for (var arg of arguments) {
				if (arg === null || arg === undefined) {
					str += arg + "-";
					continue;
				}
				switch (get.itemtype(arg)) {
					case "player":
						str += "p:" + arg.playerid;
						break;
					case "card":
						if (arg.cardid) {
							str += "c:" + arg.cardid;
						} else {
							str += "c:" + arg.name;
						}
						break;
					default:
						str += "n:" + arg;
						break;
				}
				str += "-";
			}
			return str;
		},
		pandi_effect(target, card, player, viewer) {
			if (!_status.event) {
				return get.effect(target, card, player, viewer);
			}
			var key = lib.skill.dcpandi.pandi_wrapKey.apply(null, arguments);
			var effect = _status.event.getTempCache("effect", key);
			if (effect !== undefined) {
				return effect;
			}
			effect = get.effect(target, card, player, viewer);
			_status.event.putTempCache("effect", key, effect);
			return effect;
		},
		pandi_canUse(player, card, target, arg1, arg2) {
			if (!_status.event) {
				return player.canUse(card, target, arg1, arg2);
			}
			var key = lib.skill.dcpandi.pandi_wrapKey.apply(null, arguments);
			var effect = _status.event.getTempCache("canUse", key);
			if (effect !== undefined) {
				return effect;
			}
			effect = player.canUse(card, target, arg1, arg2);
			_status.event.putTempCache("canUse", key, effect);
			return effect;
		},
		pandi_effect_use(target, card, player, viewer) {
			if (!_status.event) {
				return get.effect_use(target, card, player, viewer);
			}
			var key = lib.skill.dcpandi.pandi_wrapKey.apply(null, arguments);
			var effect = _status.event.getTempCache("effect_use", key);
			if (effect !== undefined) {
				return effect;
			}
			effect = get.effect_use(target, card, player, viewer);
			_status.event.putTempCache("effect_use", key, effect);
			return effect;
		},
		onChooseToUse(event) {
			if (!game.online && event.type == "phase" && !event.dcpandi) {
				var players = game.filterPlayer(function (current) {
					return current != event.player && current.getHistory("sourceDamage").length == 0;
				});
				event.set("dcpandi", players);
			}
		},
		filterTarget(card, player, target) {
			var players = _status.event.dcpandi;
			if (!players || !players.length) {
				return false;
			}
			return players.includes(target);
		},
		content() {
			if (target.isIn()) {
				player.storage.dcpandi_effect = target;
				player.addTempSkill("dcpandi_effect", "phaseUseAfter");
			}
		},
		ai: {
			threaten: 4,
			order: 12,
			result: {
				player(player, target) {
					return player.getCards("hs").reduce(function (eff, card) {
						return Math.max(eff, lib.skill.dcpandi.getUseValue(card, target, player) - lib.skill.dcpandi.getUseValue(card, player, player));
					}, 0);
				},
			},
		},
		getUseValue(card, player, viewer) {
			if (typeof card == "string") {
				card = { name: card, isCard: true };
			}
			var key = lib.skill.dcpandi.pandi_wrapKey(card, player, viewer);
			if (_status.event) {
				var uv = _status.event.getTempCache("getUseValue", key);
				if (uv !== undefined) {
					return uv;
				}
			}
			var targets = game.filterPlayer();
			var value = [];
			var min = 0;
			var info = get.info(card);
			if (!info || info.notarget) {
				if (_status.event) {
					_status.event.putTempCache("getUseValue", key, 0);
				}
				return 0;
			}
			var range;
			var select = get.copy(info.selectTarget);
			if (select == undefined) {
				if (info.filterTarget == undefined) {
					if (_status.event) {
						_status.event.putTempCache("getUseValue", key, true);
					}
					return true;
				}
				range = [1, 1];
			} else if (typeof select == "number") {
				range = [select, select];
			} else if (get.itemtype(select) == "select") {
				range = select;
			} else if (typeof select == "function") {
				range = select(card, player);
				if (typeof range == "number") {
					range = [range, range];
				}
			}
			if (info.singleCard) {
				range = [1, 1];
			}
			game.checkMod(card, player, range, "selectTarget", player);
			if (!range) {
				if (_status.event) {
					_status.event.putTempCache("getUseValue", key, 0);
				}
				return 0;
			}
			for (var i = 0; i < targets.length; i++) {
				if (lib.skill.dcpandi.pandi_canUse(player, card, targets[i], null, true)) {
					var eff = lib.skill.dcpandi.pandi_effect(targets[i], card, player, viewer);
					value.push(eff);
				}
			}
			value.sort(function (a, b) {
				return b - a;
			});
			for (var i = 0; i < value.length; i++) {
				if (i == range[1] || (range[1] != -1 && value[i] <= 0)) {
					break;
				}
				min += value[i];
			}
			if (_status.event) {
				_status.event.putTempCache("getUseValue", key, min);
			}
			return min;
		},
		subSkill: {
			effect: {
				audio: "dcpandi",
				charlotte: true,
				priority: Infinity,
				onremove: true,
				mark: "character",
				intro: {
					content: "下一张牌视为由$使用",
				},
				trigger: { player: "useCardBefore" },
				forced: true,
				filter(event, player) {
					var source = player.storage.dcpandi_effect;
					return get.itemtype(source) == "player" && source.isIn();
				},
				logTarget: (event, player) => player.storage.dcpandi_effect,
				content() {
					trigger.player = player.storage.dcpandi_effect;
					trigger.noai = true;
					player.removeSkill("dcpandi_effect");
					game.delay(0.5);
				},
				ai: {
					order(card, player, target, current) {
						if (typeof card != "object") {
							return;
						}
						var source = player.storage.dcpandi_effect;
						if (!source.isIn() || get.itemtype(source) != "player" || get.itemtype(source.storage.dcpandi_effect) == "player") {
							return;
						}
						return [0, lib.skill.dcpandi.pandi_effect_use(target, card, source, player), 0, lib.skill.dcpandi.pandi_effect(target, card, source, target)];
					},
				},
				mod: {
					selectTarget(card, player, range) {
						var source = player.storage.dcpandi_effect;
						if (!source.isIn() || get.itemtype(source) != "player" || get.itemtype(source.storage.dcpandi_effect) == "player") {
							return;
						}
						var range,
							info = get.info(card);
						var select = get.copy(info.selectTarget);
						if (select == undefined) {
							if (info.filterTarget == undefined) {
								return [0, 0];
							}
							range = [1, 1];
						} else if (typeof select == "number") {
							range = [select, select];
						} else if (get.itemtype(select) == "select") {
							range = select;
						} else if (typeof select == "function") {
							range = select(card, source);
							if (typeof range == "number") {
								range = [range, range];
							}
						}
						game.checkMod(card, source, range, "selectTarget", source);
					},
					cardEnabled2(card, player, event) {
						var source = player.storage.dcpandi_effect;
						if (!source.isIn() || get.itemtype(source) != "player" || get.itemtype(source.storage.dcpandi_effect) == "player") {
							return;
						}
						var check = game.checkMod(card, source, event, "unchanged", "cardEnabled2", source);
						return check;
					},
					cardEnabled(card, player, event) {
						var source = player.storage.dcpandi_effect;
						if (!source.isIn() || get.itemtype(source) != "player" || get.itemtype(source.storage.dcpandi_effect) == "player") {
							return;
						}
						if (event === "forceEnable") {
							var mod = game.checkMod(card, source, event, "unchanged", "cardEnabled", source);
							if (mod != "unchanged") {
								return mod;
							}
							return true;
						} else {
							var filter = get.info(card).enable;
							if (!filter) {
								return;
							}
							var mod = game.checkMod(card, player, source, "unchanged", "cardEnabled", source);
							if (mod != "unchanged") {
								return mod;
							}
							if (typeof filter == "boolean") {
								return filter;
							}
							if (typeof filter == "function") {
								return filter(card, source, event);
							}
						}
					},
					cardUsable(card, player, num) {
						var source = player.storage.dcpandi_effect;
						if (!source.isIn() || get.itemtype(source) != "player" || get.itemtype(source.storage.dcpandi_effect) == "player") {
							return;
						}
						var event = _status.event;
						if (event.type == "chooseToUse_button") {
							event = event.getParent();
						}
						if (source != _status.event.player) {
							return true;
						}
						if (info.updateUsable == "phaseUse") {
							if (event.getParent().name != "phaseUse") {
								return true;
							}
							if (event.getParent().player != source) {
								return true;
							}
						}
						event.addCount_extra = true;
						var num = info.usable;
						if (typeof num == "function") {
							num = num(card, source);
						}
						num = game.checkMod(card, source, num, event, "cardUsable", source);
						if (typeof num != "number") {
							return true;
						}
						if (source.countUsed(card) < num) {
							return true;
						}
						if (
							game.hasPlayer(function (current) {
								return game.checkMod(card, source, current, false, "cardUsableTarget", source);
							})
						) {
							return true;
						}
						return false;
					},
					playerEnabled(card, player, target) {
						var source = player.storage.dcpandi_effect;
						if (!source.isIn() || get.itemtype(source) != "player" || get.itemtype(source.storage.dcpandi_effect) == "player") {
							return;
						}
						return lib.filter.targetEnabledx(card, source, target);
					},
					targetInRange(card, player, target) {
						var source = player.storage.dcpandi_effect;
						if (!source.isIn() || get.itemtype(source) != "player" || get.itemtype(source.storage.dcpandi_effect) == "player") {
							return;
						}
						return lib.filter.targetInRange(card, source, target);
					},
				},
			},
		},
	},
};

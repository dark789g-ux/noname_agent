/* eslint-disable no-var -- 保留原实现的函数作用域及 arguments 协议。 */
import { get } from "noname";
import { game } from "noname";
import { _status } from "noname";
import { ui } from "noname";
import { lib } from "noname";
import type { Player } from "@/library/contracts/runtime.js";
import type { Card } from "@/library/contracts/runtime.js";
import type { VCard } from "@/library/contracts/runtime.js";

export function createCheatPlayers() {
	return {
		/**
		 * 炉石模式可用，使用'spell_yexinglanghun'卡牌
		 * @param { boolean } [me] 决定是自己还是对手使用'spell_yexinglanghun'卡牌
		 */
		uy(me?: boolean) {
			if (me) {
				const player = game.getMe();
				player.useCard({ card: new lib.element.VCard({ name: "spell_yexinglanghun" }), targets: [player] });
			} else {
				// player.getEnemy是炉石模式的函数
				const enemy = game.getMe().getEnemy();
				enemy.useCard({ card: new lib.element.VCard({ name: "spell_yexinglanghun" }), targets: [enemy] });
			}
		},
		/**
		 * 炉石模式可用，使用`spell_${name}`卡牌
		 * @param { string } [name]
		 * @param { boolean } [act]
		 */
		gs(name: string = "yexinglanghun", act?: boolean) {
			const card = game.createCard("spell_" + name);
			const player = game.getMe();
			player.node.handcards1.appendChild(card);
			if (!act) {
				player.actused = -99;
			}
			ui.updatehl();
			delete _status.event._buttonChoice;
			delete _status.event._cardChoice;
			delete _status.event._targetChoice;
			delete _status.event._skillChoice;
			setTimeout(game.check, 300);
		},
		/**
		 * 炉石模式可用，获得`stone_${name}_stonecharacter`卡牌
		 * @param { string } [name]
		 * @param { boolean } [act]
		 */
		gc(name: string = "falifulong", act?: boolean) {
			var card = game.createCard("stone_" + name + "_stonecharacter");
			const player = game.getMe();
			player.node.handcards1.appendChild(card);
			if (!act) {
				player.actused = -99;
			}
			ui.updatehl();
			delete _status.event._buttonChoice;
			delete _status.event._cardChoice;
			delete _status.event._targetChoice;
			delete _status.event._skillChoice;
			setTimeout(game.check, 300);
		},
		/**
		 * 进入/关闭快速自动测试模式(游戏速度最快)，只有游戏记录界面
		 * @param { boolean | string } [bool]
		 */
		a(bool?: boolean | string) {
			if (lib.config.test_game) {
				game.saveConfig("test_game");
			} else {
				if (bool) {
					if (typeof bool === "string") {
						game.saveConfig("test_game", bool);
					} else {
						game.saveConfig("test_game", "_");
					}
				} else {
					game.saveConfig("test_game", true);
				}
			}
			game.reload();
		},
		/**
		 * 临时去掉“自动测试模式”带来的css效果，
		 *
		 * 如果要彻底关闭，需要再执行一次lib.cheat.a
		 */
		as() {
			ui.window.classList.remove("testing");
			const bg = ui.window.querySelector(".pausedbg");
			if (bg) {
				bg.remove();
			}
		},
		/**
		 * 装备麒麟弓，并且下家玩家对你发动借刀杀人,杀你的上家
		 */
		uj() {
			lib.cheat.e("qilin");
			const player = game.getMe();
			player.next.useCard({ card: new lib.element.VCard({ name: "jiedao" }), targets: [player, player.previous] });
		},
		/**
		 * 下家对你使用一张牌
		 * @param  {...(Player | Player[] | Card | VCard | string)} args
		 *
		 * @example
		 * ```js
		 * // 传入player是卡牌的使用者
		 * // 传入player数组是卡牌的目标(没有则目标是game.me)
		 * // 传入字符串设置卡牌名称
		 * // 传入Vcard对象设置卡牌更具体的卡牌信息
		 * lib.cheat.u(player1, 'sha', [player2, player3]);
		 * ```
		 */
		u(...args: (Player | Player[] | Card | VCard | string)[]) {
			/**
			 * @param {Player | Player[] | Card | VCard | string} value
			 * @returns {value is Player}
			 */
			const isPlayer = (value: Player | Player[] | Card | VCard | string): value is Player => get.itemtype(value) == "player";
			/**
			 * @param {Player | Player[] | Card | VCard | string} value
			 * @returns {value is Player[]}
			 */
			const isPlayers = (value: Player | Player[] | Card | VCard | string): value is Player[] => get.itemtype(value) == "players";
			/** @type {VCard} */
			let card: VCard = new lib.element.VCard({ name: "sha" });
			/** @type {Player} */
			const me: Player = game.getMe();
			let source = me.next;
			/** @type {Player[]} */
			let targets: Player[] = [];
			for (let i = 0; i < args.length; i++) {
				const arg = args[i];
				if (isPlayer(arg)) {
					source = arg;
				} else if (isPlayers(arg)) {
					targets = arg;
				} else if (arg instanceof lib.element.VCard) {
					card = arg;
				} else if (get.itemtype(arg) == "card") {
					card = new lib.element.VCard(arg);
				} else if (typeof arg == "string") {
					card = new lib.element.VCard({ name: arg });
				}
			}
			if (!targets.length) {
				targets.push(me);
			}
			source.useCard({ card: game.createCard(card.name, card.suit, card.number, card.nature), targets });
		},
		/**
		 * 输出每个强度的武将数量、每个武将包的每个强度的武将数量、每个武将对应的id和翻译
		 * @param { boolean } [bool] 为false不输出无名杀自带的武将id和翻译
		 */
		r(bool?: boolean) {
			const rank = lib.rank;
			if (!rank) {
				return;
			}
			const log = function (...args) {
				console.log(...args);
				game.print(...args);
			};
			let list = ["s", "ap", "a", "am", "bp", "b", "bm", "c", "d"];
			let str = "";
			for (let i = 0; i < list.length; i++) {
				if (str) {
					str += " 、 ";
				}
				str += list[i] + "-" + rank[list[i]].length;
			}
			log(str);
			for (let i in lib.characterPack) {
				if (!bool && lib.config.all.sgscharacters.includes(i)) {
					continue;
				}
				let map = {};
				let str = "";
				for (let j in lib.characterPack[i]) {
					let rank = get.rank(j);
					if (!map[rank]) {
						map[rank] = 1;
					} else {
						map[rank]++;
					}
				}
				for (let j = 0; j < list.length; j++) {
					if (map[list[j]]) {
						if (str) {
							str += " 、 ";
						}
						str += list[j] + "-" + map[list[j]];
					}
				}
				if (str) {
					log(lib.translate[i + "_character_config"] + "：" + str);
				}
			}

			let list2 = rank.s.concat(rank.ap).concat(rank.a).concat(rank.am).concat(rank.bp).concat(rank.b).concat(rank.bm).concat(rank.c).concat(rank.d);
			Object.keys(lib.character).forEach(key => {
				if (!lib.config.forbidai.includes(key) && !key.startsWith("boss_") && !key.startsWith("tafang_") && !list2.includes(key)) {
					log(get.translation(key), key);
				}
			});
		},
		/**
		 * 打印目标玩家的手牌
		 * @param { Player } player
		 */
		h(player: Player) {
			console.log(get.translation(player.getCards("h")));
		},
		/**
		 * 给自己立刻添加手牌
		 *
		 * @example
		 * ```js
		 * // 获得3张杀和1张闪
		 * lib.cheat.g('sha', 3, 'shan', 1)
		 * ```
		 */
		g(...args) {
			for (let i = 0; i < args.length; i++) {
				if (i > 0 && typeof args[i] == "number") {
					for (let j = 0; j < args[i] - 1; j++) {
						lib.cheat.gx(args[i - 1]);
					}
				} else {
					lib.cheat.gx(args[i]);
				}
			}
		},
		/**
		 * 立即获得指定类型的牌各一张
		 *
		 * 会添加到不属于当前模式的牌和某些角色专属牌
		 *
		 * @param { string } type
		 */
		ga(type: string) {
			for (let i in lib.card) {
				if (lib.card[i].type == type || lib.card[i].subtype == type) {
					lib.cheat.g(i);
				}
			}
		},
		/**
		 *  给所有玩家立刻添加一张或多张指定的牌
		 * @param  {...string} args
		 * @example
		 * ```js
		 * // 给所有玩家立刻添加一张杀和一张闪
		 * lib.cheat.gg('sha', 'shan');
		 * ```
		 */
		gg(...args: string[]) {
			game.players.forEach(player => {
				args.forEach(cardName => {
					lib.cheat.gx(cardName, player);
				});
			});
		},
		/**
		 * 给目标立即添加一张手牌
		 * @param { string } name
		 * @param { Player } target
		 */
		gx(name: string, target: Player = game.getMe()) {
			const card = lib.cheat.gn(name);
			if (!card) {
				return;
			}
			target.node.handcards1.appendChild(card);
			delete _status.event._buttonChoice;
			delete _status.event._cardChoice;
			delete _status.event._targetChoice;
			delete _status.event._skillChoice;
			game.check();
			target.update();
			ui.updatehl();
		},
		/**
		 * 创建卡牌
		 *
		 * 如果lib.card里没有对应卡牌名返回null
		 *
		 * @param { string } name
		 * @returns { Card | null }
		 * @example
		 * ```js
		 * // 创建一个梅花杀
		 * lib.cheat.gn('clubsha');
		 * // 创建一个红色杀
		 * lib.cheat.gn('redsha');
		 * // 创建一个黑色杀
		 * lib.cheat.gn('blacksha');
		 * // 创建一个火杀
		 * lib.cheat.gn('huosha');
		 * // 创建一个雷杀
		 * lib.cheat.gn('leisha');
		 * // 冰杀神杀刺杀没有
		 * ```
		 */
		gn(name: string): Card | null {
			let nature: string | null = null;
			let suit: string | null = null;
			let suits = ["club", "spade", "diamond", "heart"];
			for (let i = 0; i < suits.length; i++) {
				if (name.startsWith(suits[i])) {
					suit = suits[i];
					name = name.slice(suits[i].length);
					break;
				}
			}
			if (name.startsWith("red")) {
				name = name.slice(3);
				suit = ["diamond", "heart"].randomGet();
			}
			if (name.startsWith("black")) {
				name = name.slice(5);
				suit = ["spade", "club"].randomGet();
			}

			if (name == "huosha") {
				name = "sha";
				nature = "fire";
			} else if (name == "leisha") {
				name = "sha";
				nature = "thunder";
			}
			if (!lib.card[name]) {
				return null;
			}
			return game.createCard(name, suit, undefined, nature);
		},
	};
}

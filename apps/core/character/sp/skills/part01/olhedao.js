import { lib, game, ui, get, ai, _status } from "noname";
import { olhedaoTianshuTrigger } from "./olhedaoTianshuTrigger.js";
import { olhedaoTianshuContent1 } from "./olhedaoTianshuContent1.js";
import { olhedaoTianshuContent2 } from "./olhedaoTianshuContent2.js";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olhedao">} */
export const groupSkills = {
	//OL南华老仙
	olhedao: {
		audio: 3,
		trigger: {
			global: "phaseBefore",
			player: ["enterGame", "dyingAfter"],
		},
		filter(event, player) {
			if (event.name === "dying") {
				return game.getAllGlobalHistory("everything", evt => evt.name === "dying" && evt.player === player).indexOf(event) === 0;
			}
			return event.name !== "phase" || game.phaseNumber === 0;
		},
		forced: true,
		priority: 12, //本体御用优先级
		content() {
			player.storage[event.name] = 2 + (trigger.name === "dying");
			player.markSkill(event.name);
		},
		intro: { content: "至多拥有#册“天书”" },
		getLimit(player) {
			const num = player.storage.olhedao;
			return typeof num === "number" ? num : 1;
		},
		//时机
		tianshuTrigger: olhedaoTianshuTrigger,
		//执行
		tianshuContent: [...olhedaoTianshuContent1, ...olhedaoTianshuContent2],
		//清理
		tianshuClear(skill, player, num = 1) {
			if (num > 0 && get.info(skill)?.nopop) {
				game.broadcastAll(
					(player, skill) => {
						delete lib.skill[skill].nopop;
						lib.skill[skill].markimage = "image/card/tianshu1.png";
						if (player.marks[skill]) {
							player.marks[skill].setBackgroundImage(lib.skill[skill].markimage);
						}
					},
					player,
					skill
				);
				player.update();
			}
			player.storage[skill][0] -= num;
			player[player.storage[skill][0] <= 0 ? "removeSkill" : "markSkill"](skill);
		},
		subSkill: {
			hand: {
				charlotte: true,
				onremove: true,
				markimage: "image/card/handcard.png",
				mod: { maxHandcard: (player, num) => num + player.countMark("olhedao_hand") },
				intro: {
					name: "天书",
					content: "手牌上限+#",
				},
			},
			effect: {
				charlotte: true,
				onremove: true,
				mod: {
					targetInRange(card, player, target) {
						if (player.getStorage("olhedao_effect").includes(target)) {
							return true;
						}
					},
					cardUsableTarget(card, player, target) {
						if (player.getStorage("olhedao_effect").includes(target)) {
							return Infinity;
						}
					},
				},
				intro: {
					name: "天书",
					content: "对$使用牌无距离和任何次数限制",
				},
				trigger: { player: "useCard1" },
				filter(event, player) {
					return event.addCount !== false && Array.isArray(event.targets) && event.targets.some(target => player.getStorage("olhedao_effect").includes(target));
				},
				forced: true,
				popup: false,
				silent: true,
				firstDo: true,
				async content(event, trigger, player) {
					trigger.addCount = false;
					const stat = player.getStat().card,
						name = trigger.card.name;
					if (typeof stat[name] === "number") {
						stat[name]--;
					}
				},
			},
		},
		ai: {
			threaten: 4,
			combo: "olqingshu",
		},
	},
};

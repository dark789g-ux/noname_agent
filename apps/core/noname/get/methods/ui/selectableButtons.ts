import { game, lib, _status, ui } from "noname";
import { get } from "../../dependencies.js";

export const uiSelectableButtonsMethods = {
	/**
	 * 返回可以选择的按钮
	 * @param {((a: Button, b: Button) => number)} [sort] 排序函数
	 * @returns { Button[] }
	 */
	selectableButtons(sort: ((a: Button, b: Button) => number) | undefined) {
		if (!_status.event.player) {
			return [];
		}
		let buttons = _status.event.dialog!.buttons;
		let selectable: any[] = [];
		for (let i = 0; i < buttons.length; i++) {
			if (buttons[i].classList.contains("selectable") && buttons[i].classList.contains("selected") == false) {
				selectable.push(buttons[i]);
			}
		}
		if (sort) {
			selectable.sort(sort);
		}
		return selectable;
	},

	/**
	 * 返回可以选择的牌
	 * @param {((a: Card, b: Card) => number)} [sort] 排序函数
	 * @returns { Card[] }
	 */
	selectableCards(sort: ((a: Card, b: Card) => number) | undefined) {
		if (!_status.event.player) {
			return [];
		}
		let cards = _status.event.player.getCards("hes");
		let selectable: any[] = [];
		for (let i = 0; i < cards.length; i++) {
			if (cards[i].classList.contains("selectable") && cards[i].classList.contains("selected") == false) {
				selectable.push(cards[i]);
			}
		}
		if (sort) {
			selectable.sort(sort);
		}
		return selectable;
	},

	modetrans(config, server) {
		if (config.mode == "doudizhu") {
			switch (config.doudizhu_mode) {
				case "kaihei":
					return "开黑斗地主";
				case "huanle":
					return "欢乐斗地主";
				case "binglin":
					return "兵临城下";
				case "online":
					return "智斗三国";
				default:
					return "休闲" + (config.double_character ? "双将" : "") + "斗地主";
			}
		}
		if (config.mode == "versus") {
			switch (config.versus_mode) {
				case "1v1":
					return "单人对决";
				case "2v2":
					return "欢乐成双";
				case "3v3":
					return "血战到底";
				case "4v4":
					return "四人对决";
				case "guandu":
					return "官渡之战";
			}
		}
		if (config.mode == "single") {
			switch (config.single_mode) {
				case "normal":
					return "新１ｖ１";
				case "changban":
					return "血战长坂坡";
				case "dianjiang":
					return "点将单挑";
				case "wuxianhuoli":
					return "无限火力";
			}
		}
		if (config.mode == "identity") {
			switch (config.identity_mode) {
				case "purple":
					return "三对三对二";
				case "zhong":
					return (config.double_character ? "双将" : "") + "忠胆英杰";
				case "stratagem":
					return get.cnNumber(parseInt(config.number)) + "人" + (config.double_character ? "双将" : "") + "谋攻";
				default:
					return `${get.cnNumber(parseInt(config.number))}人${config.double_nei ? "双内" : ""}${config.enable_commoner ? "带民" : ""}${config.double_character ? "双将" : ""}身份`;
			}
		}
		if (config.mode == "guozhan") {
			if (config.separatism) {
				return "群雄割据";
			}
			if (config.guozhan_mode != "normal") {
				switch (config.guozhan_mode) {
					case "yingbian":
						return "应变国战";
					case "old":
						return "怀旧国战";
				}
			}
		}
		if (server) {
			return get.translation(get.plainText(config.mode)) + "模式";
		} else {
			return get.cnNumber(parseInt(config.number)) + "人" + get.translation(get.plainText(config.mode));
		}
	},

	idDialog(id) {
		return ui.dialogs.find((dialog: Dialog) => dialog.videoId == id) || null;
	},

	arenaState() {
		let state = {
			number: ui.arena.dataset.number,
			players: {},
			mode: _status.mode,
			dying: _status.dying,
			servermode: game.servermode,
			roomId: game.roomId,
			over: _status.over,
			inpile: lib.inpile,
			inpile_nature: lib.inpile_nature,
		};
		for (const [key, value] of lib.commonArea) {
			state[value.areaStatusName] = _status[value.areaStatusName];
		}
		for (let i in lib.playerOL) {
			state.players[i] = lib.playerOL[i].getState();
		}
		return state;
	},

	skillState(player) {
		let skills: { global: string[]; skillinfo?: object; stat?: ReturnType<Player["getStat"]> } = {
			global: lib.skill.global,
		};
		let skillinfo = {};
		for (let i in lib.playerOL) {
			skills[i] = {
				skills: lib.playerOL[i].skills,
				hiddenSkills: lib.playerOL[i].hiddenSkills,
				invisibleSkills: lib.playerOL[i].invisibleSkills,
				additionalSkills: lib.playerOL[i].additionalSkills,
				disabledSkills: lib.playerOL[i].disabledSkills,
				tempSkills: lib.playerOL[i].tempSkills,
				storage: lib.playerOL[i].storage,
			};
		}
		//for(var i in lib.skill){
		//	if(lib.skill[i].chooseButton&&lib.skill[i].enable){
		//		skillinfo[i]=lib.skill[i].chooseButton;
		//	}
		//}
		skills.skillinfo = skillinfo;
		if (player) {
			skills.stat = player.getStat();
		}
		return skills;
	},

	/**
	 * 获取一名角色的勾玉颜色（构思玩意）
	 * @param {import("@/library/index.js").Player | { hp: number, maxHp: number}} player
	 * @return {string}
	 */
	hpColor(player: Player | { hp: number; maxHp: number }) {
		let color;
		const { hp, maxHp } = player;
		if (Number(hp) > Math.round(Number(maxHp) / 2) || hp === maxHp) {
			color = "green";
		} else if (Number(hp) > Math.floor(Number(maxHp) / 3)) {
			color = "yellow";
		} else {
			color = "red";
		}
		return color;
	},
};

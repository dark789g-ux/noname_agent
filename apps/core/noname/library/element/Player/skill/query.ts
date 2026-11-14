import { _status, game, get, lib } from "noname";
import { getRegisteredSkill } from "../../../skillRegistry.js";
import type { Player } from "../../player.js";
import type { SkillQueryMode } from "../contracts/skillContract.js";

export const skillQueryMethods = {
	addSkillBlocker(this: Player, skill: string): void {
		if (!this.storage.skill_blocker) {
			this.storage.skill_blocker = [];
		}
		this.storage.skill_blocker.push(skill);
	},

	removeSkillBlocker(this: Player, skill: string): void {
		if (this.storage.skill_blocker) {
			this.storage.skill_blocker.remove(skill);
			if (!this.storage.skill_blocker.length) {
				delete this.storage.skill_blocker;
			}
		}
	},

	getStockSkills(this: Player, unowned?: boolean | null, unique?: boolean | null, hidden?: boolean | null): string[] {
		const list: string[] = [];
		if (lib.character[String(this.name)] && (hidden || !this.isUnseen(0))) {
			list.addArray(lib.character[String(this.name)][3]);
		}
		if (lib.character[String(this.name1)] && (hidden || !this.isUnseen(0))) {
			list.addArray(lib.character[String(this.name1)][3]);
		}
		const name2 = this.name2;
		if (name2 && lib.character[name2] && (hidden || !this.isUnseen(1))) {
			list.addArray(lib.character[name2][3]);
		}
		if (!unowned) {
			for (let i = 0; i < list.length; i++) {
				if (!this.hasSkill(list[i])) {
					list.splice(i--, 1);
				}
			}
		}
		if (!unique) {
			for (let i = 0; i < list.length; i++) {
				const info = getRegisteredSkill(lib.skill, list[i]);
				if (!info || info.unique || info.temp || info.sub || info.charlotte) {
					list.splice(i--, 1);
				}
			}
		}
		return list;
	},

	/**
	 * 获取一名角色隐藏武将牌上的所有技能
	 */
	getHiddenSkills(this: Player, unowned?: boolean | null, unique?: boolean | null): string[] {
		const player = this;
		return player.getStockSkills(unowned, unique, true).removeArray(player.getStockSkills(unowned, unique));
	},

	getGainableSkills(this: Player, func?: (info: any, skill: string, character: string) => boolean): string[] {
		const list: string[] = [];
		const names = [this.name, this.name1, this.name2];
		for (let i = 0; i < names.length; i++) {
			const name = names[i];
			if (name) {
				list.addArray(get.gainableSkillsName(name, func));
			}
		}
		return list;
	},

	/**
	 * 返回武将牌上原有的技能
	 */
	getOriginalSkills(this: Player): string[] {
		const skills: string[] = [];
		if (lib.character[String(this.name)] && !this.isUnseen(0)) {
			skills.addArray(lib.character[String(this.name)][3]);
		}
		if (this.name2 && lib.character[this.name2] && !this.isUnseen(1)) {
			skills.addArray(lib.character[this.name2][3]);
		}
		return skills;
	},

	getModableSkills(this: Player): string[] {
		let skills = this.getSkills().concat(lib.skill.global);
		game.expandSkills(skills);
		skills = skills.filter(function (skill) {
			const info = get.info(skill);
			return Boolean(info && info.mod);
		});
		skills.sort((a, b) => get.priority(a) - get.priority(b));
		return skills;
	},

	/**
	 * 返回玩家当前拥有的技能列表。
	 *
	 * - `null`: 返回普通技能、非`hidden:`的额外技能、临时技能和装备技能。
	 * - `true`: 在`null`的基础上额外加入hiddenSkills，并允许`hidden:`的额外技能。
	 * - `false`: 在`null`的基础上额外加入invisibleSkills。
	 * - `"invisible"`: 同时包含`true`和`false`中的技能。
	 * - `"e"`: 在`includeEquipSkills`不为`false`时，直接返回装备技能；反之退化为`true`
	 */
	getSkills(this: Player, skillMode?: SkillQueryMode, includeEquipSkills?: boolean | null, applySkillFilter?: boolean): string[] {
		let skills = this.skills.slice(0);
		const es: string[] = [];
		if (includeEquipSkills !== false) {
			const VEquips = this.getVCards("e");
			es.addArray(get.skillsFromEquips(VEquips));
			if (skillMode === "e") {
				return es;
			}
		}
		for (const source in this.additionalSkills) {
			const additionalSkills: string[] | string | undefined = this.additionalSkills[source];
			if (Array.isArray(additionalSkills) && (skillMode || source.indexOf("hidden:") !== 0)) {
				for (const skill of additionalSkills) {
					if (!skill) {
						continue;
					}
					skills.add(skill);
				}
			} else if (additionalSkills && typeof additionalSkills === "string") {
				skills.add(additionalSkills);
			}
		}
		for (const skill in this.tempSkills) {
			skills.add(skill);
		}
		if (skillMode) {
			skills.addArray(this.hiddenSkills);
		}
		if (skillMode === false || skillMode === "invisible") {
			skills.addArray(this.invisibleSkills);
		}
		if (includeEquipSkills !== false) {
			skills.addArray(es);
		}
		for (const skill in this.forbiddenSkills) {
			skills.remove(skill);
		}
		if (applySkillFilter !== false) {
			skills = game.filterSkills(skills, this, es);
		}
		return skills;
	},

	/**
	 * 返回技能是否暂时失效
	 */
	isTempBanned(this: Player, skill: string): boolean {
		return this.hasStorage(`temp_ban_${skill}`);
	},

	hasSkill(this: Player, skill: string, arg2?: SkillQueryMode, arg3?: boolean | null, arg4?: boolean): boolean {
		if (skill === "counttrigger") {
			return true;
		}
		return game.expandSkills(this.getSkills(arg2, arg3, arg4)).includes(skill);
	},

	hasStockSkill(this: Player, skill: string, arg1?: boolean | null, arg2?: boolean | null, arg3?: boolean | null): boolean {
		return game.expandSkills(this.getStockSkills(arg1, arg2, arg3)).includes(skill);
	},

	hasZhuSkill(this: Player, skill: string, player?: Player): boolean {
		if (!this.hasSkill(skill)) {
			return false;
		}
		if (player) {
			const mode = get.mode();
			if (mode == "identity" && _status.mode == "purple") {
				if (this.identity.slice(0, 1) != player.identity.slice(0, 1)) {
					return false;
				}
			}
			if (mode == "versus" && (_status.mode == "four" || _status.mode == "guandu")) {
				if (this.side != player.side) {
					return false;
				}
			}
		}
		return true;
	},

	hasGlobalTag(this: Player, tag: string, arg?: any): boolean {
		const skills = lib.skill.global.slice(0);
		game.expandSkills(skills);
		for (let i = 0; i < skills.length; i++) {
			const info = getRegisteredSkill(lib.skill, skills[i]);
			if (info && info.ai) {
				if (info.ai.skillTagFilter && info.ai[tag] && info.ai.skillTagFilter(this, tag, arg) === false) {
					continue;
				}
				if (typeof info.ai[tag] == "string") {
					if (info.ai[tag] == arg) {
						return true;
					}
				} else if (info.ai[tag]) {
					return true;
				}
			}
		}
		return false;
	},

	hasSkillTag(this: Player, tag: string, hidden?: SkillQueryMode, arg?: Parameters<NonNullable<SkillAI["skillTagFilter"]>>[2], globalskill?: boolean): boolean {
		const skills = this.getSkills(hidden);
		if (globalskill !== false) {
			skills.addArray(lib.skill.global);
		}
		game.expandSkills(skills);
		for (let i = 0; i < skills.length; i++) {
			const info = getRegisteredSkill(lib.skill, skills[i]);
			if (info && info.ai) {
				if (info.ai.skillTagFilter && info.ai[tag]) {
					if (info.ai.skillTagFilter(this, tag, arg) === false) {
						continue;
					}
				}
				if (info.ai[tag] === true) {
					if (typeof arg === "object" && arg && !info.ai.skillTagFilter) {
						console.log(`疑似忘给lib.skill.${skills[i]}.ai.${tag}加skillTagFilter了\nhasSkillTag：`, arg);
					}
					return true;
				} else if (typeof info.ai[tag] !== "undefined") {
					if (typeof arg !== typeof info.ai[tag]) {
						console.warn(`lib.skill.${skills[i]}.ai.${tag}类型不符\nhasSkillTag：`, arg);
					}
					if (info.ai[tag] == arg) {
						// 全凭"=="大人的包容
						return true;
					}
				}
			}
		}
		return false;
	},
};

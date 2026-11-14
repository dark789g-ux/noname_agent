import { _status, game, get, lib } from "noname";
import { getRegisteredSkill } from "../../../skillRegistry.js";
import type { GameEvent } from "../../gameEvent.js";
import type { Player } from "../../player.js";
import type { StoredTempSkillExpire, TempSkillExpire } from "../contracts/instanceFieldsContract.js";

type ChangeSkillsEvent = GameEvent & {
	addSkill?: string[];
	removeSkill?: string[];
	$handle?: (player: Player, addSkills: string[], removeSkills: string[]) => void;
};

export const skillAdditionalAndTempMethods = {
	addInvisibleSkill(this: Player, skill: string | string[]): void {
		if (Array.isArray(skill)) {
			_status.event.clearStepCache();
			for (let i = 0; i < skill.length; i++) {
				this.addInvisibleSkill(skill[i]);
			}
		} else {
			if (this.invisibleSkills.includes(skill)) {
				return;
			}
			_status.event.clearStepCache();
			const info = getRegisteredSkill(lib.skill, skill);
			if (!info) {
				return;
			}
			this.invisibleSkills.add(skill);
			this.addSkillTrigger(skill);
			if (this.awakenedSkills.includes(skill)) {
				this.awakenSkill(skill);
				return;
			}
		}
	},

	removeInvisibleSkill(this: Player, skill: string | string[]): string | string[] | undefined {
		if (!skill) {
			return;
		}
		if (Array.isArray(skill)) {
			for (let i = 0; i < skill.length; i++) {
				this.removeInvisibleSkill(skill[i]);
			}
		} else {
			const info = getRegisteredSkill(lib.skill, skill);
			// eslint-disable-next-line prefer-rest-params
			if (info && info.fixed && arguments[1] !== true) {
				return skill;
			}
			game.broadcastAll(
				function (player, skill) {
					player.invisibleSkills.remove(skill);
				},
				this,
				skill
			);
			if (!this.hasSkill(skill, true)) {
				this.removeSkill(skill);
			}
		}
		return skill;
	},

	addSkills(this: Player, skill: string | string[], popup = true): GameEvent | undefined {
		if (!skill) {
			return;
		}
		return this.changeSkills(Array.isArray(skill) ? skill : [skill], [], popup);
	},

	removeSkills(this: Player, skill: string | string[], popup = true): GameEvent | undefined {
		if (!skill) {
			return;
		}
		return this.changeSkills([], Array.isArray(skill) ? skill : [skill], popup);
	},

	changeSkills(this: Player, addSkill: string[] = [], removeSkill: string[] = [], popup = true): GameEvent | undefined {
		if (!Array.isArray(addSkill) || !Array.isArray(removeSkill)) {
			console.warn(`警告：Player[${this.name}].changeSkills的参数错误，应当为数组形式。`);
			return;
		}
		const next = game.createEvent("changeSkills", false) as ChangeSkillsEvent;
		next.player = this;
		next.forceDie = true;
		next.popup = popup;
		next.addSkill = addSkill.slice(0).unique();
		next.removeSkill = removeSkill.slice(0).unique();
		next.setContent("changeSkills");
		return next;
	},

	addAdditionalSkills(this: Player, skill: string, skillsToAdd: string | string[], keep?: boolean): GameEvent {
		const normalizedSkills = typeof skillsToAdd == "string" ? [skillsToAdd] : skillsToAdd;
		if (!Array.isArray(normalizedSkills)) {
			console.warn(`警告：Player[${this.name}].addAdditionalSkills的参数错误，应当为技能字符串或数组:`, normalizedSkills);
		}
		const skillsToRemove: string[] = [];
		//如果不需要保留原本的additionalSkills，则判断要移除的技能，并移除这些技能
		if (!keep) {
			skillsToRemove.addArray(this.getRemovableAdditionalSkills(skill));
		}
		//创建对应的addSkills的事件
		const next = this.changeSkills(normalizedSkills, skillsToRemove) as ChangeSkillsEvent | undefined;
		if (!next) {
			throw new TypeError("addAdditionalSkills requires an array of skills");
		}
		next.$handle = function (player: Player, skillsToAdd: string[], skillsToRemove: string[]) {
			const currentEvent = get.event();
			if (!currentEvent) {
				throw new Error("addAdditionalSkills must run in an event context");
			}
			//先失去先前获得的衍生技能
			if (skillsToRemove.length > 0) {
				player.removeSkillLog(skillsToRemove, currentEvent.popup);
			}
			//再获得新的衍生技能
			if (skillsToAdd.length > 0) {
				game.log(
					player,
					"获得了技能",
					...skillsToAdd.map(i => {
						if (currentEvent.popup) {
							player.popup(i);
						}
						return "#g【" + get.translation(i) + "】";
					})
				);
				if (!Array.isArray(player.additionalSkills[skill])) {
					player.additionalSkills[skill] = [];
				}
				for (let i = 0; i < skillsToAdd.length; i++) {
					player.addSkill(skillsToAdd[i], null, true, true);
					player.additionalSkills[skill].push(skillsToAdd[i]);
				}
				game.broadcast(
					(player, map) => {
						player.additionalSkills = map;
					},
					player,
					player.additionalSkills
				);
				player.checkConflict();
			}
			_status.event.clearStepCache();
		};
		return next;
	},

	addAdditionalSkill(this: Player, skill: string, skillsToAdd: string | string[], keep?: boolean): Player {
		const normalizedSkills = typeof skillsToAdd == "string" ? [skillsToAdd] : skillsToAdd;
		if (!Array.isArray(normalizedSkills)) {
			console.warn(`警告：Player[${this.name}].addAdditionalSkill的参数错误，应当为技能字符串或数组:`, normalizedSkills);
		}
		const skillsToRemove: string[] = [];
		//如果不需要保留原本的additionalSkills，则判断要移除的技能，并移除这些技能
		if (!keep) {
			skillsToRemove.addArray(this.getRemovableAdditionalSkills(skill));
		}
		this.removeSkill(skillsToRemove);
		//然后处理获得技能的操作
		if (!Array.isArray(this.additionalSkills[skill])) {
			this.additionalSkills[skill] = [];
		}
		for (let i = 0; i < normalizedSkills.length; i++) {
			this.addSkill(normalizedSkills[i], null, null, true);
			this.additionalSkills[skill].push(normalizedSkills[i]);
		}
		game.broadcast(
			(player, map) => {
				player.additionalSkills = map;
			},
			this,
			this.additionalSkills
		);
		this.checkConflict();
		_status.event.clearStepCache();
		return this;
	},

	$removeAdditionalSkills(this: Player, skill: string, target?: string | boolean): void {
		const additionalSkills = this.additionalSkills[skill];
		if (Array.isArray(additionalSkills)) {
			if (typeof target === "string") {
				if (additionalSkills.includes(target)) {
					additionalSkills.remove(target);
					if (!additionalSkills.length) {
						delete this.additionalSkills[skill];
					}
				}
			} else {
				delete this.additionalSkills[skill];
			}
		}
		game.broadcast(
			(player, map) => {
				player.additionalSkills = map;
			},
			this,
			this.additionalSkills
		);
	},

	getRemovableAdditionalSkills(this: Player, skill: string, target?: string | boolean): string[] {
		const player = this;
		const removableSkills: string[] = [];
		if (this.additionalSkills[skill]) {
			const additionalSkills = this.additionalSkills[skill];
			const hasAnotherSkill = function (skillkey: string, candidate: string) {
				return Boolean(
					player.skills.includes(candidate) ||
						player.tempSkills[candidate] ||
						Object.keys(player.additionalSkills).some(key => {
							if (key === skillkey) {
								return false;
							}
							const entry: string[] | string = player.additionalSkills[key];
							if (Array.isArray(entry)) {
								return entry.includes(candidate);
							}
							return entry == candidate;
						})
				);
			};
			if (Array.isArray(additionalSkills) && typeof target == "string") {
				if (additionalSkills.includes(target)) {
					removableSkills.push(target);
				}
			} else if (Array.isArray(additionalSkills)) {
				removableSkills.addArray(additionalSkills.filter(candidate => !hasAnotherSkill(skill, candidate)));
			}
		}
		return removableSkills;
	},

	removeAdditionalSkill(this: Player, skill: string, target?: string | boolean): Player {
		const player = this;
		const skills = this.getRemovableAdditionalSkills(skill, target);
		if (skills.length) {
			player.removeSkill(skills);
		}
		player.$removeAdditionalSkills(skill, target);
		_status.event.clearStepCache();
		return this;
	},

	removeAdditionalSkills(this: Player, skill: string, target?: string | boolean): GameEvent {
		const player = this;
		const skills = this.getRemovableAdditionalSkills(skill, target);
		const next = player.changeSkills([], skills) as ChangeSkillsEvent | undefined;
		if (!next) {
			throw new TypeError("removeAdditionalSkills requires an array of skills");
		}
		next.$handle = function (player: Player, _addSkills: string[], removeSkills: string[]) {
			const currentEvent = get.event();
			if (!currentEvent) {
				throw new Error("removeAdditionalSkills must run in an event context");
			}
			if (removeSkills.length > 0) {
				player.removeSkillLog(removeSkills, currentEvent.popup);
			}
			player.$removeAdditionalSkills(skill, target);
		};
		return next;
	},

	addTempSkills(this: Player, skillsToAdd: string | string[], expire?: Signal | Signal[] | SkillTrigger): GameEvent {
		//请注意，该方法的底层实现并非tempSkill，而是additionalSkills和player.when！
		const normalizedSkills = typeof skillsToAdd == "string" ? [skillsToAdd] : skillsToAdd;
		if (!Array.isArray(normalizedSkills) || !normalizedSkills.length) {
			console.warn(`警告：Player[${this.name}].addTempSkills的参数错误，应当为技能字符串或非空数组:`, normalizedSkills);
		}
		//确定技能要被移除的时机
		let normalizedExpire: SkillTrigger;
		if (!expire) {
			normalizedExpire = { global: ["phaseAfter", "phaseBeforeStart"] };
		} else if (typeof expire == "string" || Array.isArray(expire)) {
			normalizedExpire = { global: expire };
		} else {
			normalizedExpire = expire;
		}
		const next = this.changeSkills(normalizedSkills, []) as ChangeSkillsEvent | undefined;
		if (!next) {
			throw new TypeError("addTempSkills requires an array of skills");
		}
		next.$handle = function (player: Player, addSkills: string[]) {
			const currentEvent = get.event();
			if (!currentEvent) {
				throw new Error("addTempSkills must run in an event context");
			}
			if (addSkills.length) {
				game.log(
					player,
					"获得了技能",
					...addSkills.map(i => {
						if (currentEvent.popup) {
							player.popup(i);
						}
						return "#g【" + get.translation(i) + "】";
					})
				);
				let skillName: string;
				//生成该TempSkills对应的ID
				do {
					skillName = "player_tempSkills_" + Math.random().toString(36).slice(-8);
				} while (player.additionalSkills[skillName] != null);
				player.addAdditionalSkill(skillName, normalizedSkills);
				player
					.when(normalizedExpire, false)
					.assign({
						firstDo: true,
						priority: Infinity,
					})
					.step(async (_event, _trigger, player) => {
						player.removeAdditionalSkills(skillName);
					})
					.finish();
			}
		};
		return next;
	},

	/**
	 * 添加临时技能
	 */
	addTempSkill(this: Player, skill: string | string[], expire?: TempSkillExpire, checkConflict?: boolean): string | string[] | undefined {
		if (Array.isArray(skill)) {
			for (let i = 0; i < skill.length; i++) {
				this.addTempSkill(skill[i], expire, checkConflict);
			}
		} else {
			if (this.hasSkill(skill) && this.tempSkills[skill] == undefined) {
				return;
			}
			this.addSkill(skill, checkConflict, false, true);

			let normalizedExpire: StoredTempSkillExpire;
			if (!expire) {
				normalizedExpire = { global: ["phaseAfter", "phaseBeforeStart"] };
			} else if (typeof expire == "string" || Array.isArray(expire)) {
				normalizedExpire = { global: expire };
			} else {
				normalizedExpire = expire;
			}
			this.tempSkills[skill] = normalizedExpire;
			const map = lib.relatedTrigger;
			const names = Object.keys(map);
			if (typeof normalizedExpire !== "function" && get.objtype(normalizedExpire) == "object") {
				const roles = ["player", "source", "target", "global"] as const;
				for (const i of roles) {
					const raw = normalizedExpire[i];
					const triggers: (Signal | undefined)[] = Array.isArray(raw) ? raw : [raw];
					triggers.forEach(trigger => {
						lib.hookmap[String(trigger)] = true;
						const key = names.find(name => trigger?.startsWith(name));
						if (key && trigger) {
							map[key].forEach((rawTrigger: string) => {
								lib.hookmap[`${rawTrigger}${trigger.slice(key.length)}`] = true;
							});
						}
					});
				}
			}
			game.broadcast(
				(player, map) => {
					player.tempSkills = map;
				},
				this,
				this.tempSkills
			);
		}
		return skill;
	},
};

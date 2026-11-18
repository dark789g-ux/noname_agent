import { _status, game, get, lib } from "noname";
import { getRegisteredSkill, requireRegisteredSkill } from "../../../skillRegistry.js";
import type { GameEvent } from "../../gameEvent.js";
import type { Player } from "../../player.js";
import { requireParentEvent } from "../dom/nodeGuards.js";

export const skillStateAndMechanicsMethods = {
	/**
	 * 是否拥有对应战法
	 */
	hasZhanfa(this: Player, id: string): boolean {
		return this.getStorage("zhanfa").includes(id);
	},

	/**
	 * 获得对应战法
	 */
	addZhanfa(this: Player, id: string): void {
		const skill = lib.zhanfa.getSkill(id);
		if (!skill) {
			console.warn(`不存在战法: ${id}`);
			return;
		} else if (this.hasZhanfa(id)) {
			return;
		}
		game.log(this, "获得战法", `#g【${get.translation(id)}】`);
		const card = game.createCard(id, "战法", "");
		this.$draw(card, void 0, void 0, false);
		this.addAdditionalSkill("zhanfa", skill, true);
		this.markAuto("zhanfa", id);
		const next = game.createEvent("addZhanfa", false, get.event()) as GameEvent & { zhanfaId?: string };
		next.player = this;
		next.zhanfaId = id;
		next.forceDie = true;
		next.includeOut = true;
		next.setContent(async event => {
			await event.trigger(event.name);
		});
	},

	/**
	 * 失去对应战法
	 */
	removeZhanfa(this: Player, id: string): void {
		const skill = lib.zhanfa.getSkill(id);
		if (!skill) {
			console.warn(`不存在战法: ${id}`);
			return;
		} else if (!this.hasZhanfa(id)) {
			return;
		}
		game.log(this, "失去战法", `#g【${get.translation(id)}】`);
		const card = game.createCard(id, "战法", "");
		this.$throw(card, 1000, void 0, void 0, false);
		this.removeAdditionalSkill("zhanfa", skill);
		this.unmarkAuto("zhanfa", id);
		const next = game.createEvent("removeZhanfa", false, get.event()) as GameEvent & { zhanfaId?: string };
		next.player = this;
		next.zhanfaId = id;
		next.forceDie = true;
		next.includeOut = true;
		next.setContent(async event => {
			await event.trigger(event.name);
		});
	},

	changeZhuanhuanji(this: Player, skill: string): void {
		const info = get.info(skill);
		const zhuanhuan = info.zhuanhuanji;
		if (typeof zhuanhuan == "function") {
			zhuanhuan(this, skill);
		} else if (zhuanhuan == "number") {
			this.addMark(skill, 1, false);
		} else {
			this.storage[skill] = !this.storage[skill];
		}
		game.broadcastAll(
			function (player, skill) {
				player.$changeZhuanhuanji(skill);
			},
			this,
			skill
		);
		const player = this;
		const evt = _status.event;
		//转换技转换后
		const next = game.createEvent("changeZhuanhuanji", false) as GameEvent & { log_event?: unknown };
		next.player = player;
		next.forceDie = true;
		next.includeOut = true;
		next.skill = skill;
		evt.next.remove(next);
		const logEvent = evt.logSkill || evt.name?.startsWith("pre_") ? evt.getParent() : evt;
		next.log_event = logEvent;
		requireParentEvent(logEvent).after.push(next);
		next.setContent("emptyEvent");
		//转换技转换时
		const next2 = game.createEvent("changeZhuanhuanjiBegin", false, get.event()) as GameEvent & { log_event?: unknown };
		next2.player = player;
		next2.forceDie = true;
		next2.includeOut = true;
		next2.skill = skill;
		next2.log_event = logEvent;
		next2.setContent("emptyEvent");
	},

	$changeZhuanhuanji(this: Player, skill: string): void {
		const mark = this.marks[skill];
		if (mark) {
			const info = requireRegisteredSkill(lib.skill, skill);
			if (info.$zhuanhuanji) {
				info.$zhuanhuanji(skill, this);
				return;
			}
			const zhuanhuanLimit = get.zhuanhuanItemNum(skill, this);
			const firstChild = mark.firstChild as HTMLElement & { reversed?: number };
			if (typeof firstChild.reversed != "number") {
				firstChild.reversed = 0;
			}
			firstChild.reversed += 360 / zhuanhuanLimit;
			firstChild.style.transform = "rotate(" + parseFloat(String(firstChild.reversed)) + "deg)";
		}
	},

	/**
	 * 批量重置技能
	 */
	refreshSkill(this: Player, skills?: string | string[]): string[] {
		const player = this;
		let targetSkills = skills;
		if (!targetSkills) {
			targetSkills = game.expandSkills(player.getStockSkills(true, true));
		}
		if (typeof targetSkills == "string") {
			targetSkills = [targetSkills];
		}
		if (!Array.isArray(targetSkills) || !targetSkills?.length) {
			return [];
		}
		const resetSkills: string[] = [];
		const suffixs = ["used", "round", "block", "blocker", "sunben"];
		for (const skill of targetSkills) {
			const info = get.info(skill);
			if (info.usable !== undefined) {
				if (typeof player.getStat("triggerSkill")[skill] == "number" && player.getStat("triggerSkill")[skill] >= 1) {
					delete player.getStat("triggerSkill")[skill];
					resetSkills.add(skill);
				}
				if (typeof player.getStat("skill")[skill] == "number" && player.getStat("skill")[skill] >= 1) {
					delete player.getStat("skill")[skill];
					resetSkills.add(skill);
				}
			}
			if (info.round && player.storage[skill + "_roundcount"]) {
				delete player.storage[skill + "_roundcount"];
				player.unmarkSkill(skill + "_roundcount");
				resetSkills.add(skill);
			}
			if (player.storage[`temp_ban_${skill}`]) {
				delete player.storage[`temp_ban_${skill}`];
				resetSkills.add(skill);
			}
			if (player.awakenedSkills.includes(skill)) {
				player.restoreSkill(skill);
				resetSkills.add(skill);
			}
			for (const suffix of suffixs) {
				if (player.hasSkill(skill + "_" + suffix)) {
					player.removeSkill(skill + "_" + suffix);
					resetSkills.add(skill);
				}
			}
		}
		if (resetSkills.length) {
			let str = "";
			for (const i of resetSkills) {
				str += "【" + get.translation(i) + "】、";
			}
			game.log(player, "重置了技能", "#g" + str.slice(0, -1));
		}
		return resetSkills;
	},

	awakenSkill(this: Player, skill: string, nounmark?: boolean): Player {
		if (!nounmark) {
			this.unmarkSkill(skill);
		}
		this.disableSkill(skill + "_awake", skill);
		this.awakenedSkills.add(skill);
		if (this.storage[skill] === undefined || this.storage[skill] === false) {
			this.storage[skill] = true;
		}
		_status.event.clearStepCache();
		return this;
	},

	awakenQidingSkill(this: Player, skill: string): Player | undefined {
		if (this.storage[skill]) {
			return;
		}
		if (this.storage[skill] === undefined || this.storage[skill] === false) {
			this.storage[skill] = true;
		}
		game.log(`契约已成，${get.translation(this)}将【${get.translation(skill)}】改为锁定技。`);
		_status.event.clearStepCache();
		return this;
	},

	restoreSkill(this: Player, skill: string, nomark?: boolean): Player {
		if (this.storage[skill] === true) {
			this.storage[skill] = false;
		}
		this.awakenedSkills.remove(skill);
		this.enableSkill(skill + "_awake");
		if (!nomark && this.hasSkill(skill, null, null, false)) {
			this.markSkill(skill);
		}
		_status.event.clearStepCache();
		return this;
	},

	disableSkill(this: Player, skill: string, skills: string | string[]): Player {
		if (typeof skills == "string") {
			if (!this.disabledSkills[skills]) {
				this.disabledSkills[skills] = [];
				const info = get.info(skills);
				if (info.ondisable && info.onremove) {
					if (typeof info.onremove == "function") {
						info.onremove(this, skill);
					} else if (typeof info.onremove == "string") {
						if (info.onremove == "storage") {
							delete this.storage[skill];
						} else {
							let cards = this.storage[skill];
							if (get.itemtype(cards) == "card") {
								cards = [cards];
							}
							if (get.itemtype(cards) == "cards") {
								if (info.onremove == "discard") {
									this.$throw(cards);
								}
								if (info.onremove == "discard" || info.onremove == "lose") {
									game.cardsDiscard(cards);
									delete this.storage[skill];
								}
							}
						}
					} else if (Array.isArray(info.onremove)) {
						for (let i = 0; i < info.onremove.length; i++) {
							delete this.storage[info.onremove[i]];
						}
					} else if (info.onremove === true) {
						delete this.storage[skill];
					}
				}
			}
			this.disabledSkills[skills] ??= [];
			this.disabledSkills[skills].add(skill);
			const group = requireRegisteredSkill(lib.skill, skills).group;
			if (typeof group == "string" || Array.isArray(group)) {
				this.disableSkill(skill, group);
			}
		} else if (Array.isArray(skills)) {
			for (let i = 0; i < skills.length; i++) {
				this.disableSkill(skill, skills[i]);
			}
		}
		_status.event.clearStepCache();
		return this;
	},

	enableSkill(this: Player, skill: string): Player {
		for (const i in this.disabledSkills) {
			this.disabledSkills[i].remove(skill);
			if (this.disabledSkills[i].length == 0) {
				delete this.disabledSkills[i];
			}
		}
		_status.event.clearStepCache();
		return this;
	},

	tempBanSkill<T extends string | string[]>(this: Player, skill: T, expire?: Signal | Signal[] | SkillTrigger | "forever" | false, log?: boolean): T | undefined {
		if (Array.isArray(skill)) {
			for (let i = 0; i < skill.length; i++) {
				this.tempBanSkill(skill[i], expire, log);
			}
		} else {
			if (this.isTempBanned(skill)) {
				return;
			}
			this.setStorage(`temp_ban_${skill}`, true);

			if (log !== false && this.hasSkill(skill)) {
				game.log(this, "的技能", `#g【${get.translation(skill)}】`, "暂时失效了");
			}

			if (expire !== "forever") {
				let normalizedExpire: SkillTrigger;
				if (!expire) {
					normalizedExpire = { global: ["phaseAfter", "phaseBeforeStart"] };
				} else if (typeof expire == "string" || Array.isArray(expire)) {
					normalizedExpire = { global: expire };
				} else {
					normalizedExpire = expire;
				}
				this.when(normalizedExpire, false)
					.assign({
						firstDo: true,
					})
					.step(async (_event, _trigger, player) => {
						delete player.storage[`temp_ban_${skill}`];
					})
					.finish();
			}
		}
		return skill;
	},

	clearSkills(this: Player, all?: boolean, ...skills: string[]): GameEvent | string[] | undefined {
		if (!all) {
			return this.removeSkills(this.getSkills(null, false, false).removeArray(skills));
		}
		const list = this.skills.filter(skill => {
			return !getRegisteredSkill(lib.skill, skill)?.superCharlotte && !skills.includes(skill);
		});
		for (const i in this.additionalSkills) {
			this.removeAdditionalSkill(i);
		}
		this.removeSkill(list);
		this.checkConflict();
		this.checkMarks();
		return list;
	},

	checkConflict(this: Player, skill?: string): void {
		if (skill) {
			if (this.forbiddenSkills[skill]) {
				delete this.forbiddenSkills[skill];
			} else {
				for (const i in this.forbiddenSkills) {
					if (this.forbiddenSkills[i].includes(skill)) {
						this.forbiddenSkills[i].remove(skill);
						if (!this.forbiddenSkills[i].length) {
							delete this.forbiddenSkills[i];
						}
					}
				}
			}
		} else {
			this.forbiddenSkills = {};
			const forbid: string[][] = [];
			const getName = function (arr: string[]) {
				let str = "";
				for (let i = 0; i < arr.length; i++) {
					str += arr[i] + "+";
				}
				return str.slice(0, str.length - 1);
			};
			const forbidlist: string[][] = lib.config.forbid.concat(lib.config.customforbid);
			const skills = this.getSkills();
			for (let i = 0; i < forbidlist.length; i++) {
				if (lib.config.customforbid.includes(forbidlist[i]) || !lib.config.forbidlist.includes(getName(forbidlist[i]))) {
					let j = 0;
					for (; j < forbidlist[i].length; j++) {
						if (!skills.includes(forbidlist[i][j])) {
							break;
						}
					}
					if (j == forbidlist[i].length) {
						forbid.push(forbidlist[i]);
					}
				}
			}
			for (let i = 0; i < forbid.length; i++) {
				if (forbid[i][1] || this.name2) {
					this.forbiddenSkills[forbid[i][0]] = this.forbiddenSkills[forbid[i][0]] || [];
					if (forbid[i][1]) {
						this.forbiddenSkills[forbid[i][0]].add(forbid[i][1]);
					}
				}
			}
		}
	},
};

import { _status, game, get, lib, ui } from "noname";
import { getRegisteredSkill } from "../../../skillRegistry.js";
import type { Player } from "../../player.js";

export const skillCoreMutationMethods = {
	addSkillTrigger(this: Player, skills: string | string[], hidden?: boolean, triggeronly?: boolean): Player {
		const skillList = typeof skills == "string" ? [skills] : skills;
		game.expandSkills(skillList);
		for (const skill of skillList) {
			const info = getRegisteredSkill(lib.skill, skill);
			if (!info) {
				console.error(new ReferenceError(`Cannot find ${skill} in lib.skill, failed to add ${skill}'s trigger to ${this.name}`));
				continue;
			}
			if (!triggeronly) {
				if (info.global && (!hidden || info.globalSilent)) {
					let global = info.global;
					if (!Array.isArray(global)) {
						global = [global];
					}
					global.forEach(globalSkill => game.addGlobalSkill(globalSkill, this));
				}
				if (this.initedSkills.includes(skill)) {
					continue;
				}
				this.initedSkills.push(skill);
				if (info.init /* && !_status.video */) {
					info.init(this, skill);
				}
			}
			if (info.trigger && this.playerid) {
				const setTrigger = (role: string, evt: string) => {
					const name = this.playerid + "_" + role + "_" + evt;
					if (!lib.hook[name]) {
						lib.hook[name] = [];
					}
					lib.hook[name].add(skill);
					lib.hookmap[evt] = true;
				};
				const map = lib.relatedTrigger;
				const names = Object.keys(map);
				for (const role in info.trigger) {
					let evts: string | string[] = info.trigger[role as keyof SkillTrigger] as string | string[];
					if (!Array.isArray(evts)) {
						evts = [evts];
					}
					evts.forEach(evt => {
						names
							.reduce<string[]>((list, i) => {
								if (evt.startsWith(i)) {
									return list.addArray(map[i].map((j: string) => j + evt.slice(i.length)));
								}
								return list;
							}, [])
							.forEach(evtx => setTrigger(role, evtx));
						setTrigger(role, evt);
					});
				}
			}
			if (info.hookTrigger) {
				if (!this._hookTrigger) {
					this._hookTrigger = [];
				}
				this._hookTrigger.add(skill);
			}
			if (_status.event && _status.event.addTrigger) {
				_status.event.addTrigger(skill, this);
			}
			_status.event.clearStepCache();
		}
		return this;
	},

	addSkillLog(this: Player, skill: string | string[], popup = true): Player | undefined {
		if (!skill) {
			return this;
		}
		this.addSkill(skill);
		const list = Array.isArray(skill) ? skill : [skill];
		game.log(
			this,
			"获得了技能",
			...list.map(i => {
				if (popup) {
					this.popup(i);
				}
				return "#g【" + get.translation(i) + "】";
			})
		);
	},

	removeSkillLog(this: Player, skill: string | string[], popup = true): Player | undefined {
		if (!skill) {
			return this;
		}
		this.removeSkill(skill);
		const list = Array.isArray(skill) ? skill : [skill];
		game.log(
			this,
			"失去了技能",
			...list.map(i => {
				if (popup) {
					this.popup(i);
				}
				return "#g【" + get.translation(i) + "】";
			})
		);
	},

	addSkill(this: Player, skill: string | string[], checkConflict?: boolean | null, nobroadcast?: boolean | null, addToSkills?: boolean | null): string | string[] | undefined {
		if (Array.isArray(skill)) {
			_status.event.clearStepCache();
			for (let i = 0; i < skill.length; i++) {
				this.addSkill(skill[i]);
			}
		} else {
			if (skill === "counttrigger" || this.skills.includes(skill)) {
				return;
			}
			_status.event.clearStepCache();
			const info = getRegisteredSkill(lib.skill, skill);
			if (!info) {
				return;
			}
			if (!addToSkills) {
				this.skills.add(skill);
				if (!nobroadcast) {
					game.broadcast(
						function (player, skill) {
							player.skills.add(skill);
						},
						this,
						skill
					);
				}
			}
			this.addSkillTrigger(skill);
			if (this.awakenedSkills.includes(skill)) {
				this.awakenSkill(skill);
				return;
			}
			if (info.init2 /** && !_status.video */) {
				info.init2(this, skill);
			}
			if (info.mark) {
				if (info.mark == "card" && get.itemtype(this.storage[skill]) == "card") {
					this.markSkill(skill, null, this.storage[skill], nobroadcast ?? undefined);
				} else if (info.mark == "card" && get.itemtype(this.storage[skill]) == "cards") {
					this.markSkill(skill, null, this.storage[skill][0], nobroadcast ?? undefined);
				} else if (info.mark == "image") {
					this.markSkill(skill, null, ui.create.card(null, "noclick").init([null, null, skill]), nobroadcast ?? undefined);
				} else if (info.mark == "character") {
					const skillIntro = info.intro;
					let introContent: string | undefined;
					const content = skillIntro?.content;
					if (typeof content == "function") {
						const renderedContent = content(this.storage[skill], this, skill);
						if (typeof renderedContent == "string") {
							introContent = renderedContent;
						}
					} else if (typeof content == "string") {
						introContent = content.replace(/#/g, this.storage[skill]);
						introContent = introContent.replace(/&/g, String(get.cnNumber(this.storage[skill])));
						introContent = introContent.replace(/\$/g, get.translation(this.storage[skill]));
					}
					let caption: string;
					const introName = skillIntro?.name;
					if (typeof introName == "function") {
						caption = introName(this.storage[skill], this, skill);
					} else if (typeof introName == "string") {
						caption = info.name ?? "";
					} else {
						caption = get.translation(skill);
					}
					this.markSkillCharacter(skill, this.storage[skill], caption, introContent, nobroadcast ?? undefined);
				} else {
					this.markSkill(skill, null, null, nobroadcast ?? undefined);
				}
			}
			game.callHook("addSkillCheck", [skill, this]);
		}
		if (checkConflict) {
			this.checkConflict();
		}
		return skill;
	},

	removeSkillTrigger(this: Player, skills: string | string[], triggeronly?: boolean): Player {
		const skillList = typeof skills == "string" ? [skills] : skills;
		game.expandSkills(skillList);
		for (const skill of skillList) {
			const info = getRegisteredSkill(lib.skill, skill);
			if (!info) {
				console.error(new ReferenceError(`Cannot find ${skill} in lib.skill, failed to remove ${skill}'s trigger to ${this.name}`));
				continue;
			}
			if (!triggeronly) {
				if (info.global) {
					let global = info.global;
					if (!Array.isArray(global)) {
						global = [global];
					}
					global.forEach(globalSkill => game.removeGlobalSkill(globalSkill, this));
				}
				if (!this.initedSkills.includes(skill)) {
					continue;
				}
				this.initedSkills.remove(skill);
				// if(info.onremove&&!_status.video) info.onremove(this,skill);
			}
			if (info.trigger && this.playerid) {
				const removeTrigger = (role: string, evt: string) => {
					const name = this.playerid + "_" + role + "_" + evt;
					if (!lib.hook[name]) {
						return;
					}
					lib.hook[name].remove(skill);
					if (lib.hook[name].length == 0) {
						delete lib.hook[name];
					}
				};
				const map = lib.relatedTrigger;
				const names = Object.keys(map);
				for (const role in info.trigger) {
					let evts: string | string[] = info.trigger[role as keyof SkillTrigger] as string | string[];
					if (!Array.isArray(evts)) {
						evts = [evts];
					}
					evts.forEach(evt => {
						names
							.reduce<string[]>((list, i) => {
								if (evt.startsWith(i)) {
									return list.addArray(map[i].map((j: string) => j + evt.slice(i.length)));
								}
								return list;
							}, [])
							.forEach(evtx => removeTrigger(role, evtx));
						removeTrigger(role, evt);
					});
				}
			}
			if (info.hookTrigger && this._hookTrigger) {
				this._hookTrigger.remove(skill);
				if (!this._hookTrigger.length) {
					delete this._hookTrigger;
				}
			}
			if (_status.event && _status.event.removeTrigger) {
				_status.event.removeTrigger(skill, this);
			}
			_status.event.clearStepCache();
		}
		return this;
	},

	removeSkill(this: Player, skill: string | string[]): string | string[] | undefined {
		if (!skill) {
			return;
		}
		_status.event.clearStepCache();
		if (Array.isArray(skill)) {
			for (let i = 0; i < skill.length; i++) {
				this.removeSkill(skill[i]);
			}
		} else {
			if (skill === "counttrigger") {
				this.stat[this.stat.length - 1].triggerSkill = {};
				return;
			} else {
				const info = getRegisteredSkill(lib.skill, skill);
				// eslint-disable-next-line prefer-rest-params
				if (info?.fixed && arguments[1] !== true) {
					return skill;
				}
				this.unmarkSkill(skill);
				game.broadcastAll(
					function (player, skill) {
						player.skills.remove(skill);
						player.hiddenSkills.remove(skill);
						player.invisibleSkills.remove(skill);
						delete player.tempSkills[skill];
						for (let i in player.additionalSkills) {
							player.additionalSkills[i].remove(skill);
						}
					},
					this,
					skill
				);
				this.checkConflict(skill);
				if (info) {
					if (info.onremove) {
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
					this.removeSkillTrigger(skill);
					if (!info.keepSkill) {
						this.removeAdditionalSkills(skill);
					}
				}
				this.enableSkill(skill + "_awake");
				game.callHook("removeSkillCheck", [skill, this]);
			}
		}
		return skill;
	},
};

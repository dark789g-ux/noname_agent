import type { Card, GameEvent, Player } from "../../index.js";
import type { SubPlayerConfig, TempSkillExpire } from "./instanceFieldsContract.js";

export type SkillQueryMode = boolean | "e" | "invisible" | null;

export type AddSubPlayerConfig = SubPlayerConfig & {
	caption?: string;
	image?: string | string[];
	es?: Card[];
	skill?: string;
	source?: string;
	onremove?: (player: Player, skill?: string) => void;
};

declare module "../../player.js" {
	interface Player {
		// skill/when.ts (1)
		when(triggerName: Signal | Signal[] | SkillTrigger, instantlyAdd?: boolean): When & { skill: string };

		// skill/query.ts (14)
		addSkillBlocker(skill: string): void;
		removeSkillBlocker(skill: string): void;
		getStockSkills(unowned?: boolean | null, unique?: boolean | null, hidden?: boolean | null): string[];
		getHiddenSkills(unowned?: boolean | null, unique?: boolean | null): string[];
		getGainableSkills(func?: (info: any, skill: string, character: string) => boolean): string[];
		getOriginalSkills(): string[];
		getModableSkills(): string[];
		getSkills(skillMode?: SkillQueryMode, includeEquipSkills?: boolean | null, applySkillFilter?: boolean): string[];
		isTempBanned(skill: string): boolean;
		hasSkill(skill: string, arg2?: SkillQueryMode, arg3?: boolean | null, arg4?: boolean): boolean;
		hasStockSkill(skill: string, arg1?: boolean | null, arg2?: boolean | null, arg3?: boolean | null): boolean;
		hasZhuSkill(skill: string, player?: Player): boolean;
		hasGlobalTag(tag: string, arg?: any): boolean;
		hasSkillTag(tag: string, hidden?: SkillQueryMode, arg?: Parameters<NonNullable<SkillAI["skillTagFilter"]>>[2], globalskill?: boolean): boolean;

		// skill/coreMutation.ts (6)
		addSkillTrigger(skills: string | string[], hidden?: boolean, triggeronly?: boolean): this;
		addSkillLog(skill: string | string[], popup?: boolean): this | undefined;
		removeSkillLog(skill: string | string[], popup?: boolean): this | undefined;
		addSkill<T extends string | string[]>(skill: T, checkConflict?: boolean | null, nobroadcast?: boolean | null, addToSkills?: boolean | null): T | undefined;
		removeSkillTrigger(skills: string | string[], triggeronly?: boolean): this;
		removeSkill<T extends string | string[]>(skill: T, force?: boolean): T | undefined;

		// skill/additionalAndTemp.ts (13)
		addInvisibleSkill(skill: string | string[]): void;
		removeInvisibleSkill<T extends string | string[]>(skill: T, force?: boolean): T | undefined;
		addSkills(skill: string | string[], popup?: boolean): GameEvent | undefined;
		removeSkills(skill: string | string[], popup?: boolean): GameEvent | undefined;
		changeSkills(addSkill?: string[], removeSkill?: string[], popup?: boolean): GameEvent | undefined;
		addAdditionalSkills(skill: string, skillsToAdd: string | string[], keep?: boolean): GameEvent;
		addAdditionalSkill(skill: string, skillsToAdd: string | string[], keep?: boolean): this;
		$removeAdditionalSkills(skill: string, target?: string | boolean): void;
		getRemovableAdditionalSkills(skill: string, target?: string | boolean): string[];
		removeAdditionalSkill(skill: string, target?: string | boolean): this;
		removeAdditionalSkills(skill: string, target?: string | boolean): GameEvent;
		addTempSkills(skillsToAdd: string | string[], expire?: Signal | Signal[] | SkillTrigger): GameEvent;
		addTempSkill<T extends string | string[]>(skill: T, expire?: TempSkillExpire, checkConflict?: boolean): T | undefined;

		// skill/stateAndMechanics.ts (14)
		hasZhanfa(id: string): boolean;
		addZhanfa(id: string): void;
		removeZhanfa(id: string): void;
		changeZhuanhuanji(skill: string): void;
		$changeZhuanhuanji(skill: string): void;
		refreshSkill(skills?: string | string[]): string[];
		awakenSkill(skill: string, nounmark?: boolean): this;
		awakenQidingSkill(skill: string): this | undefined;
		restoreSkill(skill: string, nomark?: boolean): this;
		disableSkill(skill: string, skills: string | string[]): this;
		enableSkill(skill: string): this;
		tempBanSkill<T extends string | string[]>(skill: T, expire?: Signal | Signal[] | SkillTrigger | "forever" | false, log?: boolean): T | undefined;
		clearSkills(all?: false, ...skills: string[]): GameEvent | undefined;
		clearSkills(all: true, ...skills: string[]): string[];
		clearSkills(all?: boolean, ...skills: string[]): GameEvent | string[] | undefined;
		checkConflict(skill?: string): void;

		// skill/subPlayerAndLog.ts (7)
		logSkill(name: string | string[], targets?: false | Player | Player[] | null, nature?: string | boolean | { color: number[] } | null, logv?: boolean | null, args?: any): void;
		addSubPlayer(cfg: AddSubPlayerConfig): string;
		removeSubPlayer(name: string): void;
		callSubPlayer(result?: any): GameEvent | undefined;
		toggleSubPlayer(result?: any): GameEvent | undefined;
		exitSubPlayer(remove?: boolean): GameEvent;
		getSubPlayers(tag?: string): string[];
	}
}

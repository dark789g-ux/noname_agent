export type SkillRegistryMeta = {
	global: string[];
	globalmap: Record<string, Player[]>;
};

export type SkillRegistryEntry = Skill | SkillRegistryMeta[keyof SkillRegistryMeta];

export type SkillRegistry = SkillRegistryMeta & {
	[name: string]: SkillRegistryEntry;
	[name: symbol]: Skill | undefined;
};

export type BuiltinSkillName =
	| "equipEnable"
	| "stratagem_fury"
	| "_stratagem_add_buff"
	| "expandedSlots"
	| "nocount"
	| "zf_anyDamage"
	| "zf_anyGain"
	| "zf_phaseDraw"
	| "zf_anyDraw"
	| "zf_cardDamage"
	| "zf_maxHandcard"
	| "zf_cardUsable"
	| "zf_directDamage"
	| "zf_directGain"
	| "zf_onAdd"
	| "zf_loseMaxHp"
	| "zf_extraEff"
	| "zhanfa"
	| "danqi_hufu"
	| "charge"
	| "cooperation"
	| "zhengsu"
	| "renku"
	| "_showHiddenCharacter"
	| "_kamisha"
	| "_doublegroup_choice"
	| "aozhan"
	| "storage"
	| "undist"
	| "others"
	| "zhu"
	| "zhuSkill"
	| "land_used"
	| "unequip"
	| "subplayer"
	| "autoswap"
	| "dualside"
	| "fengyin"
	| "baiban"
	| "qianxing"
	| "mianyi"
	| "mad"
	| "ghujia"
	| "_usecard"
	| "_discard"
	| "_ismin"
	| "_recasting"
	| "_lianhuan"
	| "_lianhuan4"
	| "_rest_return"
	| "_chongzhu"
	| "dongcha"
	| "sheshen"
	| "identity_mingcha"
	| "_sxrm_connect";

export type BuiltinSkillRegistry = SkillRegistryMeta & Record<BuiltinSkillName, Skill>;

/**
 * Validates every finite built-in entry while preserving object identity and
 * initialization order for the dynamic registry proxy.
 */
export function defineBuiltinSkills(skills: BuiltinSkillRegistry): BuiltinSkillRegistry {
	return skills;
}

/** Reads an ordinary skill without exposing the two registry metadata entries. */
export function getRegisteredSkill(registry: SkillRegistry, name: string | symbol): Skill | undefined {
	if (typeof name === "string") {
		if (name === "global" || name === "globalmap") {
			return;
		}
		const entry = registry[name];
		if (Array.isArray(entry)) {
			throw new TypeError(`Non-metadata skill entry must not be an array: ${name}`);
		}
		return entry;
	}
	return registry[name];
}

/** A call site that previously required a skill keeps its fail-fast behavior. */
export function requireRegisteredSkill(registry: SkillRegistry, name: string | symbol): Skill {
	const skill = getRegisteredSkill(registry, name);
	if (!skill) {
		throw new TypeError(`Expected registered skill: ${String(name)}`);
	}
	return skill;
}

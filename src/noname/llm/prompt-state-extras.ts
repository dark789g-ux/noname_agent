export interface PromptMarkState {
	id: string;
	name: string;
	count?: number | string;
}

export interface PromptExtraZoneState {
	zone: "x" | "s";
	label: string;
	totalCount: number;
	visibleCards: string[];
	hiddenCount: number;
}

export interface PromptSkillState {
	skill: string;
	name: string;
	kind: "zhuanhuanji" | "limited" | "juexingji";
	status: string;
}

export interface PromptExtraState {
	marks?: PromptMarkState[];
	extraZones?: PromptExtraZoneState[];
	skillStates?: PromptSkillState[];
}

const ZONE_LABELS: Array<{ zone: "x" | "s"; label: string }> = [
	{ zone: "x", label: "武将牌上(x区)" },
	{ zone: "s", label: "特殊区(s区)" },
];

export function collectPlayerMarks(
	player: any,
	options: {
		translate(value: unknown): string;
		getSkillMeta(skill: string): { intro?: { nocount?: boolean; markcount?: unknown } } | undefined;
	}
): PromptMarkState[] {
	const markKeys = Object.keys(player?.marks || {});
	const marks: PromptMarkState[] = [];
	for (const key of markKeys) {
		if (!key || key === "ghujia") continue;
		const count = resolveMarkCount(player, key, options.getSkillMeta(key));
		const name = options.translate(key) || key;
		marks.push(count !== undefined ? { id: key, name, count } : { id: key, name });
	}
	return marks;
}

function resolveMarkCount(
	player: any,
	key: string,
	meta: { intro?: { nocount?: boolean; markcount?: unknown } } | undefined
): number | string | undefined {
	if (meta?.intro?.nocount) return undefined;
	const storageValue = player?.storage?.[key];
	const markcount = meta?.intro?.markcount;
	try {
		if (typeof markcount === "function") {
			const val = markcount(storageValue, player, key);
			if (typeof val === "number" || typeof val === "string") return val === Infinity ? "∞" : val;
		} else if (markcount === "expansion") {
			const expCount = Number(player?.countCards?.("x", (c: any) => c?.hasGaintag?.(key)) ?? 0);
			if (expCount > 0) return expCount;
		}
	} catch {
		// 忽略单个标记自定义计数异常
	}
	const override = player?.storage?.[`${key}_markcount`];
	if (typeof override === "number") return override;
	if (typeof storageValue === "number") return storageValue === Infinity ? "∞" : storageValue;
	if (Array.isArray(storageValue)) return storageValue.length;
	const fallback = player?.countMark?.(key);
	return typeof fallback === "number" && fallback > 0 ? fallback : undefined;
}

export function collectExtraZones(
	player: any,
	observer: any,
	options: {
		getCardName(card: any): string;
		isCardKnown?(card: any, observer: any): boolean;
	}
): PromptExtraZoneState[] {
	const result: PromptExtraZoneState[] = [];
	for (const { zone, label } of ZONE_LABELS) {
		let cards: any[] = [];
		try {
			cards = Array.from(player?.getCards?.(zone) || []);
		} catch {
			cards = [];
		}
		if (!cards.length) continue;
		const visibleCards: string[] = [];
		let hiddenCount = 0;
		for (const card of cards) {
			const known = isZoneCardKnown(card, player, observer, options.isCardKnown);
			if (known) visibleCards.push(options.getCardName(card));
			else hiddenCount += 1;
		}
		result.push({ zone, label, totalCount: cards.length, visibleCards, hiddenCount });
	}
	return result;
}

function isZoneCardKnown(card: any, owner: any, observer: any, customCheck?: (card: any, observer: any) => boolean): boolean {
	try {
		if (customCheck) return Boolean(customCheck(card, observer));
		if (typeof card?.isKnownBy === "function") return Boolean(card.isKnownBy(observer));
	} catch {
		return false;
	}
	return Boolean(observer && observer === owner);
}

export function collectPlayerSkillStates(
	player: any,
	skills: string[],
	options: {
		getSkillName(skill: string): string;
		getSkillMeta(skill: string): { limited?: boolean; juexingji?: boolean; zhuanhuanji?: unknown; zhuanhuanji2?: unknown } | undefined;
		isZhuanhuanji?(skill: string, player: any): boolean;
	}
): PromptSkillState[] {
	const awakened = new Set<string>(Array.isArray(player?.awakenedSkills) ? player.awakenedSkills : []);
	const states: PromptSkillState[] = [];
	const seen = new Set<string>();
	for (const skill of skills) {
		if (!skill || seen.has(skill)) continue;
		seen.add(skill);
		const meta = options.getSkillMeta(skill);
		if (!meta) continue;
		const name = options.getSkillName(skill) || skill;
		const zhuanhuan = options.isZhuanhuanji ? options.isZhuanhuanji(skill, player) : Boolean(meta.zhuanhuanji || meta.zhuanhuanji2);
		if (zhuanhuan) {
			const val = player?.storage?.[skill];
			const status = typeof val === "number" ? `阶段${val}` : val ? "阴" : "阳";
			states.push({ skill, name, kind: "zhuanhuanji", status });
			continue;
		}
		if (meta.limited) {
			states.push({ skill, name, kind: "limited", status: awakened.has(skill) ? "已发动" : "未发动" });
		}
		if (meta.juexingji) {
			states.push({ skill, name, kind: "juexingji", status: awakened.has(skill) ? "已觉醒" : "未觉醒" });
		}
	}
	return states;
}

export function formatPlayerStateExtras(state: PromptExtraState): string[] {
	const lines: string[] = [];
	if (state.marks?.length) {
		const text = state.marks.map(mark => (mark.count !== undefined && mark.count !== "" ? `${mark.name}(${mark.count})` : mark.name)).join("、");
		lines.push(`标记：${text}`);
	}
	if (state.extraZones?.length) {
		for (const zone of state.extraZones) {
			if (!zone.totalCount) continue;
			const parts = [...zone.visibleCards];
			if (zone.hiddenCount > 0) parts.push(`暗置 ${zone.hiddenCount} 张`);
			lines.push(`${zone.label}：${parts.join("、")}`);
		}
	}
	if (state.skillStates?.length) {
		lines.push(`技能状态：${state.skillStates.map(item => `${item.name}[${item.status}]`).join("、")}`);
	}
	return lines;
}

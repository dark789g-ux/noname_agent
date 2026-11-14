import {
	collectExtraZones,
	collectPlayerMarks,
	collectPlayerSkillStates,
	formatPlayerStateExtras,
	type PromptExtraZoneState,
	type PromptMarkState,
	type PromptSkillState,
} from "./prompt-state-extras.js";

export interface PromptSkill {
	name: string;
	description: string;
}

export interface PromptSkillVisibility {
	hidden: boolean;
	global: boolean;
	charlotte: boolean;
	sub: boolean;
	nopop?: boolean;
	equipmentDescription?: unknown;
	name: unknown;
	description: unknown;
}

export interface PromptPlayerProfile {
	seat: number;
	name: string;
	identity: string;
	group: string;
	sex: string;
	skills: PromptSkill[];
}

export interface PromptJudgmentCard {
	name: string;
	originalName?: string;
	suit: string;
	number: string | number;
	color: string;
	description: string;
}

export interface PromptPlayerState {
	ref?: string;
	seat: number;
	name: string;
	isCurrent: boolean;
	hp: string | number;
	maxHp: string | number;
	hujia: string | number;
	handCount: string | number;
	knownHandCards: string[];
	equips: string[];
	linked: boolean;
	turnedOver: boolean;
	judgments: PromptJudgmentCard[];
	marks?: PromptMarkState[];
	extraZones?: PromptExtraZoneState[];
	skillStates?: PromptSkillState[];
}

/** 移除 HTML 与多余空白；不截断规则文本。 */
export function cleanPromptText(value: unknown): string {
	return String(value || "")
		.replace(/<[^>]*>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/** 通过调用方提供的引擎翻译展示标识；翻译缺失时保留原始文本。 */
export function translatePromptValue(value: unknown, translate: (value: unknown) => unknown): string {
	const source = cleanPromptText(value);
	if (!source) return "未知";
	try {
		const translated = cleanPromptText(translate(value));
		return translated || source;
	} catch {
		return source;
	}
}

/** 只接受翻译表中实际存在的条目，绝不将缺失键本身当作规则描述。 */
export function promptTranslation(table: Record<string, unknown> | undefined, key: string): string {
	return cleanPromptText(table?.[key]);
}

/** 按优先级选择已存在的规则描述。 */
export function selectPromptDescription(...descriptions: unknown[]): string {
	for (const description of descriptions) {
		const text = cleanPromptText(description);
		if (text) return text;
	}
	return "";
}

/** 排除隐藏、全局及内部辅助技能；nopop 不代表技能不应展示。 */
export function isPromptSkillVisible(skill: PromptSkillVisibility): boolean {
	return !skill.hidden && !skill.global && !skill.sub && (!skill.charlotte || Boolean(cleanPromptText(skill.equipmentDescription))) && Boolean(cleanPromptText(skill.name)) && Boolean(cleanPromptText(skill.description));
}

export interface PromptRuntime {
	players: any[];
	globalSkills: Iterable<string>;
	translate(value: unknown): string;
	getPlayerName(player: any): string;
	getSkillName(skill: string): string;
	getSkillDescription(skill: string, player: any): string;
	getSkillMeta(skill: string): { charlotte?: boolean; sub?: boolean; limited?: boolean; juexingji?: boolean; zhuanhuanji?: unknown; zhuanhuanji2?: unknown; intro?: { nocount?: boolean; markcount?: unknown } } | undefined;
	isZhuanhuanji?(skill: string, player: any): boolean;
	isCardKnown?(card: any, observer: any): boolean;
	getEquipmentSkills(card: any): string[];
	isEquipmentCard(card: any): boolean;
	getCardName(card: any): string;
	getCardProperties(card: any, owner: any): { suit: string; number: string | number; color: string };
	getCardDescription(card: any, owner: any): string;
	getViewedAsDescription(card: any, effectiveId: string, owner: any): string;
}

export interface PromptSnapshotCandidates {
	cards: { ref: string; name: string; id: string; cardAction?: boolean; skills?: string[] }[];
	skills: string[];
	targets?: { ref: string; name: string }[];
	actions?: Array<{ kind: "card" | "skill"; cardRef?: string; skillName?: string; materialCardRefs: string[]; materialRange?: [number, number]; materialAutomatic?: boolean; target: { mode: string; range?: [number, number]; targetRefs: string[] } }>;
}

export interface PromptSnapshotOptions {
	decisionDescriptions: Record<string, string>;
	getSkillName(skill: string): string;
	getSkillDescription(skill: string): string;
	getCardLabel?(card: any): string;
	getPlayerLabel?(player: any): string;
	pileOverviewText?: string;
	roundHistoryText?: string;
}

/** 从注入的游戏运行时采集 LLM 所需的全员档案和场面状态。 */
export function collectPromptPlayers(runtime: PromptRuntime, observer: any, referencedPlayers?: any[]): { profiles: PromptPlayerProfile[]; states: PromptPlayerState[] } {
	const players = Array.from(runtime.players || []);
	const statePlayers = referencedPlayers?.length ? referencedPlayers : players;
	const skillsCache = new Map<any, string[]>();
	const readSkills = (player: any): string[] => {
		if (!skillsCache.has(player)) skillsCache.set(player, getPlayerSkills(player));
		return skillsCache.get(player)!;
	};
	return {
		profiles: players.map(player => collectPlayerProfile(runtime, player, readSkills(player))),
		states: statePlayers.map(player => collectPlayerState(runtime, player, observer, readSkills(player))),
	};
}

/** 生成 user prompt 中既有的决策、候选和弃牌协议，保持其文本段落兼容。 */
export function buildDecisionSnapshot(decisionPoint: string, event: any, candidates: PromptSnapshotCandidates, states: PromptPlayerState[], options: PromptSnapshotOptions): string {
	const lines: string[] = [`## 决策类型：${options.decisionDescriptions[decisionPoint] || decisionPoint}`];
	if (event.prompt) lines.push(`## 提示：${event.prompt}`);
	if (event.judging) lines.push(`## 当前判定牌：${options.getCardLabel?.(event.judging) || `${event.judging.name} ${event.judging.suit || ""} ${event.judging.number ?? ""}`}`);
	if (event.source) lines.push(`## 选择来源：${options.getPlayerLabel?.(event.source) || event.source.name || "未知角色"}`);
	if (event.skill) lines.push(`## 已选择技能：${event.skill}；继续当前材料或目标步骤，无需再次发动。`);
	if (event.prompt2) lines.push(`## 补充规则：${event.prompt2}`);
	if (Array.isArray(event.choiceList)) lines.push(`## 选项说明：\n${event.choiceList.map((text: any, index: number) => `${index}: ${text}`).join("\n")}`);
	if (Array.isArray(event.targetprompt)) lines.push(`## 目标顺序：${event.targetprompt.join(" → ")}`);
	lines.push(`## 取消：${event.forced ? "必须完成合法选择" : "允许放弃尚未提交的选择"}`);
	if (event.dialog && typeof event.dialog === "string") lines.push(`## 对话：${event.dialog}`);
	if (Array.isArray(event.createDialog)) {
		const shown = visibleDialogItems(event.createDialog, options.getCardLabel);
		if (shown.length) lines.push(`## 当前决策公开给你的信息：${shown.join("；")}`);
	}
	if (options.pileOverviewText) lines.push("", options.pileOverviewText);
	lines.push("", formatPlayerStates(states));
	if (options.roundHistoryText) lines.push("", options.roundHistoryText);
	if (candidates.actions && !event.skill && ["chooseToUse", "chooseToRespond"].includes(decisionPoint)) {
		lines.push("\n## 可执行动作：");
		if (!candidates.actions.length) lines.push("- 无");
		else for (const action of candidates.actions) lines.push(`- ${formatAction(action, candidates, options)}`);
		if (candidates.cards.length) {
			lines.push("\n## 动作材料引用：");
			for (const card of candidates.cards) lines.push(`- ${card.ref}: ${card.name}（${card.id}）`);
		}
	} else if (candidates.cards.length) {
		lines.push("\n## 可用卡牌：");
		for (const card of candidates.cards) {
			const scopes = [card.cardAction ? "直接使用" : "", ...(card.skills || []).map(skill => `技能:${skill}`)].filter(Boolean).join("，");
			lines.push(`- ${card.ref}: ${card.name}（旧 ID: ${card.id}${scopes ? `；${scopes}` : ""}）`);
		}
	} else {
		lines.push("\n## 可用卡牌：无");
	}
	if ((!candidates.actions || !["chooseToUse", "chooseToRespond"].includes(decisionPoint)) && candidates.skills.length) {
		lines.push("\n## 可用技能：");
		for (const skill of candidates.skills) lines.push(`- ${skill}（${options.getSkillName(skill)}）：${options.getSkillDescription(skill) || "无可用规则描述"}`);
	}
	if ((!candidates.actions || !["chooseToUse", "chooseToRespond"].includes(decisionPoint)) && candidates.targets?.length) {
		lines.push("\n## 当前可选目标：");
		for (const target of candidates.targets) lines.push(`- ${target.ref}: ${target.name}`);
	}
	if (decisionPoint === "chooseToDiscard" && event.selectCard) {
		if (Array.isArray(event.selectCard)) lines.push(`\n## 弃牌要求：最少 ${event.selectCard[0]} 张，最多 ${event.selectCard[1]} 张`);
		else if (typeof event.selectCard === "number") lines.push(`\n## 弃牌要求：${event.selectCard} 张`);
	}
	return lines.join("\n");
}

function visibleDialogItems(items: any[], cardLabel?: (card: any) => string): string[] {
	if (items[1] === "blank") return [];
	return items.flatMap(item => {
		if (Array.isArray(item)) return visibleDialogItems(item, cardLabel);
		if (item && typeof item === "object" && typeof item.name === "string") return [cardLabel?.(item) || `${item.name} ${item.suit || ""} ${item.number || ""}`];
		return typeof item === "string" && !["hidden", "forcebutton"].includes(item) ? [item] : [];
	});
}

function formatAction(action: NonNullable<PromptSnapshotCandidates["actions"]>[number], candidates: PromptSnapshotCandidates, options: PromptSnapshotOptions): string {
	const card = candidates.cards.find(value => value.ref === action.cardRef);
	const name = action.kind === "card" ? `直接使用 ${action.cardRef}【${card?.name || "未知"}】` : `发动 ${action.skillName}【${options.getSkillName(action.skillName || "") || action.skillName}】`;
	const material = action.kind === "skill" ? `｜材料牌=${formatMaterial(action.materialCardRefs, action.materialRange, action.materialAutomatic)}` : "";
	return `${name}${material}｜目标=${formatTarget(action.target)}`;
}

function formatMaterial(refs: string[], range?: [number, number], automatic?: boolean): string {
	if (!refs.length) return "0";
	if (automatic) return `自动，可用=[${refs.join(",")}]`;
	const label = range ? (range[0] === range[1] ? `选择 ${range[0]}` : `${range[0]}～${range[1]}`) : "选择 1";
	return `${label}，可选=[${refs.join(",")}]`;
}

function formatTarget(target: { mode: string; range?: [number, number]; targetRefs: string[] }): string {
	if (target.mode === "none") return "无";
	if (target.mode === "automatic") return `自动｜自动目标=[${target.targetRefs.join(",")}]`;
	if (target.mode === "dynamic") return "动态，选牌后计算";
	const count = target.range ? (target.range[0] === target.range[1] ? `选择 ${target.range[0]}` : `选择 ${target.range[0]}～${target.range[1]}`) : "选择";
	return `${count}｜候选=[${target.targetRefs.join(",")}]`;
}

function collectPlayerProfile(runtime: PromptRuntime, player: any, skills = getPlayerSkills(player)): PromptPlayerProfile {
	const hiddenSkills = new Set(player.hiddenSkills || []);
	const globalSkills = new Set(runtime.globalSkills || []);
	const equipmentSkills = getEquipmentSkillCards(runtime, player, skills);
	const promptSkills: PromptSkill[] = [];
	const seen = new Set<string>();
	for (const skill of skills) {
		if (!skill || seen.has(skill)) continue;
		seen.add(skill);
		const sourceCard = equipmentSkills.get(skill);
		const equipmentDescription = sourceCard ? runtime.getCardDescription(sourceCard, player) : "";
		const description = selectPromptDescription(runtime.getSkillDescription(skill, player), equipmentDescription);
		const meta = runtime.getSkillMeta(skill);
		if (!isPromptSkillVisible({ hidden: hiddenSkills.has(skill), global: globalSkills.has(skill), charlotte: Boolean(meta?.charlotte), sub: Boolean(meta?.sub), equipmentDescription, name: runtime.getSkillName(skill), description })) continue;
		promptSkills.push({ name: runtime.getSkillName(skill), description });
	}
	return {
		seat: getSeat(player),
		name: runtime.getPlayerName(player),
		identity: runtime.translate(player.identity),
		group: runtime.translate(player.group),
		sex: runtime.translate(player.sex),
		skills: promptSkills,
	};
}

function collectPlayerState(runtime: PromptRuntime, player: any, observer: any, skills = getPlayerSkills(player)): PromptPlayerState {
	const hand = getCards(player, "h");
	const equip = getCards(player, "e");
	const judgment = getCards(player, "j");
	const hiddenSkills = new Set(player.hiddenSkills || []);
	const globalSkills = new Set(runtime.globalSkills || []);
	const visibleSkills = skills.filter(skill => {
		if (!skill || hiddenSkills.has(skill) || globalSkills.has(skill)) return false;
		const meta = runtime.getSkillMeta(skill);
		return !meta?.sub && !meta?.charlotte;
	});
	const marks = collectPlayerMarks(player, runtime);
	const extraZones = collectExtraZones(player, observer, runtime);
	const skillStates = collectPlayerSkillStates(player, visibleSkills, runtime);
	return {
		seat: getSeat(player),
		name: runtime.getPlayerName(player),
		isCurrent: player === observer,
		hp: player.getHp ? player.getHp() : (player.hp ?? "?"),
		maxHp: player.maxHp ?? "?",
		hujia: player.hujia ?? 0,
		handCount: hand.length,
		knownHandCards: getKnownCards(player, observer).map(card => runtime.getCardName(card)),
		equips: equip.map(card => runtime.getCardName(card)),
		linked: Boolean(player.isLinked?.()),
		turnedOver: Boolean(player.isTurnedOver?.()),
		judgments: judgment.map(card => collectJudgmentCard(runtime, card, player)),
		...(marks.length ? { marks } : {}),
		...(extraZones.length ? { extraZones } : {}),
		...(skillStates.length ? { skillStates } : {}),
	};
}

function getPlayerSkills(player: any): string[] {
	try {
		return Array.from(player.getSkills?.(null, true, true) || []);
	} catch {
		return [];
	}
}

function getEquipmentSkillCards(runtime: PromptRuntime, player: any, skills: string[]): Map<string, any> {
	const requested = new Set(skills);
	const cards = getCards(player, "e");
	for (const skill of requested) {
		try {
			cards.push(...(player.getExpansions?.(skill) || []));
		} catch {
			// 单个扩展区读取失败不影响其它来源。
		}
	}
	const result = new Map<string, any>();
	for (const card of cards) {
		if (!runtime.isEquipmentCard(card)) continue;
		for (const skill of runtime.getEquipmentSkills(card)) {
			if (requested.has(skill) && !result.has(skill)) result.set(skill, card);
		}
	}
	return result;
}

function collectJudgmentCard(runtime: PromptRuntime, card: any, owner: any): PromptJudgmentCard {
	const effectiveId = viewAsName(card) || card.name;
	const properties = runtime.getCardProperties(card, owner);
	const viewedAs = effectiveId !== card.name;
	return {
		name: runtime.translate(effectiveId),
		originalName: viewedAs ? runtime.translate(card.name) : undefined,
		suit: properties.suit,
		number: properties.number,
		color: properties.color,
		description: selectPromptDescription(viewedAs ? runtime.getViewedAsDescription(card, effectiveId, owner) : runtime.getCardDescription(card, owner)) || "未知",
	};
}

function getCards(player: any, zone: string): any[] {
	try {
		return Array.from(player.getCards?.(zone) || []);
	} catch {
		return [];
	}
}

function getKnownCards(player: any, observer: any): any[] {
	if (!observer || !player.getKnownCards) return [];
	try {
		return Array.from(player.getKnownCards(observer) || []);
	} catch {
		return [];
	}
}

function getSeat(player: any): number {
	try {
		return player.getSeatNum?.() || 0;
	} catch {
		return 0;
	}
}

function viewAsName(card: any): string | undefined {
	if (typeof card?.viewAs === "string") return card.viewAs;
	if (card?.viewAs && typeof card.viewAs.name === "string") return card.viewAs.name;
	return undefined;
}

export function formatPlayerProfiles(profiles: PromptPlayerProfile[]): string {
	const lines = ["## 场上武将信息："];
	for (const profile of sortBySeat(profiles)) {
		lines.push(`\n[${seatLabel(profile.seat)}] ${profile.name}`);
		lines.push(`身份：${profile.identity}；势力：${profile.group}；性别：${profile.sex}`);
		lines.push("当前有效技能：");
		if (!profile.skills.length) {
			lines.push("- 无");
			continue;
		}
		for (const skill of profile.skills) lines.push(`- ${skill.name}：${skill.description}`);
	}
	return lines.join("\n");
}

export function formatPlayerStates(states: PromptPlayerState[]): string {
	const lines = ["## 当前场面状态："];
	for (const state of sortBySeat(states)) {
		const current = state.isCurrent ? "[当前行动者]" : "";
		lines.push(`\n${current}${state.ref ? `[${state.ref}]` : ""}[${seatLabel(state.seat)}] ${state.name}`);
		lines.push(`体力：${state.hp}/${state.maxHp}；护甲：${state.hujia}；手牌：${state.handCount}；横置：${yesNo(state.linked)}；翻面：${yesNo(state.turnedOver)}`);
		lines.push(`装备区：${state.equips.length ? state.equips.join("、") : "无"}`);
		lines.push(`已知手牌：${state.knownHandCards.length ? state.knownHandCards.join("、") : "无"}`);
		lines.push(...formatPlayerStateExtras(state));
		lines.push("判定区：");
		if (!state.judgments.length) {
			lines.push("- 无");
			continue;
		}
		for (const card of state.judgments) {
			const originalName = card.originalName ? `；原牌：${card.originalName}` : "";
			lines.push(`- ${card.name}${originalName}；花色：${card.suit}；点数：${card.number}；颜色：${card.color}`);
			lines.push(`  描述：${card.description}`);
		}
	}
	return lines.join("\n");
}

function sortBySeat<T extends { seat: number }>(items: T[]): T[] {
	return items
		.map((item, index) => ({ item, index }))
		.sort((a, b) => normalizedSeat(a.item.seat) - normalizedSeat(b.item.seat) || a.index - b.index)
		.map(({ item }) => item);
}

function normalizedSeat(seat: number): number {
	return seat > 0 ? seat : Number.POSITIVE_INFINITY;
}

function seatLabel(seat: number): string {
	return seat > 0 ? `${seat}号位` : "未分配";
}

function yesNo(value: boolean): string {
	return value ? "是" : "否";
}

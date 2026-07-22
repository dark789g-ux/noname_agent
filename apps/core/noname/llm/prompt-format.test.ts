import assert from "node:assert/strict";
import test from "node:test";
import { buildDecisionSnapshot, cleanPromptText, collectPromptPlayers, formatPlayerProfiles, formatPlayerStates, isPromptSkillVisible, promptTranslation, selectPromptDescription, translatePromptValue } from "./prompt-format.js";

test("清理 HTML 和空白但保留完整描述", () => {
	const description = `<span>规则</span>\n  ${"甲".repeat(700)}&nbsp; <br>结束`;
	const result = cleanPromptText(description);
	assert.equal(result, `规则 ${"甲".repeat(700)} 结束`);
	assert.equal(result.length > 600, true);
});

test("武将信息按座位排序且未分配置后", () => {
	const prompt = formatPlayerProfiles([
		{ seat: 0, name: "未分配", identity: "反贼", group: "群", sex: "男性", skills: [] },
		{ seat: 2, name: "关羽", identity: "忠臣", group: "蜀", sex: "男性", skills: [{ name: "武圣", description: "你可以将红色牌当杀使用。" }] },
		{ seat: 1, name: "刘备", identity: "主公", group: "蜀", sex: "男性", skills: [] },
	]);
	assert.ok(prompt.indexOf("[1号位] 刘备") < prompt.indexOf("[2号位] 关羽"));
	assert.ok(prompt.indexOf("[2号位] 关羽") < prompt.indexOf("[未分配] 未分配"));
	assert.match(prompt, /身份：反贼；势力：群；性别：男性/);
	assert.match(prompt, /- 武圣：你可以将红色牌当杀使用。/);
});

test("状态输出已知手牌与普通和视为判定牌详情", () => {
	const prompt = formatPlayerStates([
		{
			seat: 2,
			name: "关羽",
			isCurrent: false,
			hp: 3,
			maxHp: 4,
			hujia: 1,
			handCount: 2,
			knownHandCards: [],
			equips: ["青龙偃月刀"],
			linked: true,
			turnedOver: false,
			judgments: [{ name: "乐不思蜀", suit: "方片", number: 7, color: "红色", description: "判定阶段进行判定。" }],
		},
		{
			seat: 1,
			name: "刘备",
			isCurrent: true,
			hp: 4,
			maxHp: 4,
			hujia: 0,
			handCount: 3,
			knownHandCards: ["桃"],
			equips: [],
			linked: false,
			turnedOver: true,
			judgments: [{ name: "乐不思蜀", originalName: "杀", suit: "黑桃", number: 6, color: "黑色", description: "若结果不为红桃，跳过出牌阶段。" }],
		},
	]);
	assert.ok(prompt.indexOf("[当前行动者][1号位] 刘备") < prompt.indexOf("[2号位] 关羽"));
	assert.match(prompt, /体力：4\/4；护甲：0；手牌：3；横置：否；翻面：是/);
	assert.match(prompt, /已知手牌：桃/);
	assert.match(prompt, /已知手牌：无/);
	assert.match(prompt, /- 乐不思蜀；原牌：杀；花色：黑桃；点数：6；颜色：黑色/);
	assert.match(prompt, /描述：若结果不为红桃，跳过出牌阶段。/);
});

test("翻译适配优先引擎翻译，缺失时保留原始文本", () => {
	const dictionary: Record<string, string> = { zhu: "主公", shu: "蜀", male: "男性", lebu: "乐不思蜀", diamond: "方片", red: "红色" };
	const translate = (value: unknown) => dictionary[String(value)] || "";
	assert.equal(translatePromptValue("zhu", translate), "主公");
	assert.equal(translatePromptValue("lebu", translate), "乐不思蜀");
	assert.equal(translatePromptValue("untranslated", translate), "untranslated");
});

test("nopop 与映射装备的 charlotte 技能可展示，隐藏、全局和内部技能被排除", () => {
	const base = { hidden: false, global: false, charlotte: false, sub: false, name: "挟天子", description: "结束阶段可以发动。" };
	assert.equal(isPromptSkillVisible({ ...base, nopop: true }), true);
	assert.equal(isPromptSkillVisible({ ...base, charlotte: true }), false);
	assert.equal(isPromptSkillVisible({ ...base, charlotte: true, equipmentDescription: "诏书效果" }), true);
	assert.equal(isPromptSkillVisible({ ...base, hidden: true }), false);
	assert.equal(isPromptSkillVisible({ ...base, global: true }), false);
	assert.equal(isPromptSkillVisible({ ...base, charlotte: true }), false);
	assert.equal(isPromptSkillVisible({ ...base, sub: true }), false);
	assert.equal(isPromptSkillVisible({ ...base, name: "", description: "" }), false);
});

test("缺失 skill_info 不会输出翻译键，并回退装备卡描述", () => {
	const translations = { tianjitu_info: "锁定技，进入装备区时弃置一张牌。" };
	assert.equal(promptTranslation(translations, "tianjitu_skill_info"), "");
	assert.equal(selectPromptDescription(promptTranslation(translations, "tianjitu_skill_info"), promptTranslation(translations, "tianjitu_info")), "锁定技，进入装备区时弃置一张牌。");
});

test("运行时采集只读取存活玩家并保留可见技能、已知手牌和动态判定信息", () => {
	const observer = { name: "调用者" };
	const known = { name: "known" };
	const unknown = { name: "unknown" };
	const equip = { name: "tianjitu", skills: ["equip_skill"] };
	const zhaoshu = { name: "zhaoshu", skills: ["charlotte_equip"] };
	const normalJudgment = { name: "lebu", storage: { delay: 1 } };
	const viewedJudgment = { name: "sha", viewAs: "fulei", storage: { fulei: 2 } };
	const getSkillsCalls: unknown[][] = [];
	const current = {
		name: "liubei",
		seat: 2,
		identity: "zhu",
		identityShown: false,
		group: "shu",
		sex: "male",
		hiddenSkills: ["hidden_skill"],
		getSeatNum() { return this.seat; },
		getHp: () => 3,
		maxHp: 4,
		hujia: 1,
		getSkills(...args: unknown[]) {
			getSkillsCalls.push(args);
			return ["character_skill", "temporary_skill", "additional_skill", "equip_skill", "charlotte_equip", "hidden_skill", "global_skill", "internal_skill"];
		},
		getCards(zone: string) {
			return { h: [known, unknown], e: [equip], j: [normalJudgment, viewedJudgment] }[zone] || [];
		},
		getExpansions(skill: string) { return skill === "charlotte_equip" ? [zhaoshu] : []; },
		getKnownCards(value: unknown) {
			assert.equal(value, observer);
			return [known];
		},
		isLinked: () => true,
		isTurnedOver: () => false,
	};
	const unassigned = { name: "guanyu", identity: "fan", group: "shu", sex: "male", getSeatNum: () => 0, getSkills: () => [], getCards: () => [], getHp: () => 4, maxHp: 4 };
	const dead = { name: "dead", identity: "nei", group: "wei", sex: "male", getSeatNum: () => 1, getSkills: () => [], getCards: () => [] };
	const descriptions: any[] = [];
	const names: Record<string, string> = { liubei: "刘备", guanyu: "关羽", zhu: "主公", fan: "反贼", shu: "蜀", male: "男性", known: "桃", unknown: "杀", tianjitu: "天机图", zhaoshu: "诏书", lebu: "乐不思蜀", sha: "杀", fulei: "浮雷" };
	const runtime: any = {
		players: [current, unassigned],
		dead: [dead],
		globalSkills: ["global_skill"],
		translate: (value: unknown) => names[String(value)] || String(value || "未知"),
		getPlayerName: (player: any) => names[player.name],
		getSkillName: (skill: string) => ({ character_skill: "武将技", temporary_skill: "临时技", additional_skill: "额外技", equip_skill: "天机图", charlotte_equip: "锦囊召唤", hidden_skill: "隐藏", global_skill: "全局", internal_skill: "内部" })[skill] || "",
		getSkillDescription: (skill: string) => ({ character_skill: "武将说明", temporary_skill: "临时说明", additional_skill: "额外说明" })[skill] || "",
		getSkillMeta: (skill: string) => (skill === "charlotte_equip" ? { charlotte: true } : skill === "internal_skill" ? { sub: true } : {}),
		getEquipmentSkills: (card: any) => card.skills || [],
		isEquipmentCard: (card: any) => card === equip || card === zhaoshu,
		getCardName: (card: any) => names[card.name],
		getCardProperties: (card: any) => ({ suit: card === viewedJudgment ? "黑桃" : "方片", number: 7, color: card === viewedJudgment ? "黑色" : "红色" }),
		getCardDescription: (card: any) => {
			descriptions.push(card);
			if (card === equip) return "天机图装备效果";
			if (card === zhaoshu) return "诏书装备效果";
			if (card === normalJudgment) return `普通判定 ${card.storage.delay}`;
			return "";
		},
		getViewedAsDescription: (card: any, effectiveId: string) => {
			assert.equal(card, viewedJudgment);
			assert.equal(effectiveId, "fulei");
			return `浮雷判定 ${card.storage.fulei}`;
		},
	};
	const { profiles, states } = collectPromptPlayers(runtime, observer);
	assert.deepEqual(getSkillsCalls, [[null, true, true]]);
	assert.equal(profiles.length, 2);
	assert.equal(profiles[0].identity, "主公");
	assert.deepEqual(profiles[0].skills.map(skill => skill.name), ["武将技", "临时技", "额外技", "天机图", "锦囊召唤"]);
	assert.deepEqual(profiles[0].skills.slice(-2).map(skill => skill.description), ["天机图装备效果", "诏书装备效果"]);
	assert.deepEqual(states[0].knownHandCards, ["桃"]);
	assert.equal(states[0].judgments[0].description, "普通判定 1");
	assert.equal(states[0].judgments[1].description, "浮雷判定 2");
	assert.ok(descriptions.includes(normalJudgment));
	assert.ok(formatPlayerProfiles(profiles).indexOf("[2号位] 刘备") < formatPlayerProfiles(profiles).indexOf("[未分配] 关羽"));
	assert.ok(!formatPlayerProfiles(profiles).includes("dead"));
});

test("决策快照保留 cards、skills、targets 和弃牌段落", () => {
	const snapshot = buildDecisionSnapshot("chooseToDiscard", { prompt: "请选择", dialog: "对话", selectCard: [1, 2] }, { cards: [{ ref: "c0", name: "杀", id: "sha", cardAction: true, skills: ["wusheng"] }], skills: ["wusheng"], targets: [{ ref: "p1", name: "关羽" }] }, [], {
		decisionDescriptions: { chooseToDiscard: "弃牌" },
		getSkillName: () => "武圣",
		getSkillDescription: () => "红色牌当杀",
	});
	assert.match(snapshot, /## 可用卡牌：/);
	assert.match(snapshot, /## 可用技能：/);
	assert.match(snapshot, /## 当前可选目标：/);
	assert.match(snapshot, /## 弃牌要求：最少 1 张，最多 2 张/);
});

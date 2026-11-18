import assert from "node:assert/strict";
import test from "node:test";
import { assertExecutableSnapshot, buildDecisionCandidateSnapshot, type ActionCandidateRuntime } from "./action-candidates.js";
import { DecisionSession, type DecisionRuntime } from "./apply.js";
import { buildDecisionSnapshot, collectPromptPlayers, formatPlayerStates } from "./prompt-format.js";
import { appendPendingHistory } from "./backup-protocol.js";

function fixture(options: { skills?: Record<string, any>; cards?: any[]; players?: any[]; dead?: any[]; owner?: any; mod?: (range: [number, number]) => void } = {}) {
	const owner = options.owner || player("owner", 1, 4, 4);
	const players = options.players || [owner, player("a", 2), player("b", 3)];
	const dead = options.dead || [];
	const cards = options.cards || [];
	const skills = options.skills || {};
	owner.cards = cards;
	const runtime: ActionCandidateRuntime & DecisionRuntime = {
		getCandidateSkills: () => Object.keys(skills).filter(skill => !!skills[skill].selectionSpec),
		getCandidateCards(event, current, enabledSkills) {
			return cards.flatMap((card, index) => {
				const direct = event.filterCard?.(card, current) === true;
				const cardSkills = enabledSkills.filter(skill => skills[skill].filterCard === true || skills[skill].filterCard?.(card, current) === true);
				return direct || cardSkills.length ? [{ card, ref: `c${index}`, id: card.name, name: card.name, cardAction: direct, skills: cardSkills }] : [];
			});
		},
		getPlayers: event => [...players, ...(event.deadTarget ? dead : [])],
		getTargetId: (target, index) => target.id || String(index),
		getTargetName: target => target.name,
		getSkillInfo: skill => skills[skill],
		getCardInfo: card => card?.info || {},
		autoViewAs: (definition, selected) => ({ ...definition, cards: selected }),
		checkSelectTarget: (_card, _player, range) => options.mod?.(range),
		getOwner: card => card.owner,
		alivePlayers: () => players,
		deadPlayers: () => dead,
		translate: value => value?.name || String(value),
		isSkillEligible: (_event, _player, skill) => !!skills[skill]?.selectionSpec,
	};
	for (const card of cards) card.owner = owner;
	return { owner, players, dead, cards, skills, runtime };
}

test("真实快照覆盖 none、自动、固定、有限多目标与 event/mod 范围", () => {
	const cards = [{ name: "none", info: { notarget: true } }, { name: "all", info: { selectTarget: -1 } }, { name: "sha", info: { selectTarget: 1 } }];
	const f = fixture({ cards, mod: range => { if (range[1] === 2) range[0] = 1; } });
	const base = { name: "chooseToUse", player: f.owner, filterCard: () => true, filterTarget: (_card: any, _player: any, target: any) => target !== f.owner };
	const snapshot = buildDecisionCandidateSnapshot(base, f.owner, f.runtime);
	assert.equal(snapshot.actions[0].target.mode, "none");
	assert.deepEqual(snapshot.actions[1].target, { mode: "automatic", range: [2, 2], targetRefs: ["p1", "p2"] });
	assert.deepEqual(snapshot.actions[2].target, { mode: "select", range: [1, 1], targetRefs: ["p1", "p2"] });
	const overridden = buildDecisionCandidateSnapshot({ ...base, selectTarget: [2, 2] }, f.owner, f.runtime);
	assert.deepEqual(overridden.actions[2].target.range, [1, 2]);
});

test("满血普通桃排除，濒死救援桃自动指向濒死角色", () => {
	const tao = { name: "tao", info: { selectTarget: 1 } };
	const f = fixture({ cards: [tao] });
	const ordinary = buildDecisionCandidateSnapshot({ name: "chooseToUse", player: f.owner, filterCard: () => false, filterTarget: () => true }, f.owner, f.runtime);
	assert.equal(ordinary.actions.length, 0);
	const rescue = buildDecisionCandidateSnapshot({ name: "chooseToUse", player: f.owner, dying: f.players[1], filterCard: () => true, filterTarget: () => true }, f.owner, f.runtime);
	assert.deepEqual(rescue.actions[0].target, { mode: "automatic", range: [1, 1], targetRefs: ["p1"] });
});

test("共享 planner 让强袭静态列目标、火计补动态目标，材料不与实体牌合并", () => {
	const weapon = { name: "weapon", info: { notarget: true } };
	const red = { name: "red", info: { notarget: true } };
	const skills = {
		olqiangxi: { selectionSpec: { steps: [{ type: "card", select: [0, 1] }, { type: "target", select: 1 }] }, filterCard: (card: any) => card === weapon, filterTarget: (_card: any, owner: any, target: any) => target !== owner },
		rehuoji: { selectionSpec: true, filterCard: (card: any) => card === red, viewAs: { name: "huogong" } },
	};
	const f = fixture({ cards: [weapon, red], skills });
	const event = { name: "chooseToUse", player: f.owner, filterCard: (card: any) => card === weapon, filterTarget: (_card: any, owner: any, target: any) => target !== owner };
	const snapshot = buildDecisionCandidateSnapshot(event, f.owner, f.runtime);
	const direct = snapshot.actions.find(action => action.kind === "card")!;
	const qiangxi = snapshot.actions.find(action => action.skillName === "olqiangxi")!;
	const huoji = snapshot.actions.find(action => action.skillName === "rehuoji")!;
	assert.equal(qiangxi.target.mode, "select");
	assert.deepEqual(qiangxi.target.targetRefs, ["p1", "p2"]);
	assert.equal(huoji.target.mode, "dynamic");
	assert.deepEqual(direct.materialCardRefs, []);
	assert.deepEqual(huoji.materialCardRefs, ["c1"]);
	const prompt = buildDecisionSnapshot("chooseToUse", {}, snapshot, [], { decisionDescriptions: {}, getSkillName: value => value, getSkillDescription: () => "" });
	assert.match(prompt, /olqiangxi.*材料牌=0～1，可选=\[c0\].*目标=选择 1.*候选=\[p1,p2\]/);
});

test("required 无目标排除；缺 spec 正常排除；异常和同一步依赖严格失败", () => {
	const noTarget = { selectionSpec: { steps: [{ type: "target", select: 1 }] }, filterTarget: () => false };
	const f = fixture({ skills: { noTarget, missing: {}, broken: { selectionSpec: true, filterTarget: () => { throw new Error("boom"); }, selectTarget: 1 } } });
	const event = { name: "chooseToUse", player: f.owner, filterCard: () => false, filterTarget: () => false };
	assert.throws(() => buildDecisionCandidateSnapshot(event, f.owner, f.runtime), (error: any) => error.stage === "translate/action-resolution" && /boom/.test(error.message));
	delete f.skills.broken;
	const snapshot = buildDecisionCandidateSnapshot(event, f.owner, f.runtime);
	assert.equal(snapshot.actions.length, 0);
	assert.equal(snapshot.skills.includes("missing"), false);
	f.skills.ordered = { selectionSpec: { steps: [{ type: "target", select: 1, selectionMode: "sequential", filter: () => true }] } };
	assert.throws(() => buildDecisionCandidateSnapshot(event, f.owner, f.runtime), (error: any) => error.stage === "translate/action-resolution" && /sequential/.test(error.message));
	delete f.skills.ordered;
	f.skills.pureFour = { selectionSpec: { steps: [{ type: "target", select: 1, selectionMode: "set", filter(_target: any, _player: any, _context: any, _selected: any[]) { return true; } }] } };
	f.skills.pureRest = { selectionSpec: { steps: [{ type: "target", select: 1, selectionMode: "set", filter(..._args: any[]) { return true; } }] } };
	assert.equal(buildDecisionCandidateSnapshot(event, f.owner, f.runtime).actions.length, 2);
	const badRuntime = { ...f.runtime, getCandidateCards: () => { throw new Error("candidate boom"); } };
	assert.throws(() => buildDecisionCandidateSnapshot(event, f.owner, badRuntime), (error: any) => error.stage === "translate/action-resolution" && /candidate boom/.test(error.message));
});

test("普通 respond 实体牌无目标；显式 headless target 进入 pending 历史", () => {
	const sha = { name: "sha", info: { selectTarget: 1 } };
	const f = fixture({ cards: [sha] });
	const ordinary = { name: "chooseToRespond", player: f.owner, filterCard: () => true, filterTarget: () => true };
	const ordinarySnapshot = buildDecisionCandidateSnapshot(ordinary, f.owner, f.runtime);
	assert.equal(ordinarySnapshot.actions[0].target.mode, "none");
	assert.deepEqual(new DecisionSession(ordinary, ordinarySnapshot, f.runtime).accept(call("respond_card", { card_ref: "c0" })).result, { bool: true, card: sha, cards: [sha] });
	const explicit = { ...ordinary, selectionSpec: { steps: [{ id: "respond-target", type: "target", select: 1 }] }, filterTarget: (_card: any, _owner: any, target: any) => target === f.players[1] };
	const snapshot = buildDecisionCandidateSnapshot(explicit, f.owner, f.runtime);
	assert.equal(snapshot.actions[0].target.mode, "dynamic");
	const session = new DecisionSession(explicit, snapshot, f.runtime);
	const tool = call("respond_card", { card_ref: "c0" });
	const started = session.accept(tool);
	assert.deepEqual(started.pending?.items.map(item => item.ref), ["p1"]);
	const history: any[] = [];
	appendPendingHistory(history, tool, started.pending!);
	assert.deepEqual(history.map(message => message.role), ["assistant", "tool", "user"]);
	assert.match(history[2].content, /p1/);
	assert.doesNotMatch(history[2].content, /p2/);
	const completed = session.accept(call("select_targets", { step_id: "respond-target", target_refs: ["p1"] }));
	assert.deepEqual(completed.result.targets, [f.players[1]]);
});

test("借刀杀人通用两阶段选目标可执行；显式 set target step 仍禁止冒充", () => {
	const jiedao = { name: "jiedao", info: { selectTarget: 1, singleCard: true, complexSelect: true, complexTarget: true, filterAddedTarget: (_card: any, _player: any, target: any, preTarget: any) => target !== preTarget, changeTarget: true } };
	const f = fixture({ cards: [jiedao] });
	const legacy = { name: "chooseToUse", player: f.owner, filterCard: () => true, filterTarget: (_card: any, owner: any, target: any) => target === f.players[1] };
	const snapshot = buildDecisionCandidateSnapshot(legacy, f.owner, f.runtime);
	assert.equal(snapshot.actions[0].target.mode, "dynamic");
	const session = new DecisionSession(legacy, snapshot, f.runtime);
	const stage1 = session.accept(call("use_card", { card_ref: "c0" }));
	assert.deepEqual(stage1.pending?.items.map(item => item.ref), ["p1"]);
	const stage2 = session.accept(call("select_targets", { step_id: stage1.pending!.id, target_refs: ["p1"] }));
	assert.deepEqual(stage2.pending?.items.map(item => item.ref), ["p0", "p2"]);
	const completed = session.accept(call("select_targets", { step_id: stage2.pending!.id, target_refs: ["p2"] }));
	assert.deepEqual(completed.result.targets, [f.players[1], f.players[2]]);
	const explicit = { ...legacy, selectionSpec: { steps: [{ type: "target", select: 1, selectionMode: "set" }] } };
	assert.throws(() => buildDecisionCandidateSnapshot(explicit, f.owner, f.runtime), (error: any) => error.stage === "translate/action-resolution" && /legacy target flags/.test(error.message));
});

test("DecisionSession 动态选牌后仅投影实时目标，并拒绝跨动作引用", () => {
	const red = { name: "red", info: { notarget: true } };
	const skills = { rehuoji: { selectionSpec: true, filterCard: () => true, viewAs: { name: "huogong" } } };
	const f = fixture({ cards: [red], skills });
	// 虚拟火攻也应提供真实的目标规则，且事件允许使用生成后的火攻。
	f.runtime.getCardInfo = card => card.name === "huogong" ? { selectTarget: 1 } : card.info || {};
	const event = { name: "chooseToUse", player: f.owner, filterCard: (card: any) => card.name === "huogong", filterTarget: (_card: any, _owner: any, target: any) => target === f.players[1] };
	const snapshot = buildDecisionCandidateSnapshot(event, f.owner, f.runtime);
	const session = new DecisionSession(event, snapshot, f.runtime);
	const started = session.accept(call("use_skill", { skill_name: "rehuoji", card_refs: ["c0"] }));
	assert.deepEqual(started.pending?.items.map(item => item.ref), ["p1"]);
	assert.throws(() => session.accept(call("select_targets", { step_id: started.pending!.id, target_refs: ["p2"] })), /outside the current action|unavailable/);
	const blockedEvent = { ...event, filterTarget: () => false };
	const blockedSnapshot = buildDecisionCandidateSnapshot(blockedEvent, f.owner, f.runtime);
	assert.throws(() => new DecisionSession(blockedEvent, blockedSnapshot, f.runtime).accept(call("use_skill", { skill_name: "rehuoji", card_refs: ["c0"] })), (error: any) => error.stage === "translate/action-resolution" && /no legal continuation/.test(error.message));
});

test("DecisionSession 自动材料内部推进，TOCTOU 与过滤异常触发回退错误", () => {
	const cards = [{ name: "a", info: { notarget: true } }, { name: "b", info: { notarget: true } }];
	const skills = { automatic: { selectionSpec: { steps: [{ type: "card", select: -1 }] }, filterCard: true, viewAs: { name: "none" } } };
	const f = fixture({ cards, skills });
	const event = { name: "chooseToRespond", player: f.owner, filterCard: (card: any) => card.name === "none" };
	const snapshot = buildDecisionCandidateSnapshot(event, f.owner, f.runtime);
	assert.equal(snapshot.actions[0].materialAutomatic, true);
	const session = new DecisionSession(event, snapshot, f.runtime);
	const accepted = session.accept(call("use_skill", { skill_name: "automatic" }));
	assert.equal(accepted.pending, undefined);
	assert.deepEqual(accepted.result.cards, cards);
	cards[0].owner = f.players[1];
	f.owner.cards = cards.slice(1);
	assert.throws(() => session.revalidate(), /ownership changed/);
	const throwing = fixture({ cards: [{ name: "x", info: { notarget: true } }], skills: { bad: { selectionSpec: { steps: [{ type: "card", select: 1, filter: () => { throw new Error("filter boom"); } }] }, filterCard: true } } });
	const badEvent = { name: "chooseToRespond", player: throwing.owner, filterCard: () => false };
	const badSnapshot = buildDecisionCandidateSnapshot(badEvent, throwing.owner, throwing.runtime);
	assert.throws(() => new DecisionSession(badEvent, badSnapshot, throwing.runtime).accept(call("use_skill", { skill_name: "bad" })), (error: any) => error.stage === "translate/action-resolution" && /filter boom/.test(error.message));
});

test("raw Player items 保留全局 pN；deadTarget 状态只进入 user 且带稳定 ref", () => {
	const dead = player("dead", 4, 0, 4);
	const f = fixture({ dead: [dead], skills: { mark: { selectionSpec: { steps: [{ type: "target", select: 1, items: [dead] }] }, filterTarget: () => true } } });
	const event = { name: "chooseToUse", player: f.owner, deadTarget: true, filterCard: () => false, filterTarget: () => true };
	const snapshot = buildDecisionCandidateSnapshot(event, f.owner, f.runtime);
	assert.deepEqual(snapshot.actions[0].target.targetRefs, ["p3"]);
	const session = new DecisionSession(event, snapshot, f.runtime);
	const completed = session.accept(call("use_skill", { skill_name: "mark", target_refs: ["p3"] }));
	assert.deepEqual(completed.result.targets, [dead]);
	const promptRuntime: any = { players: f.players, globalSkills: [], translate: String, getPlayerName: (p: any) => p.name, getSkillName: () => "", getSkillDescription: () => "", getSkillMeta: () => ({}), getEquipmentSkills: () => [], isEquipmentCard: () => false, getCardName: (c: any) => c.name, getCardProperties: () => ({ suit: "", number: 0, color: "" }), getCardDescription: () => "", getViewedAsDescription: () => "" };
	const collected = collectPromptPlayers(promptRuntime, f.owner, snapshot.targetPool.map(target => target.player));
	const states = collected.states.map((state, index) => ({ ...state, ref: snapshot.targetPool[index].ref }));
	assert.match(formatPlayerStates(states), /\[p3\]\[4号位\] dead/);
	assert.equal(collected.profiles.some(profile => profile.name === "dead"), false);
});

test("动作 prompt 对空动作、自动材料和无全局目标保持明确", () => {
	const prompt = buildDecisionSnapshot("chooseToUse", {}, { cards: [], skills: [], actions: [] }, [], { decisionDescriptions: {}, getSkillName: value => value, getSkillDescription: () => "" });
	assert.match(prompt, /## 可执行动作：\n- 无/);
	assert.doesNotMatch(prompt, /当前可选目标/);
	const automatic = buildDecisionSnapshot("chooseToRespond", {}, { cards: [{ ref: "c0", id: "a", name: "a" }], skills: ["all"], actions: [{ kind: "skill", skillName: "all", materialCardRefs: ["c0"], materialRange: [1, 1], materialAutomatic: true, target: { mode: "none", targetRefs: [] } }] }, [], { decisionDescriptions: {}, getSkillName: value => value, getSkillDescription: () => "" });
	assert.match(automatic, /材料牌=自动，可用=\[c0\]/);
	assert.doesNotMatch(automatic, /选择 -1/);
	assert.doesNotThrow(() => assertExecutableSnapshot({ name: "chooseToUse", forced: false }, { cards: [], skills: [], targetPool: [], actions: [] }));
	assert.throws(() => assertExecutableSnapshot({ name: "chooseToUse", forced: true }, { cards: [], skills: [], targetPool: [], actions: [] }), /no executable action/);
});

function player(name: string, seat: number, hp = 3, maxHp = 4): any {
	return { name, id: name, seat, hp, maxHp, cards: [] as any[], getSeatNum() { return seat; }, getHp() { return hp; }, getCards(zone: string) { return zone.includes("h") || zone.includes("e") || zone.includes("s") ? this.cards : []; }, getSkills: () => [], getKnownCards: () => [], isLinked: () => false, isTurnedOver: () => false, isIn: () => hp > 0 };
}

function call(name: string, args: Record<string, any>): any {
	return { id: `call_${name}`, name, reason: "test", arguments: args };
}

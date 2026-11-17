import assert from "node:assert/strict";
import test from "node:test";
import { buildDecisionCandidateSnapshot, type ActionCandidateRuntime } from "./action-candidates.js";
import { DecisionSession, type DecisionRuntime } from "./apply.js";
import { MoveDecisionSession } from "./move-session.js";

function player(id: string, seat: number, hp = 4, maxHp = 4) {
	return { id, playerid: id, name: id, seat, hp, maxHp, identity: "fan", cards: [] as any[], hand: () => [], getCards: function () { return this.cards; }, countCards: function () { return this.cards.length; }, isAlive: () => true };
}

function makeCall(name: string, args: Record<string, any>) {
	return { id: `call_${name}`, name, arguments: args };
}

function genericFixture(options: { skills?: Record<string, any>; cards?: any[]; players?: any[] } = {}) {
	const owner = player("owner", 1);
	const players = options.players || [owner, player("p1_target", 2), player("p2_target", 3)];
	const cards = options.cards || [];
	const skills = options.skills || {};
	owner.cards = cards;
	for (const card of cards) card.owner = owner;
	const ui: any = { selected: { buttons: [], cards: [], targets: [] } };
	const status: any = { event: null };
	const runtime: ActionCandidateRuntime & DecisionRuntime = {
		getCandidateSkills: () =>
			Object.keys(skills).filter(skill => skills[skill]?.selectionSpec !== false),
		getCandidateCards(event, current, enabledSkills) {
			return cards.flatMap((card, index) => {
				const direct = event.filterCard?.(card, current, event) === true;
				const cardSkills = enabledSkills.filter(skill => {
					const info = skills[skill];
					return info.filterCard === true || info.filterCard?.(card, current, event) === true;
				});
				return direct || cardSkills.length ? [{ card, ref: `c${index}`, id: card.name, name: card.name, cardAction: direct, skills: cardSkills }] : [];
			});
		},
		getPlayers: () => players,
		getTargetId: (target, index) => target.id || String(index),
		getTargetName: target => target.name,
		getSkillInfo: skill => skills[skill],
		getCardInfo: card => card?.info || {},
		autoViewAs: (definition, selected) => ({ ...definition, cards: selected, isViewAs: true }),
		checkSelectTarget: () => {},
		getOwner: card => card.owner,
		alivePlayers: () => players,
		deadPlayers: () => [],
		translate: value => value?.name || String(value),
		isSkillEligible: (_event, _player, skill) => !!skills[skill] && skills[skill].selectionSpec !== false,
		legacyBridgeHost: { ui, status },
	};
	return { owner, players, cards, skills, ui, status, runtime };
}

test("Stage 1: 通用技能推理支持丈八蛇矛式两牌 viewAs（无 selectionSpec）", () => {
	const c0 = { name: "shan", info: { notarget: true } };
	const c1 = { name: "tao", info: { notarget: true } };
	const skills = {
		zhangba_skill: {
			selectCard: 2,
			filterCard: true,
			viewAs: { name: "sha" },
		},
	};
	const f = genericFixture({ cards: [c0, c1], skills });
	f.runtime.getCardInfo = card => (card.name === "sha" ? { selectTarget: 1 } : card.info || {});
	const event = {
		name: "chooseToUse",
		player: f.owner,
		filterCard: (card: any) => card.name === "sha",
		filterTarget: (_card: any, owner: any, target: any) => target !== owner,
	};
	const snapshot = buildDecisionCandidateSnapshot(event, f.owner, f.runtime);
	const action = snapshot.actions.find(item => item.skillName === "zhangba_skill")!;
	assert.ok(action);
	assert.equal(action.target.mode, "dynamic");
	assert.deepEqual(action.materialRange, [2, 2]);

	const session = new DecisionSession(event, snapshot, f.runtime);
	const pending = session.accept(makeCall("use_skill", { skill_name: "zhangba_skill", card_refs: ["c0", "c1"] }));
	assert.deepEqual(
		pending.pending?.items.map(item => item.ref),
		["p1", "p2"]
	);
	const completed = session.accept(makeCall("select_targets", { step_id: pending.pending!.id, target_refs: ["p1"] }));
	assert.deepEqual(completed.result, {
		bool: true,
		skill: "zhangba_skill",
		card: { name: "sha", cards: [c0, c1], isViewAs: true },
		cards: [c0, c1],
		targets: [f.players[1]],
	});
});

test("Stage 1: _recasting 无目标单牌重铸自动完成且不伪造 card", () => {
	const iron = { name: "tiesuo", recastable: true, info: { selectTarget: [1, 2] } };
	const sha = { name: "sha", recastable: false, info: { selectTarget: 1 } };
	const skills = {
		_recasting: {
			selectCard: 1,
			filterCard: (card: any) => !!card.recastable,
		},
	};
	const f = genericFixture({ cards: [iron, sha], skills });
	const event = { name: "chooseToUse", player: f.owner, filterCard: () => false, filterTarget: () => false };
	const snapshot = buildDecisionCandidateSnapshot(event, f.owner, f.runtime);
	const action = snapshot.actions.find(item => item.skillName === "_recasting")!;
	assert.ok(action);
	assert.deepEqual(action.materialCardRefs, ["c0"]);
	assert.equal(action.target.mode, "none");

	const completed = new DecisionSession(event, snapshot, f.runtime).accept(makeCall("use_skill", { skill_name: "_recasting", card_refs: ["c0"] }));
	assert.deepEqual(completed.result, {
		bool: true,
		skill: "_recasting",
		cards: [iron],
		targets: [],
	});
});

test("Stage 1: 深度桥接 ui.selected / _status.event._backup / filterOk 并在退出后恢复", () => {
	const red = { name: "huosha", suit: "heart", info: { notarget: true } };
	const black = { name: "sha", suit: "spade", info: { notarget: true } };
	let sawBackup = false;
	const skills = {
		legacy_combo: {
			selectCard: 2,
			filterCard: (card: any) => !f.ui.selected.cards.some((chosen: any) => chosen.suit === card.suit),
			filterTarget: () => f.status.event?._backup?.filterTarget?.() === true,
			selectTarget: 1,
			filterOk: () => {
				sawBackup = !!f.status.event?._backup?.filterOk && f.ui.selected.cards.length === 2 && f.ui.selected.targets.length === 1;
				return f.ui.selected.cards.some((card: any) => card.suit === "heart") && f.ui.selected.targets.length === 1;
			},
		},
	};
	const f = genericFixture({ cards: [red, black], skills });
	const originalEvent = { tag: "outer" };
	f.status.event = originalEvent;
	const event = {
		name: "chooseToUse",
		player: f.owner,
		filterCard: () => false,
		filterTarget: () => true,
		filterOk: () => true,
	};
	const snapshot = buildDecisionCandidateSnapshot(event, f.owner, f.runtime);
	assert.equal(f.status.event, originalEvent);
	assert.deepEqual(f.ui.selected, { buttons: [], cards: [], targets: [] });

	const session = new DecisionSession(event, snapshot, f.runtime);
	const stage1 = session.accept(makeCall("use_skill", { skill_name: "legacy_combo", card_refs: ["c0", "c1"] }));
	assert.equal(stage1.pending?.type, "target");
	const finished = session.accept(makeCall("select_targets", { step_id: stage1.pending!.id, target_refs: ["p1"] }));
	assert.equal(sawBackup, true);
	assert.equal(finished.result.bool, true);
	assert.equal(finished.result.skill, "legacy_combo");
	assert.equal(f.status.event, originalEvent);
	assert.equal((event as any)._backup, undefined);
	assert.deepEqual(f.ui.selected, { buttons: [], cards: [], targets: [] });
});

test("Stage 1: selectionSpec: false 显式禁用且单技能异常隔离不影响其他技能", () => {
	const sha = { name: "sha", info: { selectTarget: 1 } };
	const skills = {
		disabled_skill: {
			selectionSpec: false,
			selectTarget: 1,
			filterTarget: () => true,
		},
		broken_generic: {
			selectTarget: () => {
				throw new Error("generic range boom");
			},
			filterTarget: () => true,
		},
		ok_generic: {
			selectTarget: 1,
			filterTarget: (_card: any, owner: any, target: any) => target !== owner,
		},
	};
	const f = genericFixture({ cards: [sha], skills });
	const event = { name: "chooseToUse", player: f.owner, filterCard: () => true, filterTarget: (_card: any, owner: any, target: any) => target !== owner };
	const snapshot = buildDecisionCandidateSnapshot(event, f.owner, f.runtime);
	assert.equal(snapshot.actions.some(a => a.skillName === "disabled_skill"), false);
	assert.equal(snapshot.actions.some(a => a.skillName === "broken_generic"), false);
	assert.equal(snapshot.actions.some(a => a.skillName === "ok_generic"), true);
	assert.equal(snapshot.actions.some(a => a.kind === "card"), true);
	assert.equal(snapshot.skippedActions?.some(item => item.id === "skill:broken_generic"), true);
});

test("Stage 2: 借刀杀人（defaultSelectTarget 加倍范围 + singleCard + filterAddedTarget）两阶段选目标", () => {
	const jiedao = {
		name: "jiedao",
		info: {
			selectTarget: 1,
			singleCard: true,
			complexTarget: true,
			targetprompt: ["被借刀", "出杀目标"],
			filterAddedTarget: (_card: any, _player: any, target: any, preTarget: any) => preTarget.id === "p1_target" && target.id === "p2_target",
		},
	};
	const f = genericFixture({ cards: [jiedao] });
	const defaultSelectTarget = (card: any) => {
		const info = card?.info || {};
		return info.singleCard && info.filterAddedTarget ? [2, 2] : [1, 1];
	};
	f.runtime.defaultSelectTarget = defaultSelectTarget;
	const event = {
		name: "chooseToUse",
		player: f.owner,
		selectTarget: defaultSelectTarget,
		filterCard: () => true,
		filterTarget: (card: any, owner: any, target: any) => {
			if (f.ui.selected.targets.length > 0) {
				return jiedao.info.filterAddedTarget(card, owner, target, f.ui.selected.targets[f.ui.selected.targets.length - 1]);
			}
			return target.id === "p1_target";
		},
	};
	const snapshot = buildDecisionCandidateSnapshot(event, f.owner, f.runtime);
	assert.equal(snapshot.actions.length, 1);
	assert.equal(snapshot.actions[0].target.mode, "dynamic");

	const session = new DecisionSession(event, snapshot, f.runtime);
	const stage1 = session.accept(makeCall("use_card", { card_ref: "c0" }));
	assert.deepEqual(stage1.pending?.range, [1, 1]);
	assert.deepEqual(stage1.pending?.items.map(item => item.ref), ["p1"]);
	assert.equal(stage1.pending?.instruction, "当前目标（1/2）：被借刀");
	assert.throws(
		() => session.accept(makeCall("select_targets", { step_id: stage1.pending!.id, target_refs: ["p2"] })),
		/selection: unavailable \(p2 不可选；当前可选: p1\)/
	);
	const stage2 = session.accept(makeCall("select_targets", { step_id: stage1.pending!.id, target_refs: ["p1"] }));
	assert.deepEqual(stage2.pending?.range, [1, 1]);
	assert.deepEqual(stage2.pending?.items.map(item => item.ref), ["p2"]);
	assert.equal(stage2.pending?.instruction, "当前目标（2/2）：出杀目标");
	const done = session.accept(makeCall("select_targets", { step_id: stage2.pending!.id, target_refs: ["p2"] }));
	assert.deepEqual(done.result, { bool: true, card: jiedao, cards: [jiedao], targets: [f.players[1], f.players[2]] });
});

test("Stage 2: 新连环 0 目标重铸与重铸/连环分支均遵循技能 selectTarget", () => {
	const club = { name: "shan", suit: "club", info: { notarget: true } };
	const skills = {
		xinlianhuan: {
			filterCard: (card: any) => card.suit === "club",
			selectTarget: () => [0, 2],
			viewAs: { name: "tiesuo" },
		},
	};
	const f = genericFixture({ cards: [club], skills });
	f.runtime.getCardInfo = card => (card.name === "tiesuo" ? { selectTarget: [1, 2] } : card.info || {});
	const event = {
		name: "chooseToUse",
		player: f.owner,
		filterCard: (card: any) => card.name === "tiesuo",
		filterTarget: () => true,
	};
	const snapshot = buildDecisionCandidateSnapshot(event, f.owner, f.runtime);

	// 分支 A：0 目标重铸
	const s1 = new DecisionSession(event, snapshot, f.runtime);
	const p1 = s1.accept(makeCall("use_skill", { skill_name: "xinlianhuan", card_refs: ["c0"] }));
	assert.deepEqual(p1.pending?.range, [0, 2]);
	const recast = s1.accept(makeCall("select_targets", { step_id: p1.pending!.id, target_refs: [] }));
	assert.deepEqual(recast.result.targets, []);
	assert.equal(recast.result.card.name, "tiesuo");

	// 分支 B：2 目标连环
	const s2 = new DecisionSession(event, snapshot, f.runtime);
	const p2 = s2.accept(makeCall("use_skill", { skill_name: "xinlianhuan", card_refs: ["c0"] }));
	const tie = s2.accept(makeCall("select_targets", { step_id: p2.pending!.id, target_refs: ["p1", "p2"] }));
	assert.deepEqual(tie.result.targets, [f.players[1], f.players[2]]);
});

test("Stage 2: 缔盟式 complexTarget 顺序选目标与手牌差 filterOk", () => {
	const h0 = { name: "sha", info: {} };
	const h1 = { name: "shan", info: {} };
	const p1 = { ...player("rich", 2), countCards: () => 2 };
	const p2 = { ...player("poor", 3), countCards: () => 0 };
	const owner = player("owner", 1);
	const skills = {
		redimeng: {
			selectCard: () => {
				if (!f.ui.selected.targets.length) return [0, 2];
				const diff = Math.abs(f.ui.selected.targets[0].countCards("h") - (f.ui.selected.targets[1]?.countCards("h") ?? 0));
				return diff;
			},
			filterCard: true,
			selectTarget: 2,
			complexTarget: true,
			filterTarget: (_card: any, me: any, target: any) => {
				if (target === me) return false;
				if (!f.ui.selected.targets.length) return true;
				return f.ui.selected.targets[0] !== target;
			},
			filterOk: () => f.ui.selected.targets.length === 2 && f.ui.selected.cards.length === Math.abs(f.ui.selected.targets[0].countCards("h") - f.ui.selected.targets[1].countCards("h")),
		},
	};
	const f = genericFixture({ cards: [h0, h1], players: [owner, p1, p2], skills });
	const event = { name: "chooseToUse", player: f.owner, filterCard: () => false, filterTarget: () => false };
	const snapshot = buildDecisionCandidateSnapshot(event, f.owner, f.runtime);
	const session = new DecisionSession(event, snapshot, f.runtime);
	const pending = session.accept(makeCall("use_skill", { skill_name: "redimeng", card_refs: ["c0", "c1"] }));
	assert.equal(pending.pending?.type, "target");
	const done = session.accept(makeCall("select_targets", { step_id: pending.pending!.id, target_refs: ["p1", "p2"] }));
	assert.deepEqual(done.result, { bool: true, skill: "redimeng", cards: [h0, h1], targets: [p1, p2] });
});

test("Stage 2: 非 viewAs 的 chooseButton.backup（清策式）不伪造 result.card", () => {
	const c0 = { name: "sha", info: {} };
	const f = genericFixture({
		cards: [c0],
		skills: {
			qingce_backup: {
				filterCard: true,
				selectCard: 1,
				filterTarget: (_card: any, owner: any, target: any) => target !== owner,
			},
		},
	});
	const backupEvent = {
		name: "chooseToUse",
		skill: "qingce_backup",
		player: f.owner,
		filterCard: true,
		selectCard: 1,
		filterTarget: f.skills.qingce_backup.filterTarget,
		_backup: { filterCard: () => true, filterTarget: () => true },
	};
	const snapshot = {
		cards: [{ card: c0, ref: "c0", id: "sha", name: "sha", cardAction: false, skills: ["qingce_backup"] }],
		skills: [],
		targetPool: f.players.map((p, idx) => ({ player: p, ref: `p${idx}`, id: p.id, name: p.name })),
		actions: [],
	};
	const session = new DecisionSession(backupEvent, snapshot, f.runtime);
	assert.equal(session.stage?.type, "card");
	const stage2 = session.accept(makeCall("select_cards", { step_id: session.stage!.id, card_refs: ["c0"] }));
	assert.equal(stage2.pending?.type, "target");
	const done = session.accept(makeCall("select_targets", { step_id: stage2.pending!.id, target_refs: ["p1"] }));
	assert.equal("card" in done.result, false);
	assert.deepEqual(done.result, { bool: true, skill: "qingce_backup", cards: [c0], targets: [f.players[1]] });
});

test("Stage 3: DecisionSession checkpoint/rollback 完整回滚失败的中间步骤与上下文", () => {
	const c0 = { name: "sha", info: {} };
	const c1 = { name: "shan", info: {} };
	const p1 = { ...player("rich", 2), countCards: () => 2 };
	const p2 = { ...player("poor", 3), countCards: () => 1 };
	const skills = {
		combo: {
			selectCard: [1, 2],
			filterCard: true,
			selectTarget: 2,
			complexTarget: true,
			filterTarget: (_c: any, me: any, t: any) => t !== me,
			filterOk: () => f.ui.selected.cards.length === Math.abs(f.ui.selected.targets[0].countCards("h") - f.ui.selected.targets[1].countCards("h")),
		},
	};
	const f = genericFixture({ cards: [c0, c1], players: [player("owner", 1), p1, p2], skills });
	const event = { name: "chooseToUse", player: f.owner, filterCard: () => false, filterTarget: () => false };
	const snapshot = buildDecisionCandidateSnapshot(event, f.owner, f.runtime);
	const session = new DecisionSession(event, snapshot, f.runtime);
	const step1 = session.accept(makeCall("use_skill", { skill_name: "combo", card_refs: ["c0"] }));
	const cp = session.checkpoint();
	assert.throws(() => session.accept(makeCall("select_targets", { step_id: step1.pending!.id, target_refs: ["p2"] })), /selection:/);
	session.rollback(cp);
	assert.equal(session.stage?.id, step1.pending!.id);
	const ok = session.accept(makeCall("select_targets", { step_id: step1.pending!.id, target_refs: ["p1", "p2"] }));
	assert.equal(ok.result.bool, true);
	assert.deepEqual(ok.result.cards, [c0]);
	assert.deepEqual(ok.result.targets, [p1, p2]);
});

test("Stage 4: MoveDecisionSession 支持无 selectionSpec 的通用分区排序并拦截自定义 filterMove / selectionSpec: false", () => {
	const c0 = { name: "sha", suit: "spade" };
	const c1 = { name: "tao", suit: "heart" };
	const c2 = { name: "jiu", suit: "club" };
	const runtime = {
		translate: (v: any) => v.name,
		getSuit: (v: any) => v.suit,
	};
	const genericEvent = {
		name: "chooseToMove",
		list: [
			["手牌", [c0, c1]],
			["牌堆顶", [c2]],
		],
		filterOk: (moved: any[][]) => moved[0].length === 1 && moved[1].length === 2,
	};
	const session = new MoveDecisionSession(genericEvent, runtime);
	assert.equal(session.stage.piles.length, 2);
	assert.throws(() => session.accept(makeCall("move_cards", { piles: [["m0", "m1"], ["m2"]] })), /rejected proposal/);
	const ok = session.accept(makeCall("move_cards", { piles: [["m0"], ["m1", "m2"]] }));
	assert.deepEqual(ok.result, { bool: true, moved: [[c0], [c1, c2]] });

	const defaultFilterMove = Object.assign(() => true, { [Symbol.for("noname.defaultMoveFilter")]: true });
	const withDefaultFilter = new MoveDecisionSession({ ...genericEvent, filterMove: defaultFilterMove }, runtime);
	assert.equal(withDefaultFilter.stage.piles.length, 2);

	assert.throws(() => new MoveDecisionSession({ ...genericEvent, filterMove: () => true }, runtime), /UI-dependent filterMove/);
	assert.throws(() => new MoveDecisionSession({ ...genericEvent, selectionSpec: false }, runtime), /selectionSpec: false/);
});

import { createModuleRuntime } from "./module-runtime.mjs";

export const tool = (name, args = {}) => ({ id: "mock-call", name, arguments: args, reason: "固定测试决策" });

/** Deterministic rules boundary; skill declarations and selection code are real. */
export async function createSkillRuntime(overrides = {}) {
	/** @type {{skill: Record<string, any> & {global: string[]}, card: Record<string, any>, filter: Record<string, Function>, translate: Record<string, string>}} */
	const lib = { skill: { global: [] }, card: {}, filter: {}, translate: {} };
	const game = { players: [], dead: [], checkMod: (_card, _player, result) => result, expandSkills: skills => skills, hasPlayer: filter => game.players.some(filter), countPlayer: filter => game.players.filter(filter || (() => true)).length, ...overrides.game };
	const get = {
		translation: value => (typeof value === "string" ? value : value?.link ? get.translation(value.link) : value?.name || String(value)),
		filter: filter => value => Object.entries(filter || {}).every(([key, expected]) => (Array.isArray(expected) ? expected.includes(get[key]?.(value) ?? value[key]) : (get[key]?.(value) ?? value[key]) === expected)),
		name: card => card.name,
		suit: card => card.suit,
		number: card => card.number,
		position: card => card.position || "h",
		color: card => (["heart", "diamond"].includes(card.suit) ? "red" : "black"),
		type: card => (["sha", "shan", "tao", "jiu"].includes(card.name) ? "basic" : "trick"),
		autoViewAs: (definition, cards) => ({ ...definition, cards }),
		info: value => (typeof value === "string" ? lib.skill[value] : lib.card[value?.name] || {}),
		owner: card => card.owner,
		mode: () => "identity",
		zhu: () => null,
		poptip: value => value,
		attitude: () => 1,
		value: () => 5,
		...overrides.get,
	};
	Object.assign(lib.filter, { notMe: (_card, player, target) => player !== target, cardDiscardable: () => true, cardRespondable: () => true, all: () => true, filterEnable: (event, player, skill) => (event.skills || player.skills || []).includes(skill) });
	const moduleRuntime = await createModuleRuntime({ lib, game, get, ui: {}, ai: {}, _status: {}, ...overrides.engine }, {}, overrides.modules);
	for (const pack of ["standard", "refresh", "extra"]) Object.assign(lib.skill, (await moduleRuntime.import(`character/${pack}/skill.js`)).default);
	lib.skill.shenzhi = (await moduleRuntime.import("character/sp/skill.js")).default.shenzhi;
	for (const [name, skill] of Object.entries(lib.skill)) {
		for (const [key, sub] of Object.entries(skill.subSkill || {})) lib.skill[`${name}_${key}`] = sub;
	}
	Object.assign(lib.card, (await moduleRuntime.import("card/standard.js")).default.card, {
		jiu: { filterTarget: (_card, player, target) => player === target, selectTarget: -1 },
	});
	const { getCandidateCards } = await moduleRuntime.import("noname/llm/candidates.ts");
	const { buildCandidateSnapshot } = await moduleRuntime.import("noname/llm/action-candidates.ts");
	const { DecisionSession } = await moduleRuntime.import("noname/llm/apply.ts");
	const { MoveDecisionSession } = await moduleRuntime.import("noname/llm/move-session.ts");
	const runtime = {
		getCandidateSkills: event => event.skills || [],
		getCandidateCards,
		getPlayers: () => game.players,
		getTargetId: player => player.playerid,
		getTargetName: player => player.name,
		getSkillInfo: id => lib.skill[id],
		getCardInfo: get.info,
		autoViewAs: get.autoViewAs,
		checkSelectTarget() {},
		getOwner: get.owner,
		alivePlayers: () => game.players,
		deadPlayers: () => game.dead,
		translate: get.translation,
		normalizeFilter: get.filter,
		getSuit: get.suit,
		isSkillEligible: (event, _player, skill) => event.skills?.includes(skill) && !!lib.skill[skill]?.selectionSpec,
	};
	function player(name, cards = []) {
		const value = {
			name,
			playerid: name,
			cards,
			hp: 2,
			maxHp: 4,
			group: "shu",
			sex: "male",
			storage: {},
			getCards: position => cards.filter(card => position.includes(card.position || "h")),
			countCards(position, filter) {
				return this.getCards(position).filter(card => (!filter || typeof filter === "string" ? !filter || card.name === filter : typeof filter === "function" ? filter(card) : get.filter(filter)(card))).length;
			},
			hasCards(position, filter) {
				return this.countCards(position, filter) > 0;
			},
			hasSex: sex => value.sex === sex,
			isDamaged: () => value.hp < value.maxHp,
			isIn: () => true,
			hasSkill: () => false,
			hasZhuSkill: () => true,
			getStat: () => ({ skill: {} }),
			getSkills: () => value.skills || [],
			getName: () => name,
			getSeatNum: () => game.players.indexOf(value) + 1,
			getStorage: name => value.storage[name] || [],
			canUse: (_card, target) => target !== value,
			inRange: target => target !== value,
			hasJudge: () => false,
			canEquip: () => true,
			hasSkillTag: () => false,
			getGainableCards: (_player, position) => value.getCards(position),
			getDiscardableCards: (_player, position) => value.getCards(position),
		};
		for (const card of cards) card.owner = value;
		game.players.push(value);
		return value;
	}
	function session(event) {
		const snapshot = buildCandidateSnapshot(event, event.player, runtime);
		return { snapshot, decision: new DecisionSession(event, snapshot, runtime) };
	}
	return { lib, game, get, runtime, player, session, moduleRuntime, MoveDecisionSession };
}

export function driveStages(decision, first, choose = stage => stage.items.slice(0, stage.range[0]).map(item => item.ref)) {
	let result = decision.accept(first);
	let turns = 0;
	while (result.pending) {
		if (++turns > 8) throw new Error("test decision exceeded stage budget");
		const stage = result.pending;
		result = decision.accept(tool(`select_${stage.type}s`, { step_id: stage.id, [`${stage.type}_refs`]: choose(stage) }));
	}
	return result.result;
}

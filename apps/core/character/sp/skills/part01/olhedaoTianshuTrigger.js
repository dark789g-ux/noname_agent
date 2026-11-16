import { lib, game, ui, get, ai, _status } from "noname";

export const olhedaoTianshuTrigger = [
	//用牌相关
	{
		fromIndex: 1,
		name: "当你使用牌后",
		effect: {
			trigger: { player: "useCardAfter" },
		},
	},
	{
		fromIndex: 2,
		name: "当你使用或打出【闪】时",
		effect: {
			trigger: { player: ["useCard", "respond"] },
			filter(event, player) {
				return event.card.name === "shan";
			},
		},
	},
	{
		fromIndex: 2,
		name: "当你成为【杀】的目标时",
		effect: {
			trigger: { target: "useCardToTarget" },
			filter(event, player) {
				return event.card.name === "sha";
			},
		},
	},
	{
		fromIndex: 2,
		name: "当你成为普通锦囊牌的目标后",
		effect: {
			trigger: { target: "useCardToTargeted" },
			filter(event, player) {
				return get.type(event.card) === "trick";
			},
		},
	},
	{
		fromIndex: 1,
		name: "其他角色对你使用牌后",
		effect: {
			trigger: { global: "useCardAfter" },
			filter(event, player) {
				return event.player !== player && event.targets?.includes(player);
			},
		},
	},
	{
		fromIndex: 3,
		name: "一名角色使用【南蛮入侵】或【万箭齐发】后",
		effect: {
			trigger: { global: "useCardAfter" },
			filter(event, player) {
				return ["nanman", "wanjian"].includes(event.card?.name);
			},
		},
	},
	{
		fromIndex: 2,
		name: "当你使用牌被抵消后",
		effect: {
			trigger: { player: ["eventNeutralized", "shaMiss"] },
			filter(event, player) {
				return event.type === "card";
			},
		},
	},
	//失去牌相关
	{
		fromIndex: 1,
		name: "当你失去手牌后",
		effect: {
			trigger: {
				player: "loseAfter",
				global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
			},
			filter(event, player) {
				return event.getl?.(player)?.hs?.length;
			},
		},
	},
	{
		fromIndex: 3,
		name: "当你失去装备牌后",
		effect: {
			trigger: {
				player: "loseAfter",
				global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
			},
			filter(event, player) {
				return event.getl?.(player)?.cards2?.some(i => get.type(i, null, player) === "equip");
			},
		},
	},
	{
		fromIndex: 2,
		name: "当你于回合外失去红色牌后",
		effect: {
			trigger: {
				player: "loseAfter",
				global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
			},
			filter(event, player) {
				return _status.currentPhase !== player && event.getl?.(player)?.cards2?.some(i => get.color(i, player) === "red");
			},
		},
	},
	{
		fromIndex: 3,
		name: "一名角色失去最后的手牌后",
		effect: {
			trigger: {
				global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
			},
			filter(event, player) {
				return game.hasPlayer(target => !target.countCards("h") && event.getl?.(target)?.hs?.length);
			},
		},
	},
	//判定相关
	{
		fromIndex: 2,
		name: "当一张判定牌生效前",
		effect: {
			trigger: { global: "judge" },
		},
	},
	{
		fromIndex: 2,
		name: "当一张判定牌生效后",
		effect: {
			trigger: { global: "judgeAfter" },
		},
	},
	//阶段相关
	{
		fromIndex: 2,
		name: "每轮开始时",
		effect: {
			trigger: { global: "roundStart" },
		},
	},
	{
		fromIndex: 2,
		name: "准备阶段",
		effect: {
			trigger: { player: "phaseZhunbeiBegin" },
		},
	},
	{
		fromIndex: 2,
		name: "摸牌阶段开始时",
		effect: {
			trigger: { player: "phaseDrawBegin" },
		},
	},
	{
		fromIndex: 2,
		name: "出牌阶段开始时",
		effect: {
			trigger: { player: "phaseUseBegin" },
		},
	},
	{
		fromIndex: 2,
		name: "弃牌阶段开始时",
		effect: {
			trigger: { player: "phaseDiscardBegin" },
		},
	},
	{
		fromIndex: 2,
		name: "结束阶段",
		effect: {
			trigger: { player: "phaseJieshuBegin" },
		},
	},
	//伤害相关
	{
		fromIndex: 2,
		name: "当你造成伤害后",
		effect: {
			trigger: { source: "damageSource" },
		},
	},
	{
		fromIndex: 2,
		name: "当你受到伤害后",
		effect: {
			trigger: { player: "damageEnd" },
		},
	},
	{
		fromIndex: 2,
		name: "当你的体力值变化后",
		effect: {
			trigger: { player: "changeHpEnd" },
			filter(event, player) {
				return event.changedHp != 0;
			},
		},
	},
	{
		fromIndex: 3,
		name: "当你使用【杀】造成伤害后",
		effect: {
			trigger: { source: "damageSource" },
			filter(event, player) {
				return event.card?.name === "sha";
			},
		},
	},
	{
		fromIndex: 2,
		name: "一名角色受到【杀】造成的伤害后",
		effect: {
			trigger: { global: "damageEnd" },
			filter(event, player) {
				return event.card?.name === "sha";
			},
		},
	},
	{
		fromIndex: 2,
		name: "一名角色造成伤害时",
		effect: {
			trigger: { global: "damageBegin3" },
			filter(event, player) {
				return event.source?.isIn();
			},
		},
	},
	{
		fromIndex: 2,
		name: "一名角色受到伤害时",
		effect: {
			trigger: { global: "damageBegin4" },
		},
	},
	{
		fromIndex: 3,
		name: "一名角色受到属性伤害后",
		effect: {
			trigger: { global: "damageEnd" },
			filter(event, player) {
				return event.hasNature();
			},
		},
	},
	//其他
	{
		fromIndex: 3,
		name: "一名角色进入濒死状态时",
		effect: {
			trigger: { global: "dying" },
		},
	},
	{
		fromIndex: 3,
		name: "其他角色死亡后",
		effect: {
			trigger: { global: "dieAfter" },
			filter(event, player) {
				return event.player !== player;
			},
		},
	},
	{
		fromIndex: 2,
		name: "一名角色进入连环状态后",
		effect: {
			trigger: { global: "linkAfter" },
			filter(event, player) {
				return event.player.isLinked();
			},
		},
	},
];

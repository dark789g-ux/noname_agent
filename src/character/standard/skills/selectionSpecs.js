import { game, get, lib } from "noname";

/** Reviewed pure replacements for callbacks that read UI selection state. */
/** @returns {SelectionSpec} */
export function lijianSelectionSpec() {
	return {
		orderedTargets: true,
		steps: [
			{ type: "card", select: 1 },
			{
				type: "target",
				select: 2,
				selectionMode: "sequential",
				instruction: "按顺序提交：第 1 名先出杀，第 2 名对第 1 名使用决斗（后出杀）。",
				filter(target, player, context, selected) {
					if (target === player || !target.hasSex("male")) return false;
					const previous = context.resolveTargets(selected);
					return previous.length === 0 || (previous.length === 1 && target !== previous[0] && target.canUse({ name: "juedou" }, previous[0]));
				},
			},
		],
	};
}

/** @returns {SelectionSpec} */
export function guicaiCostSpec(event, player) {
	return {
		steps: [
			{
				type: "card",
				select: 1,
				filter(card) {
					const enabled = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
					if (enabled !== "unchanged") return !!enabled;
					const respond = game.checkMod(card, player, "unchanged", "cardRespondable", player);
					return respond === "unchanged" || !!respond;
				},
			},
		],
	};
}

/** @returns {SelectionSpec} */
export function liuliCostSpec(event, player) {
	return {
		steps: [
			{ type: "card", select: 1, filter: card => lib.filter.cardDiscardable(card, player, event) },
			{ type: "target", select: 1, filter: target => player.inRange(target) && target !== event.source && !!lib.filter.targetEnabled(event.card, event.source, target) },
		],
	};
}

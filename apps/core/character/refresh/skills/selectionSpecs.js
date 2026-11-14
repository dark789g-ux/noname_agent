import { game, get, lib } from "noname";

/** @returns {SelectionSpec} */
export function rejieyinSelectionSpec() {
	return {
		steps: [
			{ type: "card", select: 1 },
			{
				type: "target",
				select: 1,
				deferredFromCards: true,
				filter(target, player, context) {
					const card = context.selectedCards[0];
					return !!card && target.hasSex("male") && (get.position(card) !== "e" || target.canEquip(card));
				},
			},
		],
	};
}

/** @returns {SelectionSpec} */
export function reguoseSelectionSpec() {
	return {
		steps: [
			{ type: "card", select: 1 },
			{
				type: "target",
				select: 1,
				deferredFromCards: true,
				filter(target, player, context) {
					const card = context.selectedCards[0];
					if (!card) return false;
					if (get.position(card) !== "s" && lib.filter.cardDiscardable(card, player, "reguose") && target.hasJudge("lebu")) return true;
					if (player === target || !game.checkMod(card, player, "unchanged", "cardEnabled2", player)) return false;
					return player.canUse({ name: "lebu", cards: context.selectedCards.slice() }, target);
				},
			},
		],
	};
}

/** @returns {SelectionSpec} */
export function ollongdanSelectionSpec(event, player) {
	return {
		steps: [
			{
				type: "card",
				select: 1,
				filter(card) {
					const names = { sha: "shan", shan: "sha", tao: "jiu", jiu: "tao" };
					const name = names[get.name(card, player)];
					return !!name && (event._backup?.filterCard || event.filterCard)({ name, cards: [card] }, player, event) === true;
				},
			},
		],
	};
}

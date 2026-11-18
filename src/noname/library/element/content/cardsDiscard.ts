import { _status, game, get, lib, ui, ai } from "noname";
import { GameEvent, initializeEvent, type RawGameDrawEvent } from "../gameEvent.js";
import { Player } from "../player.js";
import type { LegacyChooseButtonCreateDialog } from "../Player/legacyParams";
import { delay } from "@/util/index.js";
import { tryLLMDecide } from "@/llm/index.js";
import { forwardEventLogSkill, getLogSkillName } from "../GameEvent/logSkill.js";
import { getButtonSubtypes } from "../GameEvent/buttonSubtypes.js";
import { isImportModePayload, isSelectionResultObject as isBoundarySelectionResultObject, normalizeSelectionResult as normalizeBoundarySelectionResult, type SelectionResultRuntime } from "../GameEvent/resultBoundary.js";
import { getRegisteredSkill, requireRegisteredSkill } from "../../skillRegistry.js";
import { isRecord, isAIResult, isSelectionResultObject, normalizeSelectionResult, isCardLinks, isVCardLinks, isCardMatrix, normalizeChooseButtonTargetResult, applyLLMDecision, attachChooseButtonSelectionSpec } from "./selectionResults.js";

export const cardsDiscardContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
	async cardsDiscard(event, trigger, player) {
		const { cards } = event;

		game.getGlobalHistory().cardMove.push(event);
		let withPile = false;
		for (const card of cards) {
			if (card.willBeDestroyed("discardPile", null, event)) {
				card.selfDestroy(event);
				continue;
			}

			if (get.position(card, true) == "c") {
				withPile = true;
			}

			card.discard();
		}
		if (withPile) {
			game.updateRoundNumber();
		}
		const waitings: GameEvent[] = [];
		for (const [key, value] of lib.commonArea) {
			const list = (_status[value.areaStatusName] || []).filter(card => cards.includes(card));
			if (event[value.fromName] || list.length) {
				const next = initializeEvent(game.createEvent(`from_${value.fromName}`), { cards });
				next.setContent(value.removeHandeler);
				next.player = player;
				next.type = event.name;
				waitings.push(next);
			}
		}
		await Promise.all(waitings);
	},
	async orderingDiscard(event, trigger, player) {
		const cards = event.relatedEvent.orderingCards.filter(card => get.position(card, true) == "o");
		if (cards.length) {
			await game.cardsDiscard(cards);
		}
	},
	async cardsGotoOrdering(event, trigger, player) {
		const { cards } = event;
		game.getGlobalHistory().cardMove.push(event);
		let withPile = false;
		for (const card of cards) {
			if (card.willBeDestroyed("ordering", null, event)) {
				card.selfDestroy(event);
				continue;
			}
			if (get.position(card, true) == "c") {
				withPile = true;
			}
			card.fix();
			ui.ordering.appendChild(card);
		}
		if (withPile) {
			game.updateRoundNumber();
		}
		const waitings: GameEvent[] = [];
		for (const [key, value] of lib.commonArea) {
			const list = (_status[value.areaStatusName] || []).filter(card => cards.includes(card));
			if (event[value.fromName] || list.length) {
				const next = initializeEvent(game.createEvent(`from_${value.fromName}`), { cards });
				next.setContent(value.removeHandeler);
				next.player = player;
				next.type = event.name;
				waitings.push(next);
			}
		}
		const evt = event.relatedEvent || event.getParent();
		if (!evt.orderingCards) {
			evt.orderingCards = [];
		}
		if (!evt.noOrdering && !evt.cardsOrdered) {
			evt.cardsOrdered = true;
			const next = game.createEvent("orderingDiscard", false);
			event.next.remove(next);
			evt.after.push(next);
			next.relatedEvent = evt;
			next.setContent("orderingDiscard");
			waitings.push(next);
		}
		if (!evt.noOrdering) {
			evt.orderingCards.addArray(cards);
		}
		event.result = { cards };
		await Promise.all(waitings);
	},
	async cardsGotoSpecial(event, trigger, player) {
		const { cards } = event;

		game.getGlobalHistory().cardMove.push(event);

		let withPile = false;
		for (const card of cards) {
			if (card.willBeDestroyed("special", null, event)) {
				card.selfDestroy(event);
				continue;
			}
			if (get.position(card, true) == "c") {
				withPile = true;
			}
			card.fix();
			ui.special.appendChild(card);
		}
		if (withPile) {
			game.updateRoundNumber();
		}

		const waitings: GameEvent[] = [];
		for (const [key, value] of lib.commonArea) {
			if (event[value.toName]) {
				const next = initializeEvent(game.createEvent(`lose_${value.toName}`), { cards });
				next.setContent(value.addHandeler);
				next.player = player;
				next.relatedEvent = event;
				next.type = event.name;
				waitings.push(next);
			}
		}

		await Promise.all(waitings);
	},
	async cardsGotoPile(event, trigger, player) {
		const { cards } = event;
		const waitings: GameEvent[] = [];
		if (event.washCard) {
			const washCardEvent = event.trigger("washCard");
			if (washCardEvent) {
				waitings.push(washCardEvent);
			}
			for (let i = 0; i < lib.onwash.length; ++i) {
				if (lib.onwash[i]() == "remove") {
					lib.onwash.splice(i--, 1);
				}
			}
		}
		game.getGlobalHistory().cardMove.push(event);
		if (!event._triggeronly) {
			game.$cardsGotoPile(event);
			for (const [key, value] of lib.commonArea) {
				const list = (_status[value.areaStatusName] || []).filter(card => cards.includes(card));
				if (event[value.fromName] || list.length) {
					const next = initializeEvent(game.createEvent(`from_${value.fromName}`), { cards });
					next.setContent(value.removeHandeler);
					next.player = player;
					next.type = event.name;
					waitings.push(next);
				}
			}
		}

		await Promise.all(waitings);
	},
	async chooseToEnable(event, trigger, player) {
		const { source } = event;
		if (event.selectButton) {
			const list: string[] = Array(5);
			for (let i = 0; i < 5; i++) {
				list[i] = `equip${i + 1}`;
			}
			const realList = list.filter(current => player.hasDisabledSlot(current));
			if (!list.length) {
				return;
			}

			if (event.selectButton[0] >= realList.length) {
				event.list = list;
				event.result = { links: list };
				await player.enableEquip({ slots: list.slice() });
			} else {
				const sortedList = list.toSorted().map(current => [current, get.translation(current)]);
				event.list = sortedList;
				let str = `请选择恢复${get.translation(player.name)}的`;
				const selectButton = get.select(event.selectButton);
				if (selectButton[0] == selectButton[1]) {
					str += get.cnNumber(selectButton[0]);
				} else if (selectButton[1] == Infinity) {
					str += `至少${get.cnNumber(selectButton[0])}`;
				} else {
					str += `${get.cnNumber(selectButton[0])}至${get.cnNumber(selectButton[1])}`;
				}
				str += "个装备栏";

				if (!source) {
					throw new TypeError("chooseToEnable requires an event source");
				}
				const next = source.chooseButton({
					selectButton,
					forced: true,
					createDialog: [str, [sortedList, "tdnodes"]],
				});
				next.set("filterButton", button => player.hasDisabledSlot(button.link));

				event.ai ??= () => Math.random();
				next.set("ai", event.ai);

				const result = await next.forResult();
				if (!isSelectionResultObject(result)) {
					event.result = result;
					return;
				}
				event.result = { links: result.links };
				const { links } = result;
				if (!Array.isArray(links) || !links.every(link => typeof link == "string")) {
					return;
				}
				await player.enableEquip({ slots: links.slice() });
			}
		} else {
			const list: string[] = [];
			for (let i = 1; i <= 5; i++) {
				if (player.hasDisabledSlot(i)) {
					list.push(`equip${i}`);
				}
			}
			if (!list.length) {
				return;
			}

			if (list.length == 1) {
				event.list = list;
				const control = list[0];
				event.result = { control };
				await player.enableEquip({ slots: [control] });
			} else {
				if (!source) {
					throw new TypeError("chooseToEnable requires an event source");
				}
				const next = source.chooseControl({ controls: list });
				next.set("prompt", `请选择恢复${get.translation(player.name)}的一个装备栏`);
				event.ai ??= (event, player, list) => list.randomGet();
				event.ai = event.ai(event.getParent(), player, list);
				next.ai = () => event.ai;
				const result = await next.forResult();
				if (!isSelectionResultObject(result)) {
					event.result = result;
					return;
				}
				event.result = { control: result.control };
				const { control } = result;
				if (typeof control != "string") {
					return;
				}
				await player.enableEquip({ slots: [control] });
			}
		}
	},
	async chooseToDisable(event, trigger, player) {
		const { source } = event;
		if (event.selectButton) {
			const list: string[] = Array(5);
			for (let i = 0; i < 5; i++) {
				list[i] = `equip${i + 1}`;
			}
			const realList = list.filter(current => player.hasEnabledSlot(current));
			if (event.horse) {
				if (list.includes("equip3") && (get.is.mountCombined() || list.includes("equip4"))) {
					list.push("equip3_4");
					realList.push("equip3_4");
				}
				list.remove("equip3", "equip4");
				realList.remove("equip3", "equip4");
			}
			if (!list.length) {
				return;
			}

			let links: string[] | undefined;
			if (event.selectButton[0] >= realList.length) {
				event.list = list;
				links = list;
			} else {
				const sortedList = list.toSorted().map(current => [current, get.translation(current)]);
				event.list = sortedList;
				let str = `请选择废除${get.translation(player.name)}的`;
				const selectButton = get.select(event.selectButton);
				if (selectButton[0] == selectButton[1]) {
					str += get.cnNumber(selectButton[0]);
				} else if (selectButton[1] == Infinity) {
					str += `至少${get.cnNumber(selectButton[0])}`;
				} else {
					str += `${get.cnNumber(selectButton[0])}至${get.cnNumber(selectButton[1])}`;
				}
				str += "个装备栏";

				if (!source) {
					throw new TypeError("chooseToDisable requires an event source");
				}
				const next = source.chooseButton({
					selectButton,
					forced: true,
					createDialog: [str, [sortedList, "tdnodes"]],
				});
				next.set("filterButton", button => player.hasEnabledSlot(button.link));
				event.ai ??= () => Math.random();
				next.set("ai", event.ai);

				const result = await next.forResult();
				if (result && typeof result == "object" && "links" in result && Array.isArray(result.links)) {
					const selected = result.links.filter(link => typeof link == "string");
					if (selected.length) {
						links = selected;
					}
				}
			}

			if (!links) {
				return;
			}
			event.result = { links };
			const slots = links.slice();
			if (slots.includes("equip3_4")) {
				slots.remove("equip3_4");
				slots.add("equip3");
				slots.add("equip4");
			}
			await player.disableEquip({ slots });
		} else {
			const list: string[] = [];
			for (let i = 1; i <= 5; i++) {
				if (player.hasEnabledSlot(i)) {
					list.push(`equip${i}`);
				}
			}
			if (event.horse) {
				if (list.includes("equip3") && (get.is.mountCombined() || list.includes("equip4"))) {
					list.push("equip3_4");
				}
				list.remove("equip3");
				list.remove("equip4");
			}
			if (!list.length) {
				return;
			}

			let control: string | undefined;
			if (list.length == 1) {
				event.list = list;
				control = list[0];
			} else {
				list.sort();
				event.list = list;

				if (!source) {
					throw new TypeError("chooseToDisable requires an event source");
				}
				const next = source.chooseControl({ controls: list });
				next.set("prompt", `请选择废除${get.translation(player.name)}的一个装备栏`);
				event.ai ??= (event, player, list) => list.randomGet();
				event.ai = event.ai(event.getParent(), player, list);
				next.ai = () => event.ai;

				const nextResult = await next.forResult();
				if (nextResult && typeof nextResult == "object" && typeof nextResult.control == "string") {
					control = nextResult.control;
				}
			}
			if (!control) {
				return;
			}
			event.result = { control };
			if (control == "equip3_4") {
				await player.disableEquip({ slots: ["equip3", "equip4"] });
			} else {
				await player.disableEquip({ slots: [control] });
			}
		}
	},
	async swapEquip(event, trigger, player) {
		const target = event.getTarget();
		const cards = [player.getCards("e"), target.getCards("e")];
		event.cards1 = cards[0];
		event.cards2 = cards[1];
		await game
			.loseAsync({
				player: player,
				target: target,
				cards1: cards[0],
				cards2: cards[1],
			})
			.setContent("swapHandcardsx");

		for (const card of cards[1]) {
			const vcard = card.cardSymbol === undefined ? get.autoViewAs(card, void 0, false) : card[card.cardSymbol];
			if (!vcard) {
				continue;
			}
			if (vcard.cards?.length && vcard.cards.some(i => get.position(i, true) !== "o")) {
				continue;
			}
			await player.equip(vcard);
		}
		for (const card of cards[0]) {
			const vcard = card.cardSymbol === undefined ? get.autoViewAs(card, void 0, false) : card[card.cardSymbol];
			if (!vcard) {
				continue;
			}
			if (vcard.cards?.length && vcard.cards.some(i => get.position(i, true) !== "o")) {
				continue;
			}
			await target.equip(vcard);
		}
	},
	async disableJudge(event, trigger, player) {
		game.log(player, "废除了判定区");
		const js = player.getCards("j");
		player.storage._disableJudge = true;
		if (js.length) {
			await player.discard({ cards: js });
		}
		game.broadcastAll(player => {
			player.$disableJudge();
		}, player);
	},
	async enableJudge(event, trigger, player) {
		if (!player.storage._disableJudge) {
			return;
		}
		game.log(player, "恢复了判定区");
		game.broadcastAll(player => {
			player.$enableJudge();
		}, player);
	},
};

import type { CardData } from "../../../../game/index.js";
import type { Card, GameEvent, Player, VCard } from "../../index.js";
import type { BroadSelect } from "../type.js";
import type { EventDisableEquipParams, EventEnableEquipParams, EventExpandEquipParams, EventJudgeParams } from "./actionEventParams.js";
import type { EventChooseToDisableParams, EventChooseToEnableParams } from "./choiceEventParams.js";

export type LegacyEquipSlotToken = Player | string | number | (string | number)[];
export type LegacyChooseToEnableToken = Player | BroadSelect;
export type LegacyChooseToDisableToken = Player | boolean | BroadSelect;
export type LegacyJudgeToken = Card | VCard | CardBaseUIData | string | ((card: Card) => number) | boolean | HTMLDivElement | DocumentFragment;
export type JudgeNameTarget = string | Card | VCard | { viewAs?: string; name?: string };

declare module "../../player.js" {
	interface Player {
		// slotQuery.ts (13)
		addExtraEquip(skill: string, equip: string[] | string, replace?: boolean, preserve?: (player: Player) => boolean | CardData | undefined): void;
		removeExtraEquip(skill: string, equip?: string[] | string): void;
		hasDisabledSlot(type?: string | number): boolean;
		countDisabledSlot(type?: string | number): number;
		hasEmptySlot(type?: string | number): boolean;
		countEmptySlot(type?: string | number): number;
		hasEquipableSlot(type?: string | number): boolean;
		countEquipableSlot(type?: string | number): number;
		hasEnabledSlot(type?: string | number): boolean;
		countEnabledSlot(type?: string | number): number;
		/** @deprecated */
		countDisabled(type?: string | number): number;
		/** @deprecated */
		isDisabled(arg?: string | number): boolean;
		/** @deprecated */
		isEmpty(num?: string | number): boolean;

		// slotControl.ts (7)
		disableEquip(params?: EventDisableEquipParams): GameEvent;
		disableEquip(...args: LegacyEquipSlotToken[]): GameEvent;
		enableEquip(params?: EventEnableEquipParams): GameEvent;
		enableEquip(...args: LegacyEquipSlotToken[]): GameEvent;
		expandEquip(params?: EventExpandEquipParams): GameEvent;
		expandEquip(...args: LegacyEquipSlotToken[]): GameEvent;
		$syncExpand(map?: Record<string, number>): void;
		$syncDisable(map?: Record<string, number>): void;
		chooseToEnable(params?: EventChooseToEnableParams): GameEvent;
		chooseToEnable(...args: LegacyChooseToEnableToken[]): GameEvent;
		chooseToDisable(params?: EventChooseToDisableParams): GameEvent;
		chooseToDisable(...args: LegacyChooseToDisableToken[]): GameEvent;

		// equipArea.ts (7)
		getEquips(subtype: number | string | Card | VCard): Card[];
		getVEquips(subtype: number | string | Card | VCard): VCard[];
		canEquip(name: string | Card | VCard | CardBaseUIData, replace?: boolean): boolean;
		swapEquip(target: Player): GameEvent;
		equip(card: Card | VCard | CardBaseUIData, draw?: boolean): GameEvent;
		getVEquip(name: number | string | Card | VCard | CardBaseUIData): VCard | null;
		getEquip(name: number | string | Card | VCard | CardBaseUIData): Card | null;

		// judgeArea.ts (13)
		executeDelayCardEffect(card: Card | string, target?: Player, judge?: any, judge2?: any): GameEvent;
		isDisabledJudge(): boolean;
		$disableJudge(): void;
		$enableJudge(): void;
		disableJudge(): GameEvent;
		enableJudge(): GameEvent;
		addJudge(card: string | Card | VCard | CardBaseUIData, cards?: (Card | VCard)[] | Card): GameEvent;
		canAddJudge(card: string | Card | VCard, player?: Player): boolean;
		addJudgeNext(card: Card | VCard, unlimited?: boolean): GameEvent | undefined;
		judge(params?: EventJudgeParams): GameEvent;
		judge(...args: LegacyJudgeToken[]): GameEvent;
		hasJudge(name: JudgeNameTarget): boolean;
		getVJudge(name?: string): VCard | null;
		/** @deprecated */
		getJudge(name?: string): Card | null;

		// virtualEquipDom.ts (5)
		removeVirtualEquip(VCard: VCard): void;
		$handleEquipChange(): void;
		addVirtualEquip(card: Card | VCard, cards: Card[]): void;
		$addVirtualEquip(card: Card | VCard, cards: Card[]): void;
		$equip(card: Card): Player;

		// virtualJudgeAndTrigger.ts (5)
		addEquipTrigger(card?: Card | VCard): Player;
		removeVirtualJudge(VCard: VCard): void;
		removeEquipTrigger(card?: Card | VCard, hasMove?: boolean): Player | undefined;
		addVirtualJudge(card: Card | VCard, cards: Card[]): void;
		$addVirtualJudge(VCard: Card | VCard, cards: Card[]): void;
	}
}

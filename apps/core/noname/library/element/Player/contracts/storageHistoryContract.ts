import type { Card, GameEvent, Player, VCard } from "../../index.js";
import type { ActionHistoryArrayKey, ActionHistoryItem, MarkNode } from "./instanceFieldsContract.js";

export type HistoryEventFilter<K extends ActionHistoryArrayKey> = ((event: ActionHistoryItem<K>) => unknown) | null;
export type RoundHistoryEventFilter<K extends ActionHistoryArrayKey> = HistoryEventFilter<K> | false;

declare module "../../player.js" {
	interface Player {
		// storageAndResource.ts (18)
		addTip(index: string, message: string, isTemp?: SkillTrigger | SAAType<Signal> | boolean, css?: Parameters<HTMLElement["css"]>[0]): void;
		removeTip(index?: string): void;
		changeFury(amount: number, limit?: boolean): void;
		addCharge(num?: number, log?: boolean): void;
		removeCharge(num?: number, log?: boolean): void;
		countCharge(max?: boolean): number;
		getMaxCharge(): number;
		getCacheKey(similar?: boolean): string;
		syncStorage(skill: string): void;
		setStorage<T = any>(name: string, value: T, mark?: boolean): T;
		getStorage<T = any>(name: string, defaultValue?: any): T;
		hasStorage(name: string, value?: any): boolean;
		hasStorageAny(name: string, values: any[]): boolean;
		hasStorageAny(name: string, ...values: any[]): boolean;
		hasStorageAll(name: string, values: any[]): boolean;
		hasStorageAll(name: string, ...values: any[]): boolean;
		initStorage<T = any>(name: string, value?: T, mark?: boolean): any;
		updateStorage<T = any>(name: string, operation: (value: any) => T, mark?: boolean): T;
		updateStorageAsync<T = any>(name: string, operation: (value: any) => T | PromiseLike<T>, mark?: boolean): Promise<T>;
		removeStorage(name: string, mark?: boolean): boolean;

		// markCounter.ts (11)
		clearMark(i: string, log?: boolean): void;
		removeMark(i: string, num?: number, log?: boolean): void;
		addMark(i: string, num?: number, log?: boolean): void;
		setMark(name: string, num: number, log?: boolean): void;
		countMark(i: string): number;
		hasMark(i: string): boolean;
		updateMark(i: string, storage?: boolean): this;
		updateMarks(connect?: string | boolean): void;
		markAuto(name: string, info?: any): void;
		unmarkAuto(name: string, info?: any): void;
		checkMarks(): this;

		// markRender.ts (7)
		localMarkSkill(skill: string, target: Player, event: GameEvent): void;
		markSkill(name: string, info?: Skill["intro"] | Record<string, any> | string | boolean | null, card?: Card | null, nobroadcast?: boolean): this;
		unmarkSkill(name: string, nobroadcast?: boolean): this;
		markSkillCharacter(id: string, target: Player | { name: string } | string, name: string, content?: string, nobroadcast?: boolean): this;
		markCharacter(name: Player | { name: string } | string, info?: Record<string, any>, learn?: boolean, learn2?: boolean): MarkNode | undefined;
		mark(name: Card[], info?: Record<string, any> | string | null, skill?: string): MarkNode[];
		mark(name: string | Card, info?: Record<string, any> | string | null, skill?: string): MarkNode;
		mark(name: string | Card | Card[], info?: Record<string, any> | string | null, skill?: string): MarkNode | MarkNode[];
		unmark(name: string | Card | Card[], info?: string): void;

		// historyAndStats.ts (23)
		countUsed(card?: string | Card | VCard | CardBaseUIData, type?: boolean): number;
		countSkill(skill: string): number;
		iterRoundHistory<K extends ActionHistoryArrayKey>(key: K, filter?: RoundHistoryEventFilter<K>, num?: number, keep?: boolean, last?: ActionHistoryItem<K>): Generator<ActionHistoryItem<K>>;
		getRoundHistory<K extends ActionHistoryArrayKey>(key: K, filter?: RoundHistoryEventFilter<K>, num?: number, keep?: boolean, last?: ActionHistoryItem<K>): ActionHistoryItem<K>[];
		countRoundHistory<K extends ActionHistoryArrayKey>(key: K, filter?: RoundHistoryEventFilter<K>, num?: number, keep?: boolean, last?: ActionHistoryItem<K>): number;
		hasRoundHistory<K extends ActionHistoryArrayKey>(key: K, filter?: RoundHistoryEventFilter<K>, num?: number, keep?: boolean, last?: ActionHistoryItem<K>): boolean;
		iterHistory<K extends ActionHistoryArrayKey>(key: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): Generator<ActionHistoryItem<K>>;
		getHistory(): ActionHistory;
		getHistory(key: "isRound" | "isMe" | "isSkipped"): boolean;
		getHistory<K extends ActionHistoryArrayKey>(key: K, filter?: RoundHistoryEventFilter<K>, last?: ActionHistoryItem<K>): ActionHistoryItem<K>[];
		getHistory(key?: keyof ActionHistory, filter?: ((event: any) => unknown) | null | false, last?: any): ActionHistory | boolean | undefined | ActionHistoryItem<ActionHistoryArrayKey>[];
		checkHistory<K extends ActionHistoryArrayKey>(key: K, content: (event: ActionHistoryItem<K>) => void, last?: ActionHistoryItem<K>): void;
		countHistory<K extends ActionHistoryArrayKey>(key: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): number;
		hasHistory<K extends ActionHistoryArrayKey>(key: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): boolean;
		iterLastHistory<K extends ActionHistoryArrayKey>(key: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): Generator<ActionHistoryItem<K>>;
		getLastHistory(): ActionHistory | null;
		getLastHistory(key: "isRound" | "isMe" | "isSkipped"): boolean;
		getLastHistory<K extends ActionHistoryArrayKey>(key: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): ActionHistoryItem<K>[];
		getLastHistory(key?: keyof ActionHistory, filter?: ((event: any) => unknown) | null | false, last?: any): ActionHistory | boolean | null | undefined | ActionHistoryItem<ActionHistoryArrayKey>[];
		countLastHistory<K extends ActionHistoryArrayKey>(key: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): number;
		hasLastHistory<K extends ActionHistoryArrayKey>(key: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): boolean;
		iterAllHistory(): Generator<ActionHistory>;
		iterAllHistory<K extends ActionHistoryArrayKey>(key: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): Generator<ActionHistoryItem<K>>;
		iterAllHistory<K extends ActionHistoryArrayKey>(key?: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): Generator<ActionHistory | ActionHistoryItem<K>>;
		checkAllHistory<K extends ActionHistoryArrayKey>(key: K, content: (event: ActionHistoryItem<K>) => void, last?: ActionHistoryItem<K>): void;
		getAllHistory(): ActionHistory[];
		getAllHistory<K extends ActionHistoryArrayKey>(key: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): ActionHistoryItem<K>[];
		getAllHistory<K extends ActionHistoryArrayKey>(key?: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): (ActionHistory | ActionHistoryItem<K>)[];
		countAllHistory<K extends ActionHistoryArrayKey>(key: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): number;
		hasAllHistory<K extends ActionHistoryArrayKey>(key: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): boolean;
		getLastUsed(num?: number): GameEvent | null;
		getStat(): Stat;
		getStat<T extends keyof Stat>(key: T): Stat[T];
		getStat(key?: keyof Stat): Stat | Stat[keyof Stat];
		getLastStat(): Stat | null;
		getLastStat<T extends keyof Stat>(key: T): Stat[T] | null;
		getLastStat(key?: keyof Stat): Stat | Stat[keyof Stat] | null;
	}
}

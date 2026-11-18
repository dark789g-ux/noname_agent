import { lib } from "noname";
import type { Card, GameEvent, Player, VCard } from "../../index.js";
import type { ActionHistoryArrayKey, ActionHistoryItem } from "../contracts/instanceFieldsContract.js";
import type { HistoryEventFilter, RoundHistoryEventFilter } from "../contracts/storageHistoryContract.js";
import "../contracts/storageHistoryContract.js";

export const historyAndStatsMethods = {
	countUsed(this: Player, card?: string | Card | VCard | CardBaseUIData, type?: boolean): number {
		let num: number | undefined;
		if (type === true) {
			num = 0;
			const history = this.getHistory("useCard");
			for (let i = 0; i < history.length; i++) {
				const usedCard = history[i].card;
				if (!card) {
					num++;
				} else if (typeof card == "string" && usedCard && card == usedCard.name) {
					num++;
				} else if (typeof card == "object" && usedCard && card.name == usedCard.name) {
					num++;
				}
			}
			return num;
		}
		const stat = this.getStat("card");
		if (!card) {
			num = 0;
			for (const i in stat) {
				const count = stat[i];
				if (typeof count == "number") {
					num += count;
				}
			}
			return num;
		}
		const cardName = typeof card == "object" ? card.name : card;
		num = cardName !== undefined ? stat[cardName] : stat["undefined"];
		if (typeof num != "number") {
			return 0;
		}
		return num;
	},

	countSkill(this: Player, skill: string): number {
		const info = lib.skill[skill];
		if (!info) {
			console.warn("“" + skill + "”为无效技能ID！");
			return 0;
		}
		if (typeof this.getStat("skill")[skill] === "number" || typeof this.getStat("triggerSkill")[skill] === "number") {
			return Number(this.getStat("skill")?.[skill] ?? 0) + Number(this.getStat("triggerSkill")?.[skill] ?? 0);
		}
		return this.getHistory("useSkill", evt => evt.skill === skill).length;
	},

	*iterRoundHistory<K extends ActionHistoryArrayKey>(this: Player, key: K, filter?: RoundHistoryEventFilter<K>, num?: number, keep?: boolean, last?: ActionHistoryItem<K>): Generator<ActionHistoryItem<K>> {
		num ??= 0;
		if (filter != null && !filter) {
			filter = undefined;
		}

		const allHistories = this.actionHistory;
		let startIndex = allHistories.length;
		let endIndex = allHistories.length;
		for (let i = allHistories.length - 1; i >= 0; i--) {
			if (keep || num === 0) {
				startIndex = i;
			}
			if (allHistories[i].isRound) {
				if (num <= 0) {
					break;
				}
				num--;
				if (!keep) {
					endIndex = i;
				}
			}
		}

		if (startIndex >= endIndex) {
			return;
		}

		for (let i = startIndex; i < endIndex; i++) {
			const histories: any[] = allHistories[i][key];
			for (const history of histories) {
				if (filter == null || filter(history)) {
					yield history;
				}
				if (history === last) {
					return;
				}
			}
		}
	},

	getRoundHistory<K extends ActionHistoryArrayKey>(this: Player, key: K, filter?: RoundHistoryEventFilter<K>, num?: number, keep?: boolean, last?: ActionHistoryItem<K>): ActionHistoryItem<K>[] {
		return this.iterRoundHistory(key, filter, num, keep, last).toArray();
	},

	countRoundHistory<K extends ActionHistoryArrayKey>(this: Player, key: K, filter?: RoundHistoryEventFilter<K>, num?: number, keep?: boolean, last?: ActionHistoryItem<K>): number {
		let count = 0;
		for (const _ of this.iterRoundHistory(key, filter, num, keep, last)) {
			count++;
		}
		return count;
	},

	hasRoundHistory<K extends ActionHistoryArrayKey>(this: Player, key: K, filter?: RoundHistoryEventFilter<K>, num?: number, keep?: boolean, last?: ActionHistoryItem<K>): boolean {
		for (const _ of this.iterRoundHistory(key, filter, num, keep, last)) {
			return true;
		}
		return false;
	},

	*iterHistory<K extends ActionHistoryArrayKey>(this: Player, key: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): Generator<ActionHistoryItem<K>> {
		const currentHistory = this.actionHistory[this.actionHistory.length - 1];
		const histories: any[] = currentHistory[key];

		if (filter == null && last == null) {
			yield* histories;
			return;
		}

		if (last != null && !histories.includes(last)) {
			return;
		}

		for (const history of histories) {
			if (filter == null || filter(history)) {
				yield history;
			}
			if (history === last) {
				break;
			}
		}
	},

	getHistory(this: Player, key?: keyof ActionHistory, filter?: ((event: any) => unknown) | null | false, last?: any) {
		if (!key) {
			return this.actionHistory[this.actionHistory.length - 1];
		}
		if (key === "isRound" || key === "isMe" || key === "isSkipped" || !filter) {
			return this.actionHistory[this.actionHistory.length - 1][key];
		}
		return this.iterHistory(key, filter, last).toArray();
	},

	checkHistory<K extends ActionHistoryArrayKey>(this: Player, key: K, content: (event: ActionHistoryItem<K>) => void, last?: ActionHistoryItem<K>): void {
		if (!key || !content) {
			return;
		}
		for (const event of this.iterHistory(key, undefined, last)) {
			content(event);
		}
	},

	countHistory<K extends ActionHistoryArrayKey>(this: Player, key: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): number {
		let count = 0;
		for (const _ of this.iterHistory(key, filter, last)) {
			count++;
		}
		return count;
	},

	hasHistory<K extends ActionHistoryArrayKey>(this: Player, key: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): boolean {
		for (const _ of this.iterHistory(key, filter, last)) {
			return true;
		}
		return false;
	},

	*iterLastHistory<K extends ActionHistoryArrayKey>(this: Player, key: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): Generator<ActionHistoryItem<K>> {
		let currentHistory: ActionHistory | undefined;
		for (let i = this.actionHistory.length - 1; i >= 0; i--) {
			if (this.actionHistory[i].isMe) {
				currentHistory = this.actionHistory[i];
				break;
			}
		}
		if (currentHistory == null) {
			return;
		}

		const histories: any[] = currentHistory[key];

		if (filter == null && last == null) {
			yield* histories;
			return;
		}

		if (last != null && !histories.includes(last)) {
			return;
		}

		for (const history of histories) {
			if (filter == null || filter(history)) {
				yield history;
			}
			if (history === last) {
				break;
			}
		}
	},

	getLastHistory(this: Player, key?: keyof ActionHistory, filter?: ((event: any) => unknown) | null | false, last?: any) {
		if (key != null && key !== "isRound" && key !== "isMe" && key !== "isSkipped" && filter != null && filter !== false) {
			return this.iterLastHistory(key, filter, last).toArray();
		}

		let currentHistory: ActionHistory | undefined;
		for (let i = this.actionHistory.length - 1; i >= 0; i--) {
			if (this.actionHistory[i].isMe) {
				currentHistory = this.actionHistory[i];
				break;
			}
		}
		if (currentHistory == null) {
			return null;
		}
		return key ? currentHistory[key] : currentHistory;
	},

	countLastHistory<K extends ActionHistoryArrayKey>(this: Player, key: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): number {
		let count = 0;
		for (const _ of this.iterLastHistory(key, filter, last)) {
			count++;
		}
		return count;
	},

	hasLastHistory<K extends ActionHistoryArrayKey>(this: Player, key: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): boolean {
		for (const _ of this.iterLastHistory(key, filter, last)) {
			return true;
		}
		return false;
	},

	*iterAllHistory<K extends ActionHistoryArrayKey>(this: Player, key?: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): Generator<ActionHistory | ActionHistoryItem<K>> {
		if (!key) {
			for (const histories of this.actionHistory) {
				yield histories;
			}
			return;
		}

		if (last != null) {
			if (!this.actionHistory.some(histories => (histories[key] as any[]).includes(last))) {
				return;
			}
		}

		for (const currentHistories of this.actionHistory) {
			const histories: any[] = currentHistories[key];

			if (filter == null && last == null) {
				yield* histories;
				continue;
			}

			for (const history of histories) {
				if (filter == null || filter(history)) {
					yield history;
				}
				if (history === last) {
					return;
				}
			}
		}
	},

	checkAllHistory<K extends ActionHistoryArrayKey>(this: Player, key: K, content: (event: ActionHistoryItem<K>) => void, last?: ActionHistoryItem<K>): void {
		if (!key || !content) {
			return;
		}
		for (const event of this.iterAllHistory(key, undefined, last)) {
			content(event);
		}
	},

	getAllHistory<K extends ActionHistoryArrayKey>(this: Player, key?: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): (ActionHistory | ActionHistoryItem<K>)[] {
		return this.iterAllHistory(key, filter, last).toArray();
	},

	countAllHistory<K extends ActionHistoryArrayKey>(this: Player, key: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): number {
		let count = 0;
		for (const _ of this.iterAllHistory(key, filter, last)) {
			count++;
		}
		return count;
	},

	hasAllHistory<K extends ActionHistoryArrayKey>(this: Player, key: K, filter?: HistoryEventFilter<K>, last?: ActionHistoryItem<K>): boolean {
		for (const _ of this.iterAllHistory(key, filter, last)) {
			return true;
		}
		return false;
	},

	getLastUsed(this: Player, num?: number): GameEvent | null {
		if (typeof num != "number") {
			num = 0;
		}
		const history = this.getHistory("useCard");
		if (history.length <= num) {
			return null;
		}
		return history[history.length - num - 1];
	},

	getStat(this: Player, key?: keyof Stat) {
		if (!key) {
			return this.stat[this.stat.length - 1];
		}
		return this.stat[this.stat.length - 1][key];
	},

	getLastStat(this: Player, key?: keyof Stat) {
		let stat: Stat | false = false;
		for (let i = this.stat.length - 1; i >= 0; i--) {
			if (this.stat[i].isMe) {
				stat = this.stat[i];
				break;
			}
		}
		if (!stat) {
			return null;
		}
		if (!key) {
			return stat;
		}
		return stat[key];
	},
};

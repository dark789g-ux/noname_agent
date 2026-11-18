import type JSZip from "jszip";

import type { Get } from "../Get.js";
declare module "../Get.js" {
	interface Get {
		numOf(obj?: any, item?: any): any;

		sgn(num: number): 1 | -1 | 0;

		rand(num: number, num2?: number): number;

		sort(arr?: any, method?: any, arg?: any): any;

		sortSeat(arr: Player[], target: Player): Player[];

		delayx(num?: any, max?: any): number;

		round(num?: any, f?: any): number;

		benchmark(func1?: any, func2?: any, iteration?: any, arg?: any): number | undefined;

		id(): string;

		time(): number;

		utc(): number;

		xyDistance(from?: any, to?: any): number;

		itemtype(obj?: any): "position" | "natures" | "nature" | "players" | "cards" | "vcards" | "select" | "divposition" | "button" | "card" | "vcard" | "player" | "dialog" | "event" | void;

		itemtype(obj: string): "position" | "natures" | "nature";

		itemtype(obj: Player[]): "players";

		itemtype(obj: Card[]): "cards";

		itemtype(obj: [number, number]): "select";

		itemtype(obj: [number, number, number, number]): "divposition";

		itemtype(obj: Button): "button";

		itemtype(obj: Card): "card";

		itemtype(obj: VCard): "vcard";

		itemtype(obj: Player): "player";

		itemtype(obj: Dialog): "dialog";

		itemtype(obj: GameEvent): "event";

		objtype(obj: any[]): "array";

		objtype(obj?: any): "object";

		objtype(obj: HTMLDivElement): "div";

		objtype(obj: HTMLTableElement): "table";

		objtype(obj: HTMLTableRowElement): "tr";

		objtype(obj: HTMLTableCellElement): "td";

		objtype(obj: HTMLBodyElement): "td";

		objtype(obj: DocumentFragment): "fragment";

		difficulty(): 1 | 2 | 3;

		dynamicVariable<T, U extends any[]>(source: T | ((...args: U) => T), ...args: U): T;
	}
}

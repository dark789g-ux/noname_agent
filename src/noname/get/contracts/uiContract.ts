import type JSZip from "jszip";

import type { Get } from "../Get.js";
declare module "../Get.js" {
	interface Get {
		modetrans(config?: any, server?: any): string;

		idDialog(id?: any): import("@/library/element/dialog.js").Dialog | null;

		arenaState(): {
			number: string | undefined;
			players: NonNullable<unknown>;
			mode: string | undefined;
			dying: any[];
			servermode: boolean | undefined;
			roomId: string | undefined;
			over: boolean;
			inpile: any[];
			inpile_nature: any[];
		};

		skillState(player?: any): {
			global: string[];
		};

		hpColor(
			player:
				| import("@/library/index.js").Player
				| {
						hp: number;
						maxHp: number;
				  }
		): string;

		menuZoom(): number;

		iterableChildNodes(...elements: HTMLElement[]): Iterable<Element>;

		selectableButtons(sort?: (a: Button, b: Button) => number): Button[];

		selectableCards(sort?: (a: Card, b: Card) => number): Card[];

		selectableTargets(sort?: (a: Player, b: Player) => number): Player[];

		noSelected(): boolean;

		skillintro(name?: any, learn?: any, learn2?: any): string;

		intro(name?: any): string;

		storageintro(type?: any, content?: any, player?: any, dialog?: any, skill?: any): any;

		linkintro(dialog?: any, content?: any, player?: any): void;

		poptipIntro(info: string | Function, poptip: string, event: PointerEvent | TouchEvent): import("@/library/element/dialog.js").Dialog;

		links(buttons?: any): any[];

		poptip(poptip: string): string;

		poptip(poptip: { id?: string | undefined; type?: string | undefined; name: string; info?: string | undefined; dialog?: string | ((dialog: Dialog, poptip: string) => Dialog) | undefined }): string;
	}
}

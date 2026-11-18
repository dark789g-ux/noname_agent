import type { Pagination } from "@/util/pagination.js";
import type { Button, Card, Control, Dialog, Player } from "../../../library/element/index.js";

declare module "../index.js" {
	interface Create {
		cheat?: () => void;
		cheat2?: () => void;
		fakeme?: () => void;

		// methods/cardTempName.ts
		identityCard(identity: string, position?: any, noclick?: any): Card;
		cardSpinning(card: HTMLDivElement & { listenTransition(callback: () => void): void }): void;
		spinningIdentityCard(identity: string, dialog: Dialog): void;
		cardTempName(card: any, applyNode?: any): HTMLDivElement & { tempname?: string };
		rarity(button: RuntimeCharacterButton): void;

		// methods/editorAndToast.ts
		editor(config?: { value?: string; language?: string; saveInput?: (code: string) => any }): Promise<void>;
		toast(message: string): HTMLDivElement;
		showNextToast(): HTMLDivElement | undefined;

		// methods/domElements.ts
		div(...args: any[]): HTMLDivElement;
		filediv(...args: any[]): RuntimeFileDiv;
		node(...args: any[]): HTMLElement;
		iframe(src: string): void;
		selectlist(list: Array<string | [string, string]>, init?: string, position?: Element, onchange?: (this: GlobalEventHandlers, ev: Event) => any): HTMLSelectElement;
		statictable(...args: any[]): HTMLTableElement;
		dialog(...args: any[]): Dialog;
		line2(...args: any[]): HTMLDivElement;
		line(...args: any[]): HTMLDivElement;
		switcher(name: string, current: any, current2?: any, maybeCallback?: any): HTMLDivElement;
		caption(str: string, position?: Element): HTMLDivElement & { link?: string };
		pagination(options: ConstructorParameters<typeof Pagination>[0]): Pagination;

		// methods/playersAndConnect.ts
		connectRooms(list: any[]): void;
		identitycircle(list: string[], target: Element): void;
		chat(): void;
		exit(): void;
		connecting(bool?: boolean): void;
		roomInfo(): void;
		templayer(time?: number): void;
		giveup(): void;
		player(position?: HTMLDivElement | DocumentFragment | null, noclick?: boolean): Player;
		connectPlayers(ip: string): void;
		players(numberOfPlayers?: number | string): Player[] | undefined;
		me(hasme?: boolean): void;

		// methods/controlsAndSkills.ts
		groupControl(dialog: Dialog): Control;
		control(...args: any[]): Control;
		confirm(str?: string, func?: any): void;
		skills(skills?: string[]): Control | undefined;
		skills2(skills?: string[]): Control | undefined;
		skills3(skills?: string[]): Control | undefined;
		cardChooseAll(): Control | null;
		buttonChooseAll(): HTMLDivElement | null;
		system(str: string, func?: ((this: HTMLDivElement, event: Event) => void) | null, right?: boolean, before?: boolean): HTMLDivElement;
		pause(): HTMLDivElement | undefined;

		// arena/index.ts & characterDialog/*
		arena(): void;
		cardDialog(...args: any[]): Dialog;
		characterDialog2(filter?: (name: string) => any): Dialog;
		characterDialog(...args: any[]): Dialog;

		// methods/buttonsAndCards.ts
		prebutton(item: any, type: string, position?: any, noclick?: boolean): HTMLDivElement & { link: any; activate?: () => void };
		button(item: any, type?: any, position?: any, noClick?: any, button?: any): Button;
		buttons(list: any[], type?: any, position?: any, noclick?: boolean, zoom?: any): Button[];
		textbuttons(list: any[], dialog: Dialog, noclick?: boolean): void;
		card(position?: any, info?: any, noclick?: boolean): Card;
		cardsAsync(ordered?: boolean): void;
		cards(ordered?: boolean): void;
		handcardsContainer(cards?: Card[], position?: HTMLDivElement, options?: Record<string, any>): RuntimeHandcardsContainer;
	}
}

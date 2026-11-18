export {};

declare global {
	type RuntimeHandcardsContainer = HTMLDivElement & {
		buttons: Button[];
		destroyContainer(): void;
		clearCards(): void;
		addCards(cards: Card[], noClear?: boolean): void;
		removeCards(cards: Card[]): void;
	};

	type RuntimeFileDiv = HTMLDivElement & {
		inputNode: HTMLInputElement;
	};

	type RuntimeArena = HTMLDivElement & {
		setNumber(num: number): void;
	};

	type RuntimeCharacterButtonNodes = {
		name: HTMLDivElement;
		hp: HTMLDivElement;
		group: HTMLDivElement;
		intro: HTMLDivElement;
		replaceButton?: RuntimeReplaceButton;
	};

	type RuntimeCharacterButton = Button & {
		link: string;
		_link: string;
		node: RuntimeCharacterButtonNodes;
		_changeGroup?: true;
		_replaceButton?: true;
		refresh(node: RuntimeCharacterButton, item: string): void;
	};

	type RuntimeReplaceButton = HTMLDivElement & {
		_node: RuntimeCharacterButton;
	};

	type RuntimePlayerButton = Button & {
		link: Player;
		_link: Player;
		node: {
			name: HTMLDivElement;
			intro: HTMLDivElement;
		};
	};

	type RuntimeCardButton = Button & {
		link: Card;
		node: Card["node"];
		_tempName?: { tempname?: string };
	};

	type RuntimeSkillButton = Button & {
		link: string;
		owner: string;
		node: Card["node"];
		_customintro(uiintro: Dialog, evt: Event): void;
	};
}

declare module "@/library/element/control.js" {
	interface Control {
		stayleft?: boolean;
		replaceTransition?: boolean;
		_offset?: number;
		stay?: boolean;
		skills?: string[];
		str?: string;
		backup?: Dialog;
	}
}

declare module "@/library/element/button.js" {
	interface Button {
		capt?: string;
		group?: string;
		_changeGroup?: boolean;
		activate?: () => void;
	}
}

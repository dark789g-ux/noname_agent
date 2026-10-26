export {};

declare module "@/library/element/card.js" {
	interface Card {
		inits?: Array<(card: Card) => void>;
		cards?: Card[];
		_tempName?: HTMLDivElement;
		cardSymbol?: symbol;
		expired?: boolean;
		viewAs?: string;
		isViewAsCard?: boolean;
		_transform?: string;
		_destroy?: boolean;
		_cardid?: string;
		isFake?: boolean;
		_customintro?: (intro: Dialog, evt?: Event | Touch) => false | void | HTMLDivElement;
		extraEquip?: [skill: string, card: string, preserve?: (player: Player) => boolean | Card];
		_destroyed_Virtua?: boolean;
	}
}

declare module "@/library/element/vcard.js" {
	interface VCard {
		cardSymbol?: symbol;
		expired?: boolean;
		viewAs?: string;
		isViewAsCard?: boolean;
	}
}

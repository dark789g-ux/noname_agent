export {};

import type { LegacyCharacterSubstituteItem, LegacyCreateButtonFactory } from "@/library/element/Player/legacyParams";

declare module "@/library/element/dialog.js" {
	type RuntimeDialogButtonLinkAtom = string | number | boolean | Card | VCard | CardBaseUIData | Player;
	type RuntimeDialogButtonLink = RuntimeDialogButtonLinkAtom | RuntimeDialogButtonLinkAtom[];
	type RuntimeDialogButtonGroup = [RuntimeDialogButtonLink[], string] | [LegacyCharacterSubstituteItem[], LegacyCreateButtonFactory];
	type RuntimeDialogAddHandler = (dialog: Dialog) => void;
	type RuntimeDialogHandleItem = [RuntimeDialogAddHandler, "handle"];
	type RuntimeDialogRowItem = [RowItem[], "addNewRow"];
	type RuntimeDialogAddAtom = string | HTMLDivElement | DocumentFragment | Card[] | Player[] | RuntimeDialogButtonGroup | RuntimeDialogHandleItem | RuntimeDialogRowItem;
	type RuntimeDialogAddItem = RuntimeDialogAddAtom | RuntimeDialogAddItem[];
	type RuntimeDialogAddResult<T extends RuntimeDialogAddItem> = T extends `###${string}` ? T : string extends T ? T | HTMLDivElement : T extends string ? HTMLDivElement : T;

	type RuntimeDialogCaptionNode = HTMLElement & {
		alphabet?: boolean;
		inited?: boolean;
		link?: string;
		touchlink?: HTMLElement;
	};

	interface Dialog {
		source?: string | HTMLElement;
		currentcaptnode?: RuntimeDialogCaptionNode | null;
		currentcaptnode2?: RuntimeDialogCaptionNode | null;
		currentgroup?: string | null;
		currentgroupnode?: HTMLDivElement | null;
		videoId?: number;
		currentcapt?: string | null;
		currentcapt2?: string | null;
		_place_text?: HTMLDivElement;
		getCurrentCapt?: (link: string | readonly string[], capt: string, noalph?: boolean) => string | null | undefined;
		_heightset?: string | true;
		_scrollset?: boolean;
		seperate?: HTMLDivElement[];
		buttonss?: HTMLDivElement[];
		seperatelist?: Record<string, string[]>;
		direct?: boolean;
		forceDirect?: boolean;
		_onclose?: () => void;
		_clickintro?: (this: HTMLDivElement, event?: Event) => void;
		_close?: (this: HTMLDivElement, event?: Event) => void;
		clickintro?: boolean;
		touchclose?: boolean;
		_poppedorigin?: HTMLDivElement;
		_poptipOriginalTransform?: string;
		_poptipTranslate?: number;
		_poptipAdjust?: () => void;
		_poptipObserver?: MutationObserver;
		_poptipRemoveObserver?: MutationObserver;
		_onopen?: () => void;
		_heightfixed?: boolean;
		_mod_height?: number;
		type?: string;
		refresh?: () => void;
		handcardsContainer?: RuntimeHandcardsContainer;
		_intervalId?: ReturnType<typeof setInterval>;
		_hovercustomed?: boolean;
		_dragtouches?: Touch;
		_dragorigin?: { clientX: number; clientY: number };
		_dragorigintransform?: number[];
	}
}

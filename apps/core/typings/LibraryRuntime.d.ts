export {};

import type { NodeWS } from "@/library/element/nodeWS.js";

declare module "@/library/index.js" {
	type RuntimeStoragePrimitive = string | number | boolean | null;
	type RuntimeStorageValue = RuntimeStoragePrimitive | RuntimeStorageValue[] | RuntimeStorageObject;
	type RuntimeStorageObject = { [key: string]: RuntimeStorageValue };
	type RuntimeLadderStorage = { current: number; top: number; month?: number };
	type RuntimeLibraryStorage = RuntimeStorageObject & {
		ladder?: RuntimeLadderStorage;
		version?: string;
	};

	type RuntimeCharacterRank = {
		s: string[];
		ap: string[];
		a: string[];
		am: string[];
		bp: string[];
		b: string[];
		bm: string[];
		c: string[];
		d: string[];
		all?: string[];
		rarity: {
			legend: string[];
			epic: string[];
			rare: string[];
			junk: string[];
			common?: string[];
		};
	};

	interface Library {
		characterOnline?: Record<string, string[]>;
		storage: RuntimeLibraryStorage;
		cardOL?: Record<string, Card>;
		vcardOL?: Record<string | symbol, VCard>;
		connectCharacterPack: string[];
		connectCardPack: string[];
		cardPackList: Record<string, [CardBaseUIData["suit"], CardBaseUIData["number"], string][]>;
		rank?: RuntimeCharacterRank;
		forcehide?: string[];
		posmap?: Record<string, Player | HTMLDivElement>;
		choiceThree?: string[];
		choiceFour?: string[];
		wsOL: Record<string, NodeWS>;
	}
}

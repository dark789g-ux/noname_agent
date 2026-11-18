import type JSZip from "jszip";

import type { Get } from "../Get.js";
declare module "../Get.js" {
	interface Get {
		nodeintro(node?: any, simple?: any, evt?: any, uiintro?: any): any;

		rawAttitude?: (from: Player, to: Player, extraPlayer?: Player) => number;

		stonecard?: (type?: 1 | 2, career?: string) => string[];
	}
}

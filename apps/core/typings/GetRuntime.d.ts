export {};

declare module "@/get/index.js" {
	interface Get {
		rawAttitude?: (from: Player, to: Player, extraPlayer?: Player) => number;
		stonecard?: (type?: 1 | 2, career?: string) => string[];
	}
}

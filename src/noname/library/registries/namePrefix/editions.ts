import { get } from "noname";
import { lib } from "noname";

export function createNamePrefixEditions(): [string, import("@/library/contracts/menu.js").NamePrefix][] {
	return [
		[
			"手杀",
			{
				getSpan: (prefix: string, name: string) => {
					const simple = lib.config.buttoncharacter_prefix == "simple",
						span = document.createElement("span");
					if (lib.characterPack.shiji && name in lib.characterPack.shiji) {
						const shijiSort = lib.characterSort.shiji;
						if (!shijiSort) {
							throw new TypeError("shiji character sorting is not initialized");
						}
						for (const entry of Object.entries(shijiSort)) {
							if (!entry[1].includes(name)) {
								continue;
							}
							prefix = get.translation(entry[0]).slice(-1);
							break;
						}
						if (!simple) {
							span.style.color = "#def7ca";
							span.dataset.nature = "watermm";
						}
						span.innerHTML = prefix;
					} else if (simple) {
						span.textContent = "手杀";
					} else {
						span.style.fontFamily = "NonameSuits";
						span.textContent = "📱";
					}
					return span.outerHTML;
				},
			},
		],
		[
			"礼",
			{
				color: "#f0cf13",
				nature: "shenmm",
			},
		],
		[
			"射",
			{
				color: "#f0cf13",
				nature: "shenmm",
			},
		],
		[
			"书",
			{
				color: "#f0cf13",
				nature: "shenmm",
			},
		],
		[
			"数",
			{
				color: "#f0cf13",
				nature: "shenmm",
			},
		],
		[
			"御",
			{
				color: "#f0cf13",
				nature: "shenmm",
			},
		],
		[
			"手杀乐",
			{
				showName: "乐",
				color: "#f0cf13",
				nature: "shenmm",
			},
		],
		[
			"TW",
			{
				getSpan: () => {
					const span = document.createElement("span"),
						style = span.style;
					style.setProperty("writing-mode", "horizontal-tb");
					style.setProperty("-webkit-writing-mode", "horizontal-tb");
					style.fontFamily = "MotoyaLMaru";
					style.transform = "scaleY(0.85)";
					span.textContent = "TW";
					return span.outerHTML;
				},
			},
		],
		[
			"汉末",
			{
				showName: "汉",
				color: "#fefedc",
				nature: "shenmm",
			},
		],
		[
			"汉末神",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("汉末")}${get.prefixSpan("神")}`,
			},
		],
		[
			"长安",
			{
				showName: "镐",
				color: "#40e0d0",
				nature: "shenmm",
			},
		],
		[
			"长安神",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("长安")}${get.prefixSpan("神")}`,
			},
		],
		[
			"渭南",
			{
				showName: "渭",
				color: "#2a17d5",
				nature: "shenmm",
			},
		],
		[
			"渭南神",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("渭南")}${get.prefixSpan("神")}`,
			},
		],
		[
			"TW神",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("TW")}${get.prefixSpan("神")}`,
			},
		],
		[
			"TW将",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("TW")}${get.prefixSpan("将")}`,
			},
		],
		[
			"OL神",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("OL")}${get.prefixSpan("神")}`,
			},
		],
		[
			"旧神",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("旧")}${get.prefixSpan("神")}`,
			},
		],
		[
			"旧晋",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("旧")}${get.prefixSpan("晋")}`,
			},
		],
		[
			"新杀SP",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("新杀")}${get.prefixSpan("SP")}`,
			},
		],
		[
			"界SP",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("界")}${get.prefixSpan("SP")}`,
			},
		],
		[
			"S特神",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("★")}${get.prefixSpan("神")}`,
			},
		],
		[
			"手杀界",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("手杀")}${get.prefixSpan("界")}`,
			},
		],
		[
			"手杀SP",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("手杀")}${get.prefixSpan("SP")}`,
			},
		],
		[
			"战役篇神",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("战役篇")}${get.prefixSpan("神")}`,
			},
		],
		[
			"星",
			{
				color: "#ffd700",
				nature: "glodenmm",
			},
		],
		[
			"OL界",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("OL")}${get.prefixSpan("界")}`,
			},
		],
		[
			"OL谋",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("OL")}${get.prefixSpan("谋")}`,
			},
		],
		[
			"新杀谋",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("新杀")}${get.prefixSpan("谋")}`,
			},
		],
		[
			"经典神",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("经典")}${get.prefixSpan("神")}`,
			},
		],
		[
			"旧谋",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("旧")}${get.prefixSpan("谋")}`,
			},
		],
		[
			"手杀神",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("手杀")}${get.prefixSpan("神")}`,
			},
		],
		[
			"龙",
			{
				color: "#ff0000",
				nature: "firemm",
			},
		],
		[
			"桃",
			{
				color: "#FFC0CB",
				nature: "firemm",
			},
		],
		[
			"桃神",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("桃")}${get.prefixSpan("神")}`,
			},
		],
		[
			"玄",
			{
				color: "#000000",
				nature: "metalmm",
			},
		],
		[
			"荆",
			{
				color: "#00ff00",
				nature: "firemm",
			},
		],
	];
}

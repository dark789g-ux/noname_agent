import { get } from "noname";

export function createNamePrefixOrigins(): [string, import("@/library/contracts/menu.js").NamePrefix][] {
	return [
		[
			"界",
			{
				color: "#fdd559",
				nature: "soilmm",
			},
		],
		[
			"谋",
			{
				color: "#def7ca",
				nature: "woodmm",
			},
		],
		[
			"武",
			{
				color: "#fd8359",
				nature: "soilmm",
			},
		],
		[
			"乐",
			{
				color: "#f7f4fc",
				nature: "keymm",
			},
		],
		[
			"神",
			{
				color: "#faecd1",
				nature: "orangemm",
			},
		],
		[
			"族",
			{
				color: "#ee9ac7",
				nature: "firemm",
			},
		],
		[
			"晋",
			{
				color: "#f3c5ff",
				nature: "blackmm",
			},
		],
		[
			"侠",
			{
				color: "#eeeeee",
				nature: "qunmm",
			},
		],
		[
			"起",
			{
				color: "#c3f9ff",
				nature: "thundermm",
			},
		],
		[
			"承",
			{
				color: "#c3f9ff",
				nature: "thundermm",
			},
		],
		[
			"转",
			{
				color: "#c3f9ff",
				nature: "thundermm",
			},
		],
		[
			"合",
			{
				color: "#c3f9ff",
				nature: "thundermm",
			},
		],
		[
			"衰",
			{
				color: "#c3f9ff",
				nature: "thundermm",
			},
		],
		[
			"兴",
			{
				color: "#c3f9ff",
				nature: "thundermm",
			},
		],
		[
			"梦",
			{
				color: "#6affe2",
				nature: "watermm",
			},
		],
		[
			"疑",
			{
				color: "#5a6968",
				nature: "graymm",
			},
		],
		[
			"慢",
			{
				color: "#5a6968",
				nature: "graymm",
			},
		],
		[
			"嗔",
			{
				color: "#5a6968",
				nature: "graymm",
			},
		],
		[
			"用间",
			{
				color: "#c3f9ff",
				nature: "thundermm",
			},
		],
		[
			"战役篇",
			{
				color: "#c3f9ff",
				nature: "thundermm",
				showName: "战",
			},
		],
		[
			"武将传",
			{
				color: "#c3f9ff",
				nature: "thundermm",
				showName: "传",
			},
		],
		[
			"将",
			{
				nature: "firemm",
			},
		],
		[
			"新杀",
			{
				color: "#fefedc",
				nature: "metalmm",
				showName: "新",
			},
		],
		[
			"旧",
			{
				color: "#a4a4a4",
				nature: "blackmm",
			},
		],
		[
			"旧界",
			{
				color: "#a4a4a4",
				nature: "blackmm",
			},
		],
		[
			"节钺",
			{
				color: "#a4a4a4",
				nature: "blackmm",
			},
		],
		[
			"毅重",
			{
				color: "#a4a4a4",
				nature: "blackmm",
			},
		],
		[
			"★SP",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("SP")}`,
			},
		],
		[
			"☆SP",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("SP")}`,
			},
		],
		[
			"J.SP",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("SP")}`,
			},
		],
		[
			"K系列",
			{
				showName: "Ｋ",
			},
		],
		[
			"经典",
			{
				showName: "典",
			},
		],
		[
			"君",
			{
				color: "#fefedc",
				nature: "shenmm",
			},
		],
		[
			"骰子",
			{
				getSpan: () => {
					const span = document.createElement("span");
					span.style.fontFamily = "NonameSuits";
					span.textContent = "🎲";
					return span.outerHTML;
				},
			},
		],
		[
			"蛇",
			{
				getSpan: () => {
					const span = document.createElement("span");
					span.style.fontFamily = "NonameSuits";
					span.textContent = "🐍";
					return span.outerHTML;
				},
			},
		],
		[
			"骏骊",
			{
				getSpan: () => {
					const span = document.createElement("span");
					span.style.fontFamily = "NonameSuits";
					span.textContent = "🐎";
					return span.outerHTML;
				},
			},
		],
		[
			"赛马",
			{
				getSpan: () => {
					const span = document.createElement("span");
					span.style.fontFamily = "NonameSuits";
					span.textContent = "🏇";
					return span.outerHTML;
				},
			},
		],
		[
			"SP",
			{
				getSpan: () => {
					const span = document.createElement("span"),
						style = span.style;
					style.setProperty("writing-mode", "horizontal-tb");
					style.setProperty("-webkit-writing-mode", "horizontal-tb");
					style.fontFamily = "MotoyaLMaru";
					style.transform = "scaleY(0.85)";
					span.textContent = "SP";
					return span.outerHTML;
				},
			},
		],
		[
			"OL",
			{
				getSpan: () => {
					const span = document.createElement("span"),
						style = span.style;
					style.setProperty("writing-mode", "horizontal-tb");
					style.setProperty("-webkit-writing-mode", "horizontal-tb");
					style.fontFamily = "MotoyaLMaru";
					style.transform = "scaleY(0.85)";
					span.textContent = "OL";
					return span.outerHTML;
				},
			},
		],
		[
			"RE",
			{
				getSpan: () => {
					const span = document.createElement("span"),
						style = span.style;
					style.setProperty("writing-mode", "horizontal-tb");
					style.setProperty("-webkit-writing-mode", "horizontal-tb");
					style.fontFamily = "MotoyaLMaru";
					style.transform = "scaleY(0.85)";
					span.textContent = "RE";
					return span.outerHTML;
				},
			},
		],
	];
}

import { get } from "noname";

export function createNamePrefixStyles(): [string, import("@/library/contracts/menu.js").NamePrefix][] {
	return [
		[
			"荆神",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("荆")}${get.prefixSpan("神")}`,
			},
		],
		[
			"魂",
			{
				color: "#ffff99",
				nature: "firemm",
			},
		],
		[
			"韩氏",
			{
				color: "#ffff99",
				nature: "firemm",
			},
		],
		[
			"幻",
			{
				color: "#ffff99",
				nature: "firemm",
			},
		],
		[
			"标",
			{
				color: "#912cee",
				nature: "metalmm",
			},
		],
		[
			"牢",
			{
				color: "#EEEE00",
				nature: "blackmm",
			},
		],
		[
			"牢神",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("牢")}${get.prefixSpan("神")}`,
			},
		],
		[
			"友",
			{
				color: "#AAABFF",
				nature: "blackmm",
			},
		],
		[
			"骥",
			{
				color: "#AAABFF",
				nature: "blackmm",
			},
		],
		[
			"九鼎",
			{
				showName: "鼎",
				color: "#ffccff",
				nature: "blackmm",
			},
		],
		[
			"SCL",
			{
				showName: "競",
				color: "#fefedc",
				nature: "soilmm",
			},
		],
		[
			"汉",
			{
				color: "#ffd700",
				nature: "metalmm",
			},
		],
		[
			"OL乐",
			{
				showName: "乐",
				color: "#dab71b",
				nature: "firemm",
			},
		],
		[
			"烈",
			{
				color: "#8B0000",
				nature: "firemm",
			},
		],
		[
			"燕幽",
			{
				showName: "幽",
				color: "#ff6a6a",
				nature: "redmm",
			},
		],
		[
			"威",
			{
				color: "#ff9966",
				nature: "glodenmm",
			},
		],
		[
			"势",
			{
				color: "#7d26cd",
				nature: "purplemm",
			},
		],
		[
			"TW谋",
			{
				/**
				 * @returns {string}
				 */
				getSpan: (): string => `${get.prefixSpan("TW")}${get.prefixSpan("谋")}`,
			},
		],
		[
			"闪",
			{
				color: "#00bfff",
				nature: "watermm",
			},
		],
		[
			"ddd",
			{
				showName: "3D",
				color: "#edb5b5",
				nature: "watermm",
			},
		],
		[
			"荆扬",
			{
				showName: "扬",
				color: "#ffcc99",
				nature: "thundermm",
			},
		],
		[
			"魔",
			{
				color: "#2e002e",
				nature: "firemm",
			},
		],
		[
			"春秋",
			{
				color: "#10e98e",
				nature: "thundermm",
			},
		],
		[
			"青史",
			{
				getSpan: () => {
					const span = document.createElement("span");
					span.style.fontFamily = "NonameSuits";
					span.textContent = "📚";
					return span.outerHTML;
				},
			},
		],
		[
			"风云",
			{
				getSpan: () => {
					const span = document.createElement("span");
					span.style.fontFamily = "NonameSuits";
					span.textContent = "☁️";
					return span.outerHTML;
				},
			},
		],
		[
			"爻",
			{
				getSpan: () => {
					const span = document.createElement("span");
					span.style.fontFamily = "NonameSuits";
					span.textContent = "☯";
					return span.outerHTML;
				},
			},
		],
		[
			"忍",
			{
				color: "#180a29",
				nature: "thundermm",
			},
		],
		[
			"狂",
			{
				color: "#8B00FF",
				nature: "firemm",
			},
		],
		[
			"绶",
			{
				color: "#8B00FF",
				nature: "shenmm",
			},
		],
		[
			"欧陆",
			{
				getSpan: () => {
					const span = document.createElement("span"),
						style = span.style;
					style.setProperty("writing-mode", "horizontal-tb");
					style.setProperty("-webkit-writing-mode", "horizontal-tb");
					style.fontFamily = "MotoyaLMaru";
					style.transform = "scaleY(0.85)";
					span.textContent = "EU";
					return span.outerHTML;
				},
			},
		],
		[
			"PE",
			{
				getSpan: () => {
					const span = document.createElement("span"),
						style = span.style;
					style.setProperty("writing-mode", "horizontal-tb");
					style.setProperty("-webkit-writing-mode", "horizontal-tb");
					style.fontFamily = "MotoyaLMaru";
					style.transform = "scaleY(0.85)";
					span.textContent = "PE";
					return span.outerHTML;
				},
			},
		],
		[
			"智将",
			{
				showName: "智",
				color: "#99e2ff",
				nature: "firemm",
			},
		],
		[
			"闪耀",
			{
				showName: "闪",
				color: "#c282b2",
				nature: "keymm",
			},
		],
		[
			"闪耀战姬",
			{
				getSpan: () => {
					const span = document.createElement("span");
					span.style.fontFamily = "NonameSuits";
					span.style.color = "#c282b2";
					span.dataset.nature = "keymm";
					span.textContent = "★";
					return span.outerHTML;
				},
			},
		],
		[
			"领主",
			{
				color: "#2e002e",
				nature: "firemm",
			},
		],
		[
			"徐兖",
			{
				showName: "徐",
				color: "#ff0000",
				nature: "firemm",
			},
		],
		[
			"有",
			{
				color: "#dd9420",
				nature: "firemm",
			},
		],
		[
			"文心雕龙",
			{
				showName: "文",
				color: "#ffffff",
				nature: "firemm",
			},
		],
		[
			"26",
			{
				getSpan: () => {
					const span = document.createElement("span"),
						style = span.style;
					style.setProperty("writing-mode", "horizontal-tb");
					style.setProperty("-webkit-writing-mode", "horizontal-tb");
					style.fontFamily = "MotoyaLMaru";
					style.transform = "scaleY(0.85)";
					span.textContent = "26";
					return span.outerHTML;
				},
			},
		],
		[
			"集蜜",
			{
				color: "#e3d660",
				nature: "metalmm",
			},
		],
	];
}

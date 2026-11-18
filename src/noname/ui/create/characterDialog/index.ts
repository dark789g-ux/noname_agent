import { lib, game, get, _status, ui } from "noname";
import type { Pagination } from "@/util/pagination.js";
import type { Create } from "../index.js";
import { buildCharacterDialogFilterBar, getCharacterCapt, type CharacterDialogFilterState } from "./filterBar.js";
import { attachCharacterSkillSearch } from "./skillSearch.js";

interface ParsedDialogOptions {
	filter?: (name: string) => any;
	str?: string;
	noclick?: boolean;
	thisiscard: boolean;
	seperate?: (list: any[]) => Record<string, any>;
	expandall: boolean;
	onlypack?: string;
	heightset: boolean;
	characterx: boolean;
}

function parseCharacterDialogArgs(args: any[]): ParsedDialogOptions {
	const opts: ParsedDialogOptions = {
		thisiscard: false,
		expandall: false,
		heightset: false,
		characterx: false,
	};
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "thisiscard") {
			opts.thisiscard = true;
		} else if (arg === "expandall") {
			opts.expandall = true;
		} else if (arg === "heightset") {
			opts.heightset = true;
		} else if (arg == "characterx") {
			opts.characterx = true;
		} else if (typeof arg == "string" && arg.startsWith("onlypack:")) {
			opts.onlypack = arg.slice(9);
		} else if (arg && typeof arg == "object" && typeof arg.seperate == "function") {
			opts.seperate = arg.seperate;
		} else if (typeof arg === "string") {
			opts.str = arg;
		} else if (typeof arg === "function") {
			opts.filter = arg;
		} else if (typeof arg == "boolean") {
			opts.noclick = arg;
		}
	}
	return opts;
}

function collectCandidates(opts: ParsedDialogOptions): { list: any[]; groups: string[]; namecapt: string[] } {
	const list: any[] = [];
	const groups: string[] = [];
	const namecapt: string[] = [];
	const { thisiscard, filter } = opts;
	if (thisiscard) {
		for (const i in lib.card) {
			if (!lib.translate[i + "_info"]) {
				continue;
			}
			if (filter && filter(i)) {
				continue;
			}
			list.push(["", get.translation(lib.card[i].type), i]);
			if (namecapt.indexOf(getCharacterCapt(i)) == -1) {
				namecapt.push(getCharacterCapt(i));
			}
		}
	} else {
		for (const i in lib.character) {
			if (lib.character[i][4]) {
				if (lib.character[i].isMinskin) {
					continue;
				}
				if (lib.character[i].isBoss || lib.character[i].isHiddenBoss) {
					if (lib.config.mode == "boss") {
						continue;
					}
					if (!lib.character[i].isBossAllowed) {
						continue;
					}
				}
				if (lib.character[i].isHiddenInStoneMode) {
					continue;
				}
				if (lib.character[i].isUnseen) {
					continue;
				}
			}
			if (lib.config.banned.includes(i)) {
				continue;
			}
			if (lib.characterFilter[i] && !lib.characterFilter[i](get.mode())) {
				continue;
			}
			if (filter && filter(i)) {
				continue;
			}
			list.push(i);
			if (get.is.double(i)) {
				groups.add("double");
			} else {
				groups.add(lib.character[i][1]);
			}
			if (namecapt.indexOf(getCharacterCapt(i)) == -1) {
				namecapt.push(getCharacterCapt(i));
			}
		}
	}
	namecapt.sort((a, b) => (a > b ? 1 : -1));
	groups.sort(lib.sort.group);
	if (!thisiscard) {
		namecapt.remove("自定义");
		namecapt.push("newline");
		for (const i in lib.characterDialogGroup) {
			namecapt.push(i);
		}
	}
	return { list, groups, namecapt };
}

function sortCandidates(list: any[], thisiscard: boolean): void {
	if (thisiscard) {
		const groupSort = function (name: any[]) {
			const type = lib.card[name[2]].type;
			if (lib.cardType[type]) {
				return lib.cardType[type];
			}
			switch (type) {
				case "basic":
					return 0;
				case "chess":
					return 1.5;
				case "trick":
					return 2;
				case "delay":
					return 3;
				case "equip":
					return 4;
				case "zhenfa":
					return 5;
				default:
					return 6;
			}
		};
		list.sort(function (a, b) {
			const del = groupSort(a) - groupSort(b);
			if (del != 0) {
				return del;
			}
			const aa = a;
			const bb = b;
			if (a.includes("_")) {
				a = a.slice(a.lastIndexOf("_") + 1);
			}
			if (b.includes("_")) {
				b = b.slice(b.lastIndexOf("_") + 1);
			}
			if (a != b) {
				return a > b ? 1 : -1;
			}
			return aa > bb ? 1 : -1;
		});
	} else {
		list.sort(lib.sort.character);
	}
}

export const characterDialogMethods = {
	characterDialog(this: Create, ...args: any[]) {
		const opts = parseCharacterDialogArgs(args);
		const { list, groups, namecapt } = collectCandidates(opts);
		// 筛选武将的信息
		const node = ui.create.div(".caption.pointerspan") as HTMLDivElement & Record<string, any>;
		if (get.is.phoneLayout()) {
			node.style.fontSize = "30px";
		}

		const filterState: CharacterDialogFilterState = {
			node,
			groups,
			namecapt,
			thisiscard: opts.thisiscard,
			onlypack: opts.onlypack,
			filternode: null,
			restoreState(btn) {
				if (btn.style.display == "none") {
					btn.style.display = "";
				}
			},
			updatePagination() {
				const dialog = filterState.dialog;
				if (dialog && dialog.paginationMaxCount.get("character")) {
					const buttons = dialog.content.querySelector(".buttons");
					const array = dialog.buttons.filter(item => !item.classList.contains("nodisplay") && item.style.display !== "none");
					const p = dialog.paginationMap.get(buttons as HTMLDivElement) as Pagination | undefined;
					if (p) {
						p.state.data = array;
						// @ts-expect-error Pagination 类型将 totalPageCount 作为内部方法签名暴露
						p.setTotalPageCount(Math.ceil(array.length / dialog.paginationMaxCount.get("character")));
					}
				}
			},
		};
		const clickCapt = buildCharacterDialogFilterBar(filterState);

		sortCandidates(list, opts.thisiscard);
		// 自由选将
		const dialog = ui.create.dialog("hidden");
		filterState.dialog = dialog;
		dialog.classList.add("noupdate");
		dialog.classList.add("scroll1");
		dialog.classList.add("scroll2");
		dialog.classList.add("scroll3");
		dialog.supportsPagination = Boolean(parseInt(lib.config.showMax_character_number));
		dialog.paginationMaxCount.set("character", parseInt(lib.config.showMax_character_number));
		dialog.addEventListener(lib.config.touchscreen ? "touchend" : "mouseup", function () {
			_status.clicked2 = true;
		});
		if (opts.heightset) {
			// 增加 50px 保证底部分页按钮完整显示
			dialog.style.height = (game.layout == "long2" || game.layout == "nova" ? 380 : 350) + 50 + "px";
			dialog._scrollset = true;
		}
		dialog.getCurrentCapt = function (link, capt, noalph) {
			const currentcapt = noalph ? this.currentcapt2 : this.currentcapt;
			if (typeof link != "string") {
				return null;
			}
			if (this.seperatelist && noalph && currentcapt != null) {
				if (this.seperatelist[currentcapt].includes(link)) {
					return capt;
				}
				return null;
			}
			if (currentcapt != null && lib.characterDialogGroup[currentcapt]) {
				return lib.characterDialogGroup[currentcapt](link, capt);
			}
			if (currentcapt != null && lib.characterPack[currentcapt]) {
				if (lib.characterPack[currentcapt][link]) {
					return capt;
				}
				return null;
			}
			return this.currentcapt ?? null;
		};

		attachCharacterSkillSearch(this, dialog, filterState.updatePagination);

		if (opts.str) {
			dialog.add(opts.str);
		}
		dialog.add(node);
		if (opts.thisiscard) {
			if (opts.seperate) {
				const seperated = opts.seperate(list);
				dialog.seperate = [];
				dialog.seperatelist = seperated.list;
				if (dialog.seperatelist) {
					const sepBar = document.createElement("div");
					sepBar.style.marginTop = "5px";
					sepBar.style.display = "block";
					sepBar.style.fontFamily = "xinwei";
					sepBar.style.fontSize = get.is.phoneLayout() ? "32px" : "22px";
					sepBar.style.textAlign = "center";
					node.appendChild(sepBar);
					for (const i in dialog.seperatelist) {
						const separateButton: HTMLSpanElement & { link?: string; seperate?: boolean } = document.createElement("span");
						separateButton.style.margin = "3px";
						separateButton.innerHTML = i;
						separateButton.link = i;
						separateButton.seperate = true;
						separateButton.addEventListener(lib.config.touchscreen ? "touchend" : "click", clickCapt);
						sepBar.appendChild(separateButton);
					}
				}
				for (let i in seperated) {
					if (i == "list") {
						continue;
					}
					let link = "";
					const linkcontent = seperated[i];
					if (i.includes("_link:")) {
						link = i.slice(i.indexOf("_link:") + 6);
						i = i.slice(0, i.indexOf("_link:"));
					}
					const nodesep = ui.create.caption(i, dialog.content);
					nodesep.link = link;
					dialog.seperate.push(nodesep);
					dialog.add([linkcontent, "vcard"], opts.noclick);
				}
			} else {
				dialog.add([list, "vcard"], opts.noclick);
			}
		} else {
			dialog.add([list, opts.characterx ? "characterx" : "character"], opts.noclick);
		}
		dialog.add(ui.create.div(".placeholder"));
		for (let i = 0; i < dialog.buttons.length; i++) {
			if (opts.thisiscard) {
				dialog.buttons[i].capt = getCharacterCapt(dialog.buttons[i].link[2]);
			} else {
				dialog.buttons[i].group = lib.character[dialog.buttons[i].link][1];
				dialog.buttons[i].capt = getCharacterCapt(dialog.buttons[i].link);
			}
		}
		if (!opts.expandall) {
			if (!opts.thisiscard && (lib.characterDialogGroup[lib.config.character_dialog_tool] || lib.config.character_dialog_tool == "自创")) {
				clickCapt.call(node[lib.config.character_dialog_tool]);
			}
		}
		if (dialog.paginationMaxCount.get("character")) {
			const buttons = dialog.content.querySelector(".buttons") as HTMLDivElement;
			const array = dialog.buttons.filter(item => !item.classList.contains("nodisplay") && item.style.display !== "none");
			dialog.addPagination({
				data: array,
				totalPageCount: Math.ceil(array.length / (dialog.paginationMaxCount.get("character") ?? 1)),
				container: dialog.content,
				insertAfter: buttons,
				onPageChange: state => {
					const { pageNumber, data } = state;
					data.forEach((item, index) => {
						const maxCount = dialog.paginationMaxCount.get("character") ?? 1;
						if (index >= (pageNumber - 1) * maxCount && index < pageNumber * maxCount) {
							item.classList.remove("nodisplay");
						} else {
							item.classList.add("nodisplay");
						}
					});
				},
				changePageEvent: "click",
			});
		}

		return dialog;
	},
};

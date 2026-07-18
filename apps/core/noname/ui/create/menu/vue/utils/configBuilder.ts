import { ui, get, lib, _status, game } from "noname";
import type { SelectConfigData } from "./../../../../../../typings/type";
import { doToggle, doMenuItem } from "./configInteract";
import { openSwitcherPopup, closePopup, setNoclose } from "./popupHost";

// ---------------------------------------------------------------------------
// 从 NonameConfig.vue 移入的三个内部函数
// ---------------------------------------------------------------------------

/**
 * updateBr —— 每 3 个子元素插入 <br>
 * 1:1 迁移 index.js:271-285
 */
function updateBr(menu: HTMLElement) {
	const brs = Array.from(menu.querySelectorAll(".menu.visual>br"));
	while (brs.length) {
		brs.shift()!.remove();
	}
	const split: ChildNode[] = [];
	for (let i = 1; i < menu.childElementCount; i++) {
		if (i % 3 == 0) {
			split.push(menu.childNodes[i]);
		}
	}
	for (let i = 0; i < split.length; i++) {
		menu.insertBefore(ui.create.node("br"), split[i]);
	}
}

/**
 * 构建 visualMenu 分支
 * 1:1 迁移 index.js:234-296
 */
function buildVisualMenu(
	menu: HTMLDivElement,
	config: SelectConfigData,
	configNodeEl: HTMLElement,
) {
	menu.classList.add("visual");

	const updateVisual = function (this: HTMLElement) {
		// @ts-expect-error _link 是运行时挂在节点上的自定义属性
		config.visualMenu(this, this._link, config.item[this._link] || this._link, config);
	};

	const createNode = function (i: string, before?: HTMLElement) {
		const visualMenu = ui.create.div();
		if (config.visualBar) {
			if (before) {
				menu.insertBefore(visualMenu, before);
			} else {
				menu.insertBefore(visualMenu, menu.lastChild);
			}
		} else {
			menu.appendChild(visualMenu);
		}
		ui.create.div(".name", get.verticalStr(config.item[i] || i), visualMenu);
		visualMenu._link = i;
		if (config.visualMenu(visualMenu, i, config.item[i] || i, config) !== false) {
			visualMenu.listen(function clickMenuItem(this: HTMLElement) {
				doMenuItem(configNodeEl, this, config);
				closePopup();
			});
		}
		// @ts-expect-error update 是运行时挂在节点上的自定义属性
		visualMenu.update = updateVisual;
	};

	if (config.visualBar) {
		const visualBar = ui.create.div(menu, function () {
			setNoclose();
		});
		menu.classList.add("withbar");
		config.visualBar(visualBar, config.item, createNode, configNodeEl);
		// @ts-expect-error update 是运行时挂在节点上的自定义属性
		visualBar.update = function () {
			config.visualBar(visualBar, config.item, createNode, configNodeEl);
		};
	}

	for (const i in config.item) {
		createNode(i);
	}

	lib.setScroll(menu);

	// @ts-expect-error updateBr 是运行时挂在节点上的自定义属性
	menu.updateBr = function () {
		updateBr(menu);
	};
	// @ts-expect-error updateBr 是运行时挂在节点上的自定义属性
	menu.updateBr();
}

/**
 * 构建普通文本菜单分支
 * 1:1 迁移 index.js:288-296
 */
function buildTextMenu(
	menu: HTMLDivElement,
	config: SelectConfigData,
	configNodeEl: HTMLElement,
) {
	for (const i in config.item) {
		const textMenu = ui.create.div("", config.item[i] || i, menu, function clickMenuItem(this: HTMLElement) {
			doMenuItem(configNodeEl, this, config);
			closePopup();
		});
		textMenu._link = i;
		if (config.textMenu) {
			config.textMenu(textMenu, i, config.item[i] || i, config);
		}
		lib.setScroll(menu);
	}
}

// ---------------------------------------------------------------------------
// 公共入口函数（供 createConfig 与 NonameConfig.vue 共用）
// ---------------------------------------------------------------------------

/**
 * buildSwitcherMenu —— 构建 switcher 的 .menu 子项（visual/text 分支）。
 * 这是抽取出的公共入口：根据 config.visualMenu 决定走 buildVisualMenu 还是 buildTextMenu。
 */
export function buildSwitcherMenu(menu: HTMLDivElement, config: SelectConfigData, configNodeEl: HTMLElement) {
	if (config.visualMenu) {
		buildVisualMenu(menu, config, configNodeEl);
	} else {
		buildTextMenu(menu, config, configNodeEl);
	}
}

// ---------------------------------------------------------------------------
// 1:1 迁移旧版 createConfig（menu/index.js:193-361）
// ---------------------------------------------------------------------------

/**
 * createConfig —— 命令式创建 .config DOM 节点，根据 config 对象字段分发到 6 种形态。
 *
 * 旧版 createConfig 是构建菜单配置项的核心工厂函数，包含：
 * - clear 分支（分组标题）
 * - Array.isArray(init) 分支（空壳）
 * - switcher 分支（下拉选择器，含 visual/text 两种菜单子形态）
 * - range 分支（空操作）
 * - input 分支（可编辑输入框，含四分支 onblur）
 * - toggle 分支（默认开关）
 *
 * @param config   配置数据对象
 * @param position 可选父容器，传入则 appendChild
 * @returns 构建的 .config DOM 节点
 */
export function createConfig(config: SelectConfigData, position?: HTMLElement): HTMLElement {
	const node = ui.create.div(".config", config.name);
	node._link = { config: config };

	// --- intro 处理 ---
	if (!config.clear) {
		if (config.name != "开启") {
			if (config.name == "屏蔽弱将") {
				config.intro = "强度过低的武将（孙策除外）不会出现在选将框，也不会被AI选择";
			} else if (config.name == "屏蔽强将") {
				config.intro = "强度过高的武将不会出现在选将框，也不会被AI选择";
			} else if (!config.intro) {
				config.intro = "设置" + config.name;
			}
			lib.setIntro(node, function (uiintro: any) {
				if (lib.config.touchscreen) {
					_status.dragged = true;
				}
				uiintro.style.width = "170px";
				let str = config.intro;
				if (typeof str == "function") {
					str = str();
				}
				uiintro._place_text = uiintro.add('<div class="text" style="display:inline">' + str + "</div>");
			});
		}
	} else {
		node.innerHTML = "<span>" + config.name + "</span>";
		if (!config.nopointer) {
			node.classList.add("pointerspan");
		}
	}

	// --- 6 分支分发 ---

	if (config.item) {
		// config.item 为 function 时立即求值
		if (typeof config.item == "function") {
			config.item = (config.item as Function)();
		}
		if (Array.isArray(config.init)) {
			// Array.isArray(init) 分支 —— 空壳，不交互
			void 0;
		} else {
			// switcher 分支
			node.classList.add("switcher");
			node._link.choosing = ui.create.div("", config.item[config.init as string] || config.init, node);
			node._link.menu = ui.create.div(".menu");

			// 创建时即填充 menu 子项（与旧版 createConfig 一致）
			buildSwitcherMenu(
				node._link.menu as HTMLDivElement,
				config,
				node,
			);

			node._link.menu._link = node;
			node._link.current = config.init;

			node.listen(function switcherOpen(this: HTMLElement) {
				if (this.classList.contains("disabled")) return;
				this.classList.add("on");
				// @ts-expect-error _link 是运行时挂在节点上的自定义属性
				openSwitcherPopup(this._link.menu as HTMLDivElement, this);
			});
		}
	} else if (config.range) {
		// range 分支 —— 空操作
		void 0;
	} else if (config.clear) {
		// clear 分支
		if (node.innerHTML.length >= 15) {
			node.style.height = "auto";
		}
		node.listen(function clickToggle(this: HTMLElement) {
			doToggle(this, config);
		});
	} else if (config.input) {
		// input 分支
		node.classList.add("switcher");
		const input = ui.create.div(node);
		if (!config.fixed) {
			input.contentEditable = "true";
			input.style.webkitUserSelect = "text";
		}
		input.style.minWidth = "10px";
		input.style.maxWidth = "60%";
		input.style.overflow = "hidden";
		input.style.whiteSpace = "nowrap";
		input.onkeydown = function (e: KeyboardEvent) {
			if (e.key == "Enter") {
				e.preventDefault();
				e.stopPropagation();
				input.blur();
			}
		};

		// 四分支 onblur
		if (config.name == "联机昵称") {
			input.innerHTML = config.init || "无名玩家";
			input.onblur = function () {
				input.innerHTML = input.innerHTML.replace(/<br>/g, "");
				if (!input.innerHTML || get.is.banWords(input.innerHTML)) {
					input.innerHTML = "无名玩家";
				}
				input.innerHTML = input.innerHTML.slice(0, 12);
				game.saveConfig("connect_nickname", input.innerHTML);
				game.saveConfig("connect_nickname", input.innerHTML, "connect");
			};
		} else if (config.name == "联机头像") {
			// 显示当前配置的武将名称（直接使用翻译，不额外添加前缀）
			const currentId = lib.config.connect_avatar || config.init || "caocao";
			input.innerHTML = lib.translate[currentId] || "曹操";
			input.onblur = config.onblur;
		} else if (config.name == "联机大厅") {
			input.innerHTML = config.init || lib.hallURL;
			input.onblur = function () {
				if (!input.innerHTML) {
					input.innerHTML = lib.hallURL;
				}
				input.innerHTML = input.innerHTML.replace(/<br>/g, "");
				game.saveConfig("hall_ip", input.innerHTML, "connect");
			};
		} else {
			input.innerHTML = config.init;
			input.onblur = config.onblur;
		}
	} else {
		// toggle 分支（默认）
		node.classList.add("toggle");
		node.listen(function clickToggle(this: HTMLElement) {
			doToggle(this, config);
		});
		ui.create.div(ui.create.div(node));
		if (config.init === true) {
			node.classList.add("on");
		}
	}

	if (position) {
		position.appendChild(node);
	}
	return node;
}

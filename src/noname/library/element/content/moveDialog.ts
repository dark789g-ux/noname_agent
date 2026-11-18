import { createBatchMove } from "./moveBatch.js";
import { _status, game, get, lib, ui, ai } from "noname";
import { GameEvent, initializeEvent, type RawGameDrawEvent } from "../gameEvent.js";
import { Player } from "../player.js";
import type { LegacyChooseButtonCreateDialog } from "../Player/legacyParams";
import { delay } from "@/util/index.js";
import { tryLLMDecide } from "@/llm/index.js";
import { forwardEventLogSkill, getLogSkillName } from "../GameEvent/logSkill.js";
import { getButtonSubtypes } from "../GameEvent/buttonSubtypes.js";
import { isImportModePayload, isSelectionResultObject as isBoundarySelectionResultObject, normalizeSelectionResult as normalizeBoundarySelectionResult, type SelectionResultRuntime } from "../GameEvent/resultBoundary.js";
import { getRegisteredSkill, requireRegisteredSkill } from "../../skillRegistry.js";
import { isRecord, isAIResult, isSelectionResultObject, normalizeSelectionResult, isCardLinks, isVCardLinks, isCardMatrix, normalizeChooseButtonTargetResult, applyLLMDecision, attachChooseButtonSelectionSpec } from "./selectionResults.js";
import { createMoveDrag, type GuanxingButton, type GuanxingContainer } from "./moveDrag.js";

export function showMoveDialog(event) {
	return new Promise(resolve => {
		// 兼容旧版本扩展使用guanxing_button喵
		ui.selected.guanxing_button = null;
		// 使用guanxing_buttons作为数组喵，因为buttons会被uncheck清除但是选中状态不会喵，导致不同步哦
		ui.selected.guanxing_buttons = [];

		const list = event.list;
		const filterMove = event.filterMove ?? (() => true);
		const filterOk = event.filterOk ?? (() => true);
		// 如果只有一行那么多选一般来说就没什么意义喵
		const canMultiselect = list.length > 1 && lib.config.choose_all_button && event.allowChooseAll;

		//_status.imchoosing = true;
		event.settleed = false;

		event.dialog = ui.create.dialog(event.prompt || "请选择要操作的牌", "hidden", "forcebutton");

		event.switchToAuto = () => {
			if (!filterOk(event.moved)) {
				if (!event.forced) {
					event._result = { bool: false };
				} else {
					event._result = "ai";
				}
			} else {
				event._result = {
					bool: true,
					moved: event.moved,
				};
			}
			event.dialog.close();
			if (ui.confirm) {
				ui.confirm.close();
			}
			game.resume();
			_status.imchoosing = false;
			setTimeout(() => {
				ui.arena.classList.remove("choose-to-move");
			}, 500);
			resolve(event._result);
		};
		event.dialog.classList.add("scroll1");
		event.dialog.classList.add("scroll2");
		event.dialog.classList.add("fullwidth");
		if (list.length > 2) {
			ui.arena.classList.add("choose-to-move");
			event.dialog.classList.add("fullheight");
		}

		/**
		 * 保存每次移动后的对应实体牌的位置
		 */
		const moved: Card[][] = [];
		event.moved = moved;
		/**
		 * 所有可移动的buttons数组
		 */
		const buttonss: GuanxingContainer[] = [];
		event.buttonss = buttonss;
		/**
		 * 是否处于拖拽动画中(禁止其他的选择，拖拽)
		 */
		event.isPlayingAnimation = false;

		// 动画时长
		const animationDuration = lib.config.animation_choose_to_move ? 300 : 0;

		// 初始化触摸点位置和元素偏移量
		/**
		 * 每次移动后更新数据
		 */
		const updateButtons = () => {
			for (const i of buttonss) {
				// 更新每次移动后的对应实体牌的位置
				event.moved[i._link] = get.links(Array.from(i.children));
				// 更新这个buttons的提示文本
				if (typeof i.textPrompt == "function") {
					const previousSibling = i.previousSibling;
					if (previousSibling instanceof HTMLElement) {
						previousSibling.innerHTML = `<div class="text center">${i.textPrompt(event.moved[i._link])}</div>`;
					}
				}
			}
			if (filterOk(event.moved)) {
				ui.create.confirm("o");
			} else {
				if (!event.forced) {
					ui.create.confirm("c");
				} else if (ui.confirm) {
					ui.confirm.close();
				}
			}
		};

		/**
		 * 计算可以批量移动的按钮
		 *
		 * @param {Button[]} buttonList
		 * @param {HTMLDivElement} buttonsDiv
		 * @param {"first"|"last"} position
		 */
		const filterBatchMove = createBatchMove(event);

		const updateSelectAllButtons = () => {
			const buttons = Array.from(event.dialog.querySelectorAll(".select-all")).filter((button): button is HTMLElement => button instanceof HTMLElement);

			for (const button of buttons) {
				const nextElementSibling = button.nextElementSibling;
				const hasSelected = nextElementSibling instanceof HTMLElement && nextElementSibling.querySelector(".glow2");
				button.innerHTML = hasSelected ? "反选" : "全选";
			}
		};

		/**
		 * 移除所有符合条件的选中按钮
		 *
		 * @param { ((button: HTMLDivElement) => boolean)? } filter
		 */
		const clearSelected = (filter?: (button: HTMLDivElement) => boolean) => {
			for (let i = ui.selected.guanxing_buttons.length; i--; ) {
				const button = ui.selected.guanxing_buttons[i];

				if (!filter || filter(button)) {
					ui.selected.guanxing_buttons.splice(i, 1);
					button.classList.remove("glow2");
				}
			}

			ui.selected.guanxing_button = ui.selected.guanxing_buttons[0] || null;
			updateSelectAllButtons();
		};

		/**
		 * 选中所有传入的按钮
		 * 只能多选相同容器的按钮
		 *
		 * @param { HTMLDivElement[] } button
		 */
		const selectButtons = (...buttons) => {
			if (!buttons.length) {
				return;
			}

			const container = buttons[0].parentElement;
			clearSelected(button => button.parentElement !== container);
			buttons = buttons.filter(button => button.parentElement === container);

			buttons.forEach(button => {
				button.classList.add("glow2");
			});

			ui.selected.guanxing_buttons.addArray(buttons);
			ui.selected.guanxing_button = ui.selected.guanxing_buttons[0] || null;
			updateSelectAllButtons();
		};

		/**
		 * 切换按钮的选中状态
		 *
		 * @param {HTMLElement} button
		 * @returns {boolean}
		 */
		const toggleButton = button => {
			const nextState = !button.classList.contains("glow2");

			if (!nextState) {
				button.classList.remove("glow2");
				ui.selected.guanxing_buttons.remove(button);
				ui.selected.guanxing_button = ui.selected.guanxing_buttons[0] || null;
				updateSelectAllButtons();
			} else {
				if (!canMultiselect) {
					clearSelected(); // 对于不能多选就要清空之前的选择喵
				}
				selectButtons(button); // 这里要使用selectButtons排除其他容器的按钮喵
			}

			return nextState;
		};

		/**
		 * 反转容器中所有按钮的选择状态
		 *
		 * @param { HTMLDivElement } container
		 */
		const revertSelection = container => {
			const selecteds = new Set(ui.selected.guanxing_buttons.filter(button => button.parentElement === container));
			const nextSelecteds = Array.from(container.children).filter((button): button is GuanxingButton => button instanceof HTMLDivElement && !selecteds.has(button));

			clearSelected();
			selectButtons(...nextSelecteds);
		};

		/**
		 * 确认是否是拖拽开始
		 *
		 * 按下时，是不能判断出是否拖拽开始的，得在move事件才可以
		 *
		 * @param { TouchEvent | MouseEvent } e
		 */
		const { dragStart, onDrag, resetDrag } = createMoveDrag(event, clearSelected, selectButtons);

		const dragEnd = e => {
			if (event.isPlayingAnimation) {
				return;
			}
			if (e instanceof MouseEvent) {
				if (e.which != 1) {
					return;
				}
			}
			if (window.TouchEvent && e instanceof TouchEvent) {
				if (e.changedTouches.length != 1) {
					return;
				}

				e = e.changedTouches[0];
			}

			const isDragging = ui.selected.guanxing_buttons.length === 1 && document.contains(ui.selected.guanxing_buttons[0]?.copy);

			buttonss.forEach(btn => {
				Array.from(btn.children)
					.filter((element): element is GuanxingButton => element instanceof HTMLDivElement)
					.forEach(element => {
						if (element.copy && ui.window.contains(element.copy)) {
							ui.window.removeChild(element.copy);
						}
					});
			});

			// 如果点击的是全选按钮我们不处理喵
			if (e.target.classList.contains("select-all")) {
				return;
			}

			// 获取鼠标位置喵
			const clientX = e.clientX / game.documentZoom;
			const clientY = e.clientY / game.documentZoom;
			let aniamtionPromise: Promise<void> | undefined;

			let spannedSingle = false;

			// 我们要判断是不是跨区的单个交换喵，但是如果是拖拽的情况下一定是单个交换喵，所以没必要进行额外判断喵
			if (!isDragging && ui.selected.guanxing_buttons.length === 1) {
				const curCard = ui.selected.guanxing_buttons[0];
				const target = e.target;
				if (!curCard.contains(target)) {
					const buttons = buttonss.find(b => b.contains(target));
					if (buttons && !buttons.contains(curCard)) {
						// 此时用户点击了第一张牌，并在另一个区域点击了第二张牌喵
						spannedSingle = true;
					}
				}
			}

			// 如果是拖动移动、非多选或者跨区单个交换的情况下，我们走原来的代码喵
			if (isDragging || (!canMultiselect && ui.selected.guanxing_buttons.length === 1) || spannedSingle) {
				const curCard = ui.selected.guanxing_buttons[0];
				// 鼠标当前处于哪个元素上
				const target = document.elementFromPoint(clientX * game.documentZoom, clientY * game.documentZoom);
				// 相当于没移动，让它自己触发后续的click
				if (curCard.contains(target)) {
					return;
				}
				// 停止拖拽的目标处于哪个buttons区域中
				const buttons = buttonss.find(b =>
					// Node.contains()
					b.contains(target)
				);
				// 不能拖拽到区域外
				if (!buttons) {
					return;
				}
				const children = Array.from(buttons.children).filter((element): element is GuanxingButton => element instanceof HTMLDivElement);
				// 与card交换位置
				const card = children.find(element => element.contains(target));
				// 判断是否可以移动
				if (!card) {
					if (!filterMove(curCard, buttons._link, event.moved)) {
						return;
					}
				} else {
					if (!filterMove(card, curCard, event.moved)) {
						return;
					}
				}

				// 用flip动画移动过去喵
				if (!card) {
					// 如果拖动在按钮区域而不是按钮
					// 那么我们计算应该拖动到最前面还是最后面喵
					let position: "first" | "last" | Node | undefined;

					if (buttons.children.length) {
						const firstChild = buttons.firstElementChild;
						if (firstChild && clientX < firstChild.getBoundingClientRect().left / game.documentZoom) {
							position = "first";
						}
					} else {
						position = "last";
					}

					// 执行动画喵
					aniamtionPromise = game.$elementGoto(curCard, buttons, position, animationDuration);
				} else {
					// 如果拖动到按钮上面，我们交换两个按钮喵
					const buttons2 = curCard.parentElement;
					const pos1 = card.nextElementSibling || "last";
					const pos2 = curCard.nextElementSibling || "last";

					// 执行动画喵
					aniamtionPromise = game.$elementSwap(curCard, card, animationDuration);
				}

				clearSelected();
			} else if (ui.selected.guanxing_buttons.length) {
				// 获取当前点击的节点喵
				const target = e.target;
				// 寻找点击的是那个区域哦喵
				const buttons = buttonss.find(b => b.contains(target));

				if (!buttons || buttons !== target) {
					// 如果点击的是按钮或者区域外喵
					return; // 不产生任何效果喵，点击选中由其他位置实现喵，此处仅负责移动哦
				}

				// 判断一下要移动到哪里去哦喵
				let position: "first" | "last" | Node | undefined;

				if (buttons.children.length) {
					const firstChild = buttons.firstElementChild;

					if (firstChild && clientX < firstChild.getBoundingClientRect().left / game.documentZoom) {
						position = firstChild; // 此处不可以使用"first"喵，会导致倒序哦喵
					}
				} else {
					position = "last";
				}

				const selected = filterBatchMove(ui.selected.guanxing_buttons, buttons, position !== "last" ? "first" : "last");
				const subPromises: Promise<void>[] = [];

				for (const element of selected) {
					subPromises.push(game.$elementGoto(element, buttons, position, animationDuration));
				}

				aniamtionPromise = Promise.all(subPromises).then(() => undefined);
				clearSelected();
			}

			if (aniamtionPromise) {
				event.isPlayingAnimation = true;

				aniamtionPromise.then(() => {
					event.isPlayingAnimation = false;
					updateButtons();
				});
			}

			resetDrag();
		};

		// 根据数据创建区域
		for (const [i, item] of list.entries()) {
			const tex = event.dialog.add(`<div class="text center">${item[0]}</div>`);
			tex.classList.add("choosetomove");
			if (canMultiselect) {
				const selectAll = ui.create.div(".select-all.popup.pointerdiv", event.dialog.content);
				selectAll.innerHTML = "全选";
				selectAll.listen(e => {
					if (!(e.target instanceof Element) || !(e.target.nextElementSibling instanceof HTMLDivElement)) {
						return;
					}
					revertSelection(e.target.nextElementSibling);
				});
			}
			const buttons: GuanxingContainer = Object.assign(ui.create.div(".buttons.popup.guanxing", event.dialog.content), { _link: i });
			buttons.addEventListener(lib.config.touchscreen ? "touchstart" : "mousedown", dragStart, true);
			event.dialog.addEventListener(lib.config.touchscreen ? "touchmove" : "mousemove", onDrag, true);
			event.dialog.addEventListener(lib.config.touchscreen ? "touchend" : "mouseup", dragEnd, true);
			buttonss.push(buttons);
			if (item[1]) {
				if (get.itemtype(item[1]) == "cards") {
					const cardsb = ui.create.buttons(item[1], "card", buttons);
					if (item[2] && typeof item[2] == "string") {
						for (const ij of cardsb) {
							if (typeof ij === "object" && ij !== null && "node" in ij && typeof ij.node === "object" && ij.node !== null && "gaintag" in ij.node && ij.node.gaintag instanceof HTMLElement) {
								ij.node.gaintag.innerHTML = get.translation(item[2]);
							}
						}
					}
				} else if (item[1].length == 2) {
					ui.create.buttons(item[1][0], item[1][1], buttons);
				}
			}
			if (item[2] && typeof item[2] == "function") {
				buttons.textPrompt = item[2];
			}
		}
		const tex = event.dialog.add('<div class="text center">点击或拖动两张牌以交换位置；点击一张牌并点击其他区域或拖动到其他区域以移动卡牌</div>');
		tex.classList.add("choosetomove");

		event.dialog.open();
		updateButtons();

		event.custom.replace.button = (button: HTMLDivElement) => {
			if (event.isPlayingAnimation) {
				return;
			}
			const node = button.parentNode;
			if (!(node instanceof HTMLDivElement) || !buttonss.includes(node)) {
				return;
			}
			toggleButton(button);
		};
		event.custom.replace.confirm = (bool: boolean) => {
			if (event.isPlayingAnimation) {
				return;
			}
			buttonss.forEach(btn => {
				for (const element of Array.from(btn.children).filter((child): child is GuanxingButton => child instanceof HTMLDivElement)) {
					if (element.copy && ui.window.contains(element.copy)) {
						ui.window.removeChild(element.copy);
						delete element.copy;
					}
				}
			});
			if (bool) {
				event._result = {
					bool: true,
					moved: event.moved,
				};
			} else {
				event._result = { bool: false };
			}
			event.dialog.close();
			if (ui.confirm) {
				ui.confirm.close();
			}
			game.resume();
			_status.imchoosing = false;
			setTimeout(() => {
				ui.arena.classList.remove("choose-to-move");
			}, 500);
			resolve(event._result);
		};

		game.pause();
		game.countChoose();
		event.choosing = true;
	});
}

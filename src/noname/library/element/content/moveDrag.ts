import { game, ui } from "noname";
export type GuanxingButton = HTMLDivElement & { copy?: HTMLDivElement };
export type GuanxingContainer = HTMLDivElement & { _link: number; textPrompt?: (cards: Card[]) => string };

export function createMoveDrag(event, clearSelected, selectButtons) {
	let touchStartX = 0;
	let touchStartY = 0;
	let elementOffsetX = 0;
	let elementOffsetY = 0;
	let currentElement: GuanxingButton | undefined;
	const dragStart = e => {
		if (event.isPlayingAnimation) {
			return;
		}
		const container = e.currentTarget;
		if (!(container instanceof HTMLElement)) {
			return;
		}
		// 左键按下
		if (e instanceof MouseEvent) {
			if (e.which != 1) {
				return;
			}
		}
		// 单个手指按下
		if (window.TouchEvent && e instanceof TouchEvent) {
			if (e.touches.length != 1) {
				return;
			}

			e = e.touches[0];
		}
		// 判断按下的元素是否是card
		const cards = Array.from(container.children).filter((element): element is GuanxingButton => element instanceof HTMLDivElement);
		const target = cards.find(
			card =>
				// Node.contains()
				e.target instanceof Node && card.contains(e.target)
		);
		if (target) {
			if (!target.copy) {
				const copy = target.cloneNode(true);
				if (!(copy instanceof HTMLDivElement)) {
					return;
				}
				copy.style.opacity = "0.75";
				copy.style.pointerEvents = "none";
				target.copy = copy;
			}
			touchStartX = e.clientX / game.documentZoom;
			touchStartY = e.clientY / game.documentZoom;
			elementOffsetX = target.getBoundingClientRect().x / game.documentZoom - touchStartX;
			elementOffsetY = target.getBoundingClientRect().y / game.documentZoom - touchStartY;
			currentElement = target;
			// e.stopPropagation();
		}
	};

	/**
	 * 判断出是否拖拽开始
	 *
	 * move事件是在button元素上监听的，而不是在dialog.content上。
	 *
	 * @param { TouchEvent | MouseEvent } e
	 */
	const onDrag = e => {
		if (event.isPlayingAnimation) {
			return;
		}
		if (e instanceof MouseEvent) {
			if (e.which != 1) {
				return;
			}
		}
		if (window.TouchEvent && e instanceof TouchEvent) {
			if (e.touches.length != 1) {
				return;
			}

			e = e.touches[0];
		}
		if (!currentElement || !currentElement.copy) {
			return;
		}

		// 获取点击位置
		const ex = e.clientX / game.documentZoom;
		const ey = e.clientY / game.documentZoom;

		// 如果是首次移动距离
		if (!document.contains(currentElement.copy)) {
			// 检查过小的移动距离，防止误触
			if (Math.abs(ex - touchStartX) < 10 && Math.abs(ey - touchStartY) < 10) {
				// 我们取消本次移动
				return;
			}
		}

		// 选中单个按钮
		clearSelected();
		selectButtons(currentElement);
		// 显示拖拽的元素
		const copy: HTMLDivElement = currentElement.copy;
		if (!ui.window.contains(copy)) {
			copy.style.position = "absolute";
			copy.style.transition = "none";
			copy.style.zIndex = "100";
			copy.css({
				boxShadow: "0px 0px 7px 2px rgba(233, 30, 77, 0.95)",
			});
			ui.window.appendChild(copy);
		}

		copy.style.left = `${ex + elementOffsetX}px`;
		copy.style.top = `${ey + elementOffsetY}px`;

		// 当拖动到对话框最上面或者最下面我们滚动内容
		const bounds = event.dialog.getBoundingClientRect();
		const relY = e.clientY - bounds.top;
		const minY = bounds.height * 0.1;
		const maxY = bounds.height * 0.9;

		if (relY < minY) {
			// 让event.dialog.content向上滚动
			event.dialog.content.parentElement.scrollTop -= 15;
		} else if (relY > maxY) {
			// 让event.dialog.content向下滚动
			event.dialog.content.parentElement.scrollTop += 15;
		}
	};

	return {
		dragStart,
		onDrag,
		resetDrag() {
			currentElement = undefined;
		},
	};
}

import { game } from "../index.js";
import type { Game } from "../index.js";

export type SwapElementStyle = {
	overflow: string;
	transition: string;
	transform: string;
	removeProperty: Function;
};

export function isSwapElementStyle(style: unknown): style is SwapElementStyle {
	return (
		typeof style == "object" &&
		style !== null &&
		"overflow" in style &&
		typeof style.overflow == "string" &&
		"transition" in style &&
		typeof style.transition == "string" &&
		"transform" in style &&
		typeof style.transform == "string" &&
		"removeProperty" in style &&
		typeof style.removeProperty == "function"
	);
}

export function getInlineStyle(element: Element): SwapElementStyle {
	const style: unknown = Reflect.get(element, "style", element);
	if (!isSwapElementStyle(style)) {
		throw new TypeError("Element must support inline styles for $swapElement");
	}
	return style;
}

/**
 * 用于保存$elementGoto的状态信息喵
 */
export function createElementGotoAnimData() {
	return {
		/**
		 * 给定元素动画的Promise的resolve函数
		 */
		animationResolver: new Map(),
		/**
		 * 给定元素的移动起始位置
		 */
		startPosition: new Map(),
		/**
		 * 给定元素的移动结束位置
		 */
		endPosition: new Map(),
		/**
		 * 给定元素的移动动画
		 */
		invertingAnimations: new Map(),
	};
}

export const elementSwapMethods = {
	/**
	 * 交换任意两个元素的位置，附带过渡动画
	 * @author Curpond
	 */
	$swapElement(this: Game, e1: HTMLDivElement, e2: HTMLDivElement, duration = 400, timefun: "linear" | "ease-in-out" = "linear"): Promise<void> {
		return new Promise((resolve, reject) => {
			const e1p = e1.parentElement;
			const e2p = e2.parentElement;
			if (!e1p || !e2p) {
				reject(new TypeError("$swapElement requires both elements to have a parent"));
				return;
			}
			const old1_overflow = getInlineStyle(e1p).overflow;
			const old2_overflow = getInlineStyle(e2p).overflow;
			const watchedElements = [...e1p.children, ...e2p.children].unique();

			const e1n = e1.nextElementSibling;
			const e2n = e2.nextElementSibling;

			//first
			const originalPosition = new Map(watchedElements.map(e => [e, e.getBoundingClientRect()]));

			//last
			e1p.insertBefore(e2, e1n);
			e2p.insertBefore(e1, e2n);
			const newPosition = new Map(watchedElements.map(e => [e, e.getBoundingClientRect()]));
			const change = new Map(
				watchedElements.map(e => {
					const orig = originalPosition.get(e);
					const newPos = newPosition.get(e);
					if (!orig || !newPos) {
						throw new TypeError("$swapElement lost a watched element position");
					}
					return [
						e,
						{
							dx: orig.x - newPos.x,
							dy: orig.y - newPos.y,
						},
					];
				})
			);

			//invert
			getInlineStyle(e1p).overflow = "visible";
			getInlineStyle(e2p).overflow = "visible";
			change.forEach(({ dx, dy }, e) => {
				const style = getInlineStyle(e);
				style.transition = `none`;
				style.transform = `translate(${dx / game.documentZoom}px, ${dy / game.documentZoom}px)`;
			});
			e1.offsetHeight;
			//play
			requestAnimationFrame(() => {
				change.forEach(({ dx, dy }, e) => {
					const style = getInlineStyle(e);
					style.transition = `${duration}ms ${timefun}`;
					style.removeProperty("transform");
				});
				const transitionEndHandler = () => {
					change.forEach(({ dx, dy }, e) => e.removeEventListener("transitionend", transitionEndHandler));
					getInlineStyle(e1p).overflow = old1_overflow;
					getInlineStyle(e2p).overflow = old2_overflow;
					resolve();
				};
				change.forEach(({ dx, dy }, e) => e.addEventListener("transitionend", transitionEndHandler, { once: true }));
			});
		});
	},
	/**
	 * 交换两个元素的位置，并附带动画
	 * 封装了game.$elementGoto函数，特化对于两个元素交换位置的情况喵
	 */
	async $elementSwap(this: Game, elementA: HTMLElement, elementB: HTMLElement, duration = 400, timefun: "linear" | "ease-in-out" = "linear"): Promise<void> {
		if (!document.contains(elementA) || !document.contains(elementB)) {
			throw new Error("元素未添加到页面喵"); // AI说话也带喵哦
		}

		const parentA = elementA.parentElement;
		const parentB = elementB.parentElement;

		if (!parentA || !parentB) {
			throw new Error("元素未添加到页面喵");
		}

		if (parentA === parentB && elementB.compareDocumentPosition(elementA) & Node.DOCUMENT_POSITION_FOLLOWING) {
			// 如果A元素是B元素的后面的元素喵
			// 此时需要特殊处理喵，是的交换顺序就好哦喵
			await game.$elementSwap(elementB, elementA, duration, timefun);
		} else {
			// 否则我们直接入队交换就好哦喵
			await Promise.all([game.$elementGoto(elementA, parentB, elementB.nextElementSibling || "last", duration, timefun), game.$elementGoto(elementB, parentA, elementA.nextElementSibling || "last", duration, timefun)]);
		}
	},
};

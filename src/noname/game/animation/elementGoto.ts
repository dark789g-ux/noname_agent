import { game } from "../index.js";
import type { Game } from "../index.js";

export const elementGotoMethods = {
	/**
	 * 带动画的将元素移动到某个父元素的某个位置喵
	 * 允许元素附带变换（位移旋转什么的都可以），甚至本身还处于上一次$elementGoto的动画中也可以喵（不过我没测试哦）
	 *
	 * @author Curpond
	 */
	async $elementGoto(this: Game, element: HTMLElement, parent: HTMLElement, position: number | "first" | "last" | Node = "last", duration = 500, timefun: "linear" | "ease-in-out" = "linear"): Promise<void> {
		if (!document.contains(element) || !document.contains(parent)) {
			throw new Error("无效的参数或者元素没有添加到页面喵");
		}

		/**
		 * 从element的transform字符串中解析位移喵
		 */
		function parseTranslate(element: HTMLElement): [number, number] {
			const matrix = getComputedStyle(element).transform;

			if (matrix.startsWith("matrix(")) {
				// @ts-expect-error 样式计算结果给出的值一定包含x与y喵
				return matrix.slice(7, -1).split(",").slice(4, 6).map(Number);
			} else if (matrix.startsWith("matrix3d(")) {
				// @ts-expect-error 样式计算结果给出的值一定包含x与y喵
				return matrix.slice(9, -1).split(",").slice(12, 14).map(Number);
			} else {
				return [0, 0];
			}
		}

		function getScaledBound(element: HTMLElement) {
			let { x, y, width, height } = element.getBoundingClientRect();
			x /= game.documentZoom;
			y /= game.documentZoom;
			width /= game.documentZoom;
			height /= game.documentZoom;
			return { x, y, width, height };
		}

		/**
		 * 计算element当前的位置喵
		 * 包括变换效果和动画效果当前的位置哦喵
		 */
		function getCurrentPosition(element: HTMLElement): [number, number] {
			const { x, y } = getScaledBound(element);
			const animation = game.$elementGotoAnimData.invertingAnimations.get(element);

			if (animation) {
				let fx, fy;

				if (animation.actualVisual) {
					animation.commitStyles();
					animation.cancel();
					[fx, fy] = parseTranslate(element);
				} else {
					const oldTransform = element.style.transform;
					animation.commitStyles();
					animation.cancel();
					[fx, fy] = parseTranslate(element);
					element.style.transform = oldTransform;
				}

				return [x + fx, y + fy];
			}

			const [tx, ty] = parseTranslate(element);
			return [x + tx, y + ty];
		}

		function recordAsFirstPosition(element: HTMLElement) {
			const startPosition = game.$elementGotoAnimData.startPosition;

			if (startPosition.has(element)) {
				return;
			}

			const position = getCurrentPosition(element);
			startPosition.set(element, position);
		}

		function recordAsLastPosition(element: HTMLElement) {
			const position = getCurrentPosition(element);
			game.$elementGotoAnimData.endPosition.set(element, position);
		}

		function updateDOM() {
			if (position === "first") {
				parent.insertBefore(element, parent.firstChild);
			} else if (position === "last") {
				parent.appendChild(element);
			} else if (typeof position == "number") {
				parent.insertBefore(element, parent.children[position]);
			} else if (parent.contains(position)) {
				parent.insertBefore(element, position);
			} else {
				parent.appendChild(element);
			}
		}

		const parentFrom = element.parentElement;
		const parentTo = parent;

		if (!parentFrom) {
			throw new Error("要移动的元素没有父元素");
		}

		if (parentFrom === parentTo) {
			let notMoved = false;

			if (position === "first") {
				notMoved = parentTo.firstChild === element;
			} else if (position === "last") {
				notMoved = parentTo.lastChild === element;
			} else if (typeof position == "number") {
				notMoved = parentTo.childNodes[position] === element;
			} else if (parent.contains(position)) {
				notMoved = position === element;
			} else {
				notMoved = parentTo.lastChild === element;
			}

			if (notMoved) {
				return Promise.resolve();
			}
		}

		if (duration == 0) {
			updateDOM();
			return Promise.resolve();
		}

		const elements = new Set(parentFrom.childNodes).union(new Set(parentTo.childNodes));

		for (const element of elements) {
			if (element instanceof HTMLElement) {
				recordAsFirstPosition(element);
			}
		}

		await new Promise(resolve => resolve(null));

		updateDOM();

		await new Promise(resolve => resolve(null));

		const elements2 = new Set(parentFrom.childNodes).union(new Set(parentTo.childNodes));

		for (const element of elements2) {
			if (element instanceof HTMLElement) {
				recordAsLastPosition(element);
			}
		}

		function getAnimationPosition(element: HTMLElement): [number, number, number, number] | null {
			const start = game.$elementGotoAnimData.startPosition.get(element);
			const end = game.$elementGotoAnimData.endPosition.get(element);
			game.$elementGotoAnimData.startPosition.delete(element);
			game.$elementGotoAnimData.endPosition.delete(element);

			if (!start || !end) {
				return null;
			}

			const [sx, sy] = start;
			const [ex, ey] = end;

			if (Math.abs(sx - ex) < 2 && Math.abs(sy - ey) < 2) {
				return null;
			}

			return [sx, sy, ex, ey];
		}

		function cloneVisualElement(element: HTMLElement): [HTMLElement, HTMLElement] {
			if (!document.body.contains(element) || document.body === element) {
				throw new Error("被复制的节点必须是body的子元素喵");
			}

			// @ts-expect-error 忽略类型检查喵
			const clone: HTMLElement = element.cloneNode(true);
			clone.classList.add("visual-subject");
			let current = clone;
			let target = element.parentElement;

			if (!target) {
				throw new Error("impossible");
			}

			while (!target.id && target !== document.body) {
				// @ts-expect-error 忽略类型检查喵
				const clonedTarget: HTMLElement = target.cloneNode(false);
				clonedTarget.classList.add("cloned-visual");
				clonedTarget.appendChild(current);
				current = clonedTarget;
				target = target.parentElement;

				if (!target) {
					throw new Error("impossible");
				}
			}

			target.appendChild(current);
			return [clone, current];
		}

		function emitAllPendingAnimations() {
			const elements = game.$elementGotoAnimData.startPosition.keys();

			for (const element of elements) {
				const position = getAnimationPosition(element);
				const parent = element.parentElement;

				if (!position || !parent) {
					continue;
				}

				const [sx, sy, ex, ey] = position;
				const canOverflow = getComputedStyle(parent).overflow === "visible";
				let animation: Animation;

				if (canOverflow) {
					const invertingX = sx - ex;
					const invertingY = sy - ey;

					animation = element.animate(
						[
							{
								transform: `translate(${invertingX}px, ${invertingY}px)`,
							},
							{
								transform: `translate(0px, 0px)`,
							},
						],
						{
							duration: duration,
							easing: timefun,
							composite: "accumulate",
						}
					);
				} else {
					const [subject, stage] = cloneVisualElement(element);
					const bounds = getScaledBound(subject);
					const startX = sx - bounds.x;
					const startY = sy - bounds.y;
					const endX = ex - bounds.x;
					const endY = ey - bounds.y;

					element.classList.add("facade-replacing");

					animation = subject.animate(
						[
							{
								transform: `translate(${startX}px, ${startY}px)`,
							},
							{
								transform: `translate(${endX}px, ${endY}px)`,
							},
						],
						{
							duration: duration,
							easing: timefun,
							composite: "accumulate",
							fill: "forwards",
						}
					);
					// @ts-expect-error 我们需要给Animation添加一个属性喵
					animation.actualVisual = subject;

					function onAnimationEnd() {
						element.classList.remove("facade-replacing");
						stage.remove();
					}

					animation.addEventListener("finish", onAnimationEnd);
					animation.addEventListener("cancel", onAnimationEnd);
				}

				animation.persist();

				const resolve = game.$elementGotoAnimData.animationResolver.get(element);

				if (resolve) {
					game.$elementGotoAnimData.animationResolver.delete(element);
				}

				function onAnimationEnd() {
					if (typeof resolve == "function") {
						resolve();
					}

					game.$elementGotoAnimData.invertingAnimations.delete(element);
				}

				animation.addEventListener("finish", onAnimationEnd);
				animation.addEventListener("cancel", onAnimationEnd);

				game.$elementGotoAnimData.invertingAnimations.set(element, animation);
			}
		}

		const { promise, resolve } = Promise.withResolvers<void>();
		game.$elementGotoAnimData.animationResolver.set(element, resolve);
		requestAnimationFrame(emitAllPendingAnimations);
		await promise;
	},
};

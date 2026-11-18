import { game } from "../index.js";
const elementGotoMethods = {
  /**
   * 带动画的将元素移动到某个父元素的某个位置喵
   * 允许元素附带变换（位移旋转什么的都可以），甚至本身还处于上一次$elementGoto的动画中也可以喵（不过我没测试哦）
   *
   * @author Curpond
   */
  async $elementGoto(element, parent, position = "last", duration = 500, timefun = "linear") {
    if (!document.contains(element) || !document.contains(parent)) {
      throw new Error("无效的参数或者元素没有添加到页面喵");
    }
    function parseTranslate(element2) {
      const matrix = getComputedStyle(element2).transform;
      if (matrix.startsWith("matrix(")) {
        return matrix.slice(7, -1).split(",").slice(4, 6).map(Number);
      } else if (matrix.startsWith("matrix3d(")) {
        return matrix.slice(9, -1).split(",").slice(12, 14).map(Number);
      } else {
        return [0, 0];
      }
    }
    function getScaledBound(element2) {
      let { x, y, width, height } = element2.getBoundingClientRect();
      x /= game.documentZoom;
      y /= game.documentZoom;
      width /= game.documentZoom;
      height /= game.documentZoom;
      return { x, y, width, height };
    }
    function getCurrentPosition(element2) {
      const { x, y } = getScaledBound(element2);
      const animation = game.$elementGotoAnimData.invertingAnimations.get(element2);
      if (animation) {
        let fx, fy;
        if (animation.actualVisual) {
          animation.commitStyles();
          animation.cancel();
          [fx, fy] = parseTranslate(element2);
        } else {
          const oldTransform = element2.style.transform;
          animation.commitStyles();
          animation.cancel();
          [fx, fy] = parseTranslate(element2);
          element2.style.transform = oldTransform;
        }
        return [x + fx, y + fy];
      }
      const [tx, ty] = parseTranslate(element2);
      return [x + tx, y + ty];
    }
    function recordAsFirstPosition(element2) {
      const startPosition = game.$elementGotoAnimData.startPosition;
      if (startPosition.has(element2)) {
        return;
      }
      const position2 = getCurrentPosition(element2);
      startPosition.set(element2, position2);
    }
    function recordAsLastPosition(element2) {
      const position2 = getCurrentPosition(element2);
      game.$elementGotoAnimData.endPosition.set(element2, position2);
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
    for (const element2 of elements) {
      if (element2 instanceof HTMLElement) {
        recordAsFirstPosition(element2);
      }
    }
    await new Promise((resolve2) => resolve2(null));
    updateDOM();
    await new Promise((resolve2) => resolve2(null));
    const elements2 = new Set(parentFrom.childNodes).union(new Set(parentTo.childNodes));
    for (const element2 of elements2) {
      if (element2 instanceof HTMLElement) {
        recordAsLastPosition(element2);
      }
    }
    function getAnimationPosition(element2) {
      const start = game.$elementGotoAnimData.startPosition.get(element2);
      const end = game.$elementGotoAnimData.endPosition.get(element2);
      game.$elementGotoAnimData.startPosition.delete(element2);
      game.$elementGotoAnimData.endPosition.delete(element2);
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
    function cloneVisualElement(element2) {
      if (!document.body.contains(element2) || document.body === element2) {
        throw new Error("被复制的节点必须是body的子元素喵");
      }
      const clone = element2.cloneNode(true);
      clone.classList.add("visual-subject");
      let current = clone;
      let target = element2.parentElement;
      if (!target) {
        throw new Error("impossible");
      }
      while (!target.id && target !== document.body) {
        const clonedTarget = target.cloneNode(false);
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
      const elements3 = game.$elementGotoAnimData.startPosition.keys();
      for (const element2 of elements3) {
        let onAnimationEnd = function() {
          if (typeof resolve2 == "function") {
            resolve2();
          }
          game.$elementGotoAnimData.invertingAnimations.delete(element2);
        };
        const position2 = getAnimationPosition(element2);
        const parent2 = element2.parentElement;
        if (!position2 || !parent2) {
          continue;
        }
        const [sx, sy, ex, ey] = position2;
        const canOverflow = getComputedStyle(parent2).overflow === "visible";
        let animation;
        if (canOverflow) {
          const invertingX = sx - ex;
          const invertingY = sy - ey;
          animation = element2.animate(
            [
              {
                transform: `translate(${invertingX}px, ${invertingY}px)`
              },
              {
                transform: `translate(0px, 0px)`
              }
            ],
            {
              duration,
              easing: timefun,
              composite: "accumulate"
            }
          );
        } else {
          let onAnimationEnd2 = function() {
            element2.classList.remove("facade-replacing");
            stage.remove();
          };
          const [subject, stage] = cloneVisualElement(element2);
          const bounds = getScaledBound(subject);
          const startX = sx - bounds.x;
          const startY = sy - bounds.y;
          const endX = ex - bounds.x;
          const endY = ey - bounds.y;
          element2.classList.add("facade-replacing");
          animation = subject.animate(
            [
              {
                transform: `translate(${startX}px, ${startY}px)`
              },
              {
                transform: `translate(${endX}px, ${endY}px)`
              }
            ],
            {
              duration,
              easing: timefun,
              composite: "accumulate",
              fill: "forwards"
            }
          );
          animation.actualVisual = subject;
          animation.addEventListener("finish", onAnimationEnd2);
          animation.addEventListener("cancel", onAnimationEnd2);
        }
        animation.persist();
        const resolve2 = game.$elementGotoAnimData.animationResolver.get(element2);
        if (resolve2) {
          game.$elementGotoAnimData.animationResolver.delete(element2);
        }
        animation.addEventListener("finish", onAnimationEnd);
        animation.addEventListener("cancel", onAnimationEnd);
        game.$elementGotoAnimData.invertingAnimations.set(element2, animation);
      }
    }
    const { promise, resolve } = Promise.withResolvers();
    game.$elementGotoAnimData.animationResolver.set(element, resolve);
    requestAnimationFrame(emitAllPendingAnimations);
    await promise;
  }
};
export {
  elementGotoMethods
};

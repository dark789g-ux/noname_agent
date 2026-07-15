import { get, ui } from "noname";
import { popupContainer } from "../index";

/**
 * openPopup —— 1:1 迁移旧版 openMenu（menu/index.js:3-38）。
 *
 * 将 menuEl 挂到全局 popupContainer 上，执行定位算法，显示弹出菜单。
 *
 * @param menuEl   .menu 节点（会被 appendChild 到 popupContainer）
 * @param clientX  鼠标点击的 clientX 坐标
 * @param clientY  鼠标点击的 clientY 坐标
 * @param onclose  关闭回调（popupContainer.onclose）
 */
export function openPopup(
	menuEl: HTMLElement,
	clientX: number,
	clientY: number,
	onclose?: () => void,
) {
	if (!popupContainer) return;

	// popupContainer.innerHTML = "" —— 清除旧菜单内容
	popupContainer.innerHTML = "";

	let left = Math.round(clientX / get.menuZoom());
	let zoom = get.is.phoneLayout() ? 1.3 : 1;
	popupContainer.appendChild(menuEl);

	// visual 分支：遍历子节点调用 update()
	if (menuEl.classList.contains("visual")) {
		for (let i = 0; i < menuEl.childElementCount; i++) {
			// @ts-expect-error update 是运行时挂在子节点上的自定义属性
			if (menuEl.childNodes[i].update) {
				// @ts-expect-error update 是运行时挂在子节点上的自定义属性
				menuEl.childNodes[i].update();
			}
		}
	}

	// 定位算法
	let height = menuEl.offsetHeight;
	let idealtop = clientY / get.menuZoom();
	if (idealtop < 10) {
		idealtop = 10;
	} else if ((idealtop + height) * zoom + 10 > ui.window.offsetHeight) {
		idealtop = (ui.window.offsetHeight - 10) / zoom - height;
	}
	menuEl.style.top = idealtop + "px";
	menuEl.style.left = left + "px";

	popupContainer.classList.remove("hidden");
	// @ts-expect-error onclose 是运行时挂在 popupContainer 上的自定义属性
	popupContainer.onclose = onclose;
}

/**
 * closePopup —— 1:1 迁移旧版 closeMenu（index.js:439-451）。
 *
 * 关闭弹出菜单，含 noclose 一次性保护。
 */
export function closePopup() {
	if (!popupContainer) return;

	// @ts-expect-error noclose 是运行时挂在 popupContainer 上的自定义属性
	if (popupContainer.noclose) {
		// @ts-expect-error noclose 是运行时挂在 popupContainer 上的自定义属性
		popupContainer.noclose = false;
		return;
	}
	popupContainer.classList.add("hidden");
	if (typeof popupContainer.onclose == "function") {
		// @ts-expect-error onclose 是运行时挂在 popupContainer 上的自定义属性
		popupContainer.onclose();
	}
}

/**
 * setNoclose —— 设置 noclose 一次性保护（visualBar 用）。
 *
 * 旧版 visualBar onclick 中：this.parentNode.parentNode.noclose = true
 * Vue 版中 PopupMenu.vue 的 visualBar click 处理调用此函数。
 */
export function setNoclose() {
	if (!popupContainer) return;
	// @ts-expect-error noclose 是运行时挂在 popupContainer 上的自定义属性
	popupContainer.noclose = true;
}

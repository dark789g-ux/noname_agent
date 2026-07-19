import { lib, ui, _status } from "noname";
import { createApp } from "vue";
import LLMPlayerLogPanel from "@/ui/create/menu/vue/components/editors/LLMPlayerLogPanel.vue";

interface PlayerLike {
	getName(): string;
	getSeatNum(): number;
}

/**
 * 打开某 AI 武将的 LLM 日志面板。
 * 在游戏画面上弹出一个 Dialog，挂载 LLMPlayerLogPanel 组件。
 *
 * 关键点：
 * 1. Dialog 关闭时必须 app.unmount()，否则组件订阅的 lib.announce 事件不会清理 → 内存泄漏
 * 2. 本文件由 player.js 的 click handler 通过动态 import 调用（避免循环依赖 TDZ）
 */
export function openLLMPlayerLog(player: PlayerLike): void {
	const gameId = (_status as { llmGameId?: string }).llmGameId;
	if (!gameId) {
		return;
	}

	const seatNum = player.getSeatNum();
	const playerName = player.getName();

	const dialog = ui.create.dialog(`${playerName} [座位${seatNum}] 的 LLM 思考`, [
		[
			(dlg: any) => {
				const container = ui.create.div(".llm-player-log-container", dlg.content);
				const app = createApp(LLMPlayerLogPanel, {
					playerSeatNum: seatNum,
					gameId,
					playerName,
				});
				app.mount(container);
				(dlg as any)._llmApp = app;
				(dlg as any)._llmContainer = container;
			},
			"handle",
		],
	]);

	// 加自定义类以应用专属样式（深色背景、相对尺寸 80%、居中、左对齐）
	dialog.classList.add("llm-log-dialog");

	// 添加关闭按钮（参考 ui.click.count 模式，index.js:4769-4774）
	const closeButton = ui.create.div(".close-btn");
	closeButton.textContent = "关闭";
	dialog.appendChild(closeButton);
	closeButton.onclick = function () {
		dialog.close();
	};

	const origClose = dialog.close.bind(dialog);
	dialog.close = function (this: any) {
		const dlg = this;
		if (dlg._llmApp) {
			try {
				dlg._llmApp.unmount();
			} catch (_e) {
				/* unmount 失败不阻断 close */
			}
			dlg._llmApp = null;
		}
		if (dlg._llmContainer) {
			try {
				dlg._llmContainer.remove();
			} catch (_e) {
				/* 移除失败不阻断 close */
			}
			dlg._llmContainer = null;
		}
		return origClose();
	};
}

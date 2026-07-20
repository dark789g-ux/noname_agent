import { lib, ui, _status } from "noname";
import { createApp } from "vue";
import LLMPlayerLogPanel from "@/ui/create/menu/vue/components/editors/LLMPlayerLogPanel.vue";

interface PlayerLike {
	getName(): string;
	getSeatNum(): number;
}

let activeDialog: { player: PlayerLike; dialog: { close(): unknown } } | undefined;

/**
 * 打开某 AI 武将的 LLM 日志面板。
 * 在游戏画面上弹出一个 Dialog，挂载 LLMPlayerLogPanel 组件。
 *
 * 关键点：
 * 1. Dialog 关闭时必须 app.unmount()，否则组件订阅的 lib.announce 事件不会清理 → 内存泄漏
 * 2. 本文件由 player.js 的 click handler 通过动态 import 调用（避免循环依赖 TDZ）
 */
export function openLLMPlayerLog(player: PlayerLike): void {
	if (activeDialog) {
		if (activeDialog.player === player) {
			activeDialog.dialog.close();
			return;
		}
		activeDialog.dialog.close();
	}

	const gameId = (_status as { llmGameId?: string }).llmGameId || "game_unknown";

	const seatNum = player.getSeatNum();
	const playerName = player.getName();

	const dialog = ui.create.dialog(`${playerName} [座位${seatNum}] 的 LLM 思考`, "hidden");

	// 先完成专属布局配置和组件挂载，再显式打开，避免 ui.update() 按空内容压缩 Dialog。
	dialog.classList.add("llm-log-dialog", "noupdate");
	const container = ui.create.div(".llm-player-log-container", dialog.content);
	const app = createApp(LLMPlayerLogPanel, {
		playerSeatNum: seatNum,
		gameId,
		playerName,
	});
	const origClose = dialog.close.bind(dialog);
	let closed = false;
	dialog.close = function () {
		if (closed) {
			return dialog;
		}
		closed = true;
		try {
			try {
				app.unmount();
			} catch (_e) {
				/* unmount 失败不阻断 close */
			}
			try {
				container.remove();
			} catch (_e) {
				/* 移除失败不阻断 close */
			}
			if (activeDialog?.dialog === dialog) {
				activeDialog = undefined;
			}
		} finally {
			origClose();
		}
		return dialog;
	};

	try {
		app.mount(container);
	} catch (error) {
		dialog.close();
		throw error;
	}

	// 添加关闭按钮（参考 ui.click.count 模式，index.js:4769-4774）
	const closeButton = ui.create.div(".close-btn");
	closeButton.textContent = "关闭";
	dialog.appendChild(closeButton);
	closeButton.onclick = function () {
		dialog.close();
	};

	activeDialog = { player, dialog };
	try {
		dialog.open();
	} catch (error) {
		dialog.close();
		throw error;
	}
}

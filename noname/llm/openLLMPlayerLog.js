import "../../noname.js";
import { createApp } from "vue";
import LLMPlayerLogPanel from "../ui/create/llmLog/vue/LLMPlayerLogPanel.vue.js";
import { resolvePlayerSeatIndex } from "./backends.js";
import { _status } from "../status/index.js";
import { ui } from "../ui/index.js";
let activeDialog;
function openLLMPlayerLog(player) {
  if (activeDialog) {
    if (activeDialog.player === player) {
      activeDialog.dialog.close();
      return;
    }
    activeDialog.dialog.close();
  }
  const gameId = _status.llmGameId || "game_unknown";
  const seatNum = resolvePlayerSeatIndex(player, _status);
  const playerName = player.getName();
  const dialog = ui.create.dialog(`${playerName} [座位${seatNum}] 的 LLM 思考`, "hidden");
  dialog.classList.add("llm-log-dialog", "noupdate");
  const container = ui.create.div(".llm-player-log-container", dialog.content);
  const app = createApp(LLMPlayerLogPanel, {
    playerSeatNum: seatNum,
    gameId,
    playerName
  });
  const origClose = dialog.close.bind(dialog);
  let closed = false;
  dialog.close = function() {
    if (closed) {
      return dialog;
    }
    closed = true;
    try {
      try {
        app.unmount();
      } catch (_e) {
      }
      try {
        container.remove();
      } catch (_e) {
      }
      if (activeDialog?.dialog === dialog) {
        activeDialog = void 0;
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
  const closeButton = ui.create.div(".close-btn");
  closeButton.textContent = "关闭";
  dialog.appendChild(closeButton);
  closeButton.onclick = function() {
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
export {
  openLLMPlayerLog
};

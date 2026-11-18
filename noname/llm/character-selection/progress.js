import { reactive, createApp } from "vue";
import OpeningProgress from "./OpeningProgress.vue.js";
let savedOffset = { x: 0, y: 0 };
function resetOpeningProgressOffset() {
  savedOffset = { x: 0, y: 0 };
}
function createOpeningProgress(state, total, parent) {
  const host = document.createElement("div");
  host.style.display = "contents";
  parent.appendChild(host);
  const viewState = reactive({
    completed: state.completed,
    total,
    elapsedSec: 0,
    waitingText: "",
    fallbacks: state.fallbacks,
    skipped: state.skipped,
    offsetX: savedOffset.x,
    offsetY: savedOffset.y
  });
  const started = Date.now();
  function update() {
    viewState.completed = state.completed;
    viewState.total = total;
    viewState.elapsedSec = Math.floor((Date.now() - started) / 1e3);
    viewState.waitingText = [...state.active.keys()].map((seat) => `${seat}号位`).join("、");
    viewState.fallbacks = state.fallbacks;
    viewState.skipped = state.skipped;
  }
  update();
  const canMountVue = typeof document.createComment === "function" && typeof document.createTextNode === "function";
  const app = canMountVue ? createApp(OpeningProgress, {
    state: viewState,
    onSkip() {
      state.skip();
      update();
    },
    "onUpdate:offset"(offset) {
      savedOffset = { x: offset.x, y: offset.y };
      viewState.offsetX = offset.x;
      viewState.offsetY = offset.y;
    }
  }) : null;
  app?.mount(host);
  const timer = setInterval(update, 250);
  let closed = false;
  return {
    update,
    close() {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      app?.unmount();
      host.remove();
    }
  };
}
export {
  createOpeningProgress,
  resetOpeningProgressOffset
};

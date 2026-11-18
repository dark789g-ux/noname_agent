let url = new URL(/* @vite-ignore */"./", import.meta.url);
if (!url.href.endsWith("/")) {
    url = new URL(url.href + "/");
}
export const rootURL = url;

export { AI, ai, setAI } from "./noname/ai/index.js";
export { Game, game, setGame } from "./noname/game/index.js";
export { Get, get, setGet } from "./noname/get/index.js";
export { Library, lib, setLibrary } from "./noname/library/index.js";
export { status, _status, setStatus } from "./noname/status/index.js";
export { UI, ui, setUI } from "./noname/ui/index.js";
// 模式独立构建时通过公共入口复用服务，避免打包出第二份 LLM 日志/会话单例。
export { createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "./noname/llm/character-selection/identity.js";

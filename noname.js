import { AI, ai, setAI } from "./noname/ai/index.js";
import { Game, game, setGame } from "./noname/game/index.js";
import "./noname/get/index.js";
import { Library, lib, setLibrary } from "./noname/library/index.js";
import { _status, setStatus, status } from "./noname/status/index.js";
import { UI, setUI, ui } from "./noname/ui/index.js";
import { createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "./noname/llm/character-selection/identity.js";
import { Get } from "./noname/get/Get.js";
import { get } from "./noname/get/binding.js";
import { setGet } from "./noname/get/runtime.js";
let url = new URL(
  /* @vite-ignore */
  "./",
  import.meta.url
);
if (!url.href.endsWith("/")) {
  url = new URL(url.href + "/");
}
const rootURL = url;
export {
  AI,
  Game,
  Get,
  Library,
  UI,
  _status,
  ai,
  createIdentityOpening,
  game,
  get,
  lib,
  rootURL,
  selectOpeningMonarch,
  selectOpeningSelf,
  selectRemainingOpening,
  setAI,
  setGame,
  setGet,
  setLibrary,
  setStatus,
  setUI,
  status,
  ui
};

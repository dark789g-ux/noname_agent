import { Announce } from "../announce/index.js";
function createAnnounce() {
  return new Announce(new EventTarget(), /* @__PURE__ */ new WeakMap());
}
export {
  createAnnounce
};

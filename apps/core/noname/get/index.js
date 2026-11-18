// Stable public entry point; implementation and contracts live in TS modules.
export { Get } from "./Get.js";
export { get, setGet } from "./runtime.js";
export { Is } from "./is.js";
export { Promises } from "./promises";
/** @typedef {import("./contracts/types.js").CardInfoTuple} CardInfoTuple */
/** @typedef {import("./contracts/types.js").YingbianCard} YingbianCard */
/** @typedef {import("./contracts/types.js").GameEventParentFallback} GameEventParentFallback */
/** @typedef {import("./contracts/types.js").OwnerQueryCard} OwnerQueryCard */
/** @typedef {import("./contracts/types.js").RuntimeRowItemOption} RuntimeRowItemOption */

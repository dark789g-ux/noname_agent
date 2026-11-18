import type { Get } from "./Get.js";

/** One live binding, shared by all method groups and the public facade. */
export let get: Get;

export function replaceGet(instance: Get): void {
	get = instance;
}

import { Announce } from "@/library/announce/index.js";

export function createAnnounce() {
	return new Announce(new EventTarget(), new WeakMap());
}

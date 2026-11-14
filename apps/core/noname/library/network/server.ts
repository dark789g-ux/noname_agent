import { createMessageServerHandshake } from "./server/handshake.js";
import { createMessageServerRoom } from "./server/room.js";
export function createMessageServer() {
	return {
		...createMessageServerHandshake(),
		...createMessageServerRoom(),
	};
}

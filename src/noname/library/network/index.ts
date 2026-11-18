import { createMessageServer } from "./server.js";
import { createMessageClient } from "./client.js";
export function createMessage() {
	return {
		server: createMessageServer(),
		client: createMessageClient(),
	};
}

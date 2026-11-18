import { createMessageServer } from "./server.js";
import { createMessageClient } from "./client.js";
function createMessage() {
  return {
    server: createMessageServer(),
    client: createMessageClient()
  };
}
export {
  createMessage
};

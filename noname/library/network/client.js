import { createMessageClientConnection } from "./client/connection.js";
import { createMessageClientLobby } from "./client/lobby.js";
import { createMessageClientReconnect } from "./client/reconnect.js";
import { createMessageClientInitialization } from "./client/initialization.js";
function createMessageClient() {
  return {
    ...createMessageClientConnection(),
    ...createMessageClientLobby(),
    ...createMessageClientReconnect(),
    ...createMessageClientInitialization()
  };
}
export {
  createMessageClient
};

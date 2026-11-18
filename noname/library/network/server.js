import { createMessageServerHandshake } from "./server/handshake.js";
import { createMessageServerRoom } from "./server/room.js";
function createMessageServer() {
  return {
    ...createMessageServerHandshake(),
    ...createMessageServerRoom()
  };
}
export {
  createMessageServer
};

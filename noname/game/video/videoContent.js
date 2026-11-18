import { createVideoContentInitAndChess } from "./videoContentInitAndChess.js";
import { createVideoContentPlayerState } from "./videoContentPlayerState.js";
import { createVideoContentCardCreate } from "./videoContentCardCreate.js";
import { createVideoContentCardMove } from "./videoContentCardMove.js";
import { createVideoContentMarkAndPhase } from "./videoContentMarkAndPhase.js";
function createVideoContent() {
  return {
    ...createVideoContentInitAndChess(),
    ...createVideoContentPlayerState(),
    ...createVideoContentCardCreate(),
    ...createVideoContentCardMove(),
    ...createVideoContentMarkAndPhase()
  };
}
export {
  createVideoContent
};

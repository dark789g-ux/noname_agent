import { createVersusVisibilityOptions } from "./config/visibility.js";
import { createVersusTeamsOptions } from "./config/teams.js";
function createModeVersusConfig() {
  return {
    ...createVersusVisibilityOptions(),
    ...createVersusTeamsOptions()
  };
}
export {
  createModeVersusConfig
};

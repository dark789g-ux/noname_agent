import { createModeVersusConnect } from "./versus/connect.js";
import { createModeVersusConfig } from "./versus/config.js";
function createModeVersus() {
  return {
    name: "对决",
    connect: createModeVersusConnect(),
    config: createModeVersusConfig()
  };
}
export {
  createModeVersus
};

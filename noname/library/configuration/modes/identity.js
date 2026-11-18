import { createModeIdentityConnect } from "./identity/connect.js";
import { createModeIdentityConfig } from "./identity/config.js";
function createModeIdentity() {
  return {
    name: "身份",
    connect: createModeIdentityConnect(),
    config: createModeIdentityConfig()
  };
}
export {
  createModeIdentity
};

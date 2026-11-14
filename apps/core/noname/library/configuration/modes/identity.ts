import { createModeIdentityConnect } from "./identity/connect.js";
import { createModeIdentityConfig } from "./identity/config.js";
export function createModeIdentity() {
	return {
		name: "身份",
		connect: createModeIdentityConnect(),
		config: createModeIdentityConfig(),
	};
}

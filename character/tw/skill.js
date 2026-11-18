import { part01Skills } from "./skills/part01/index.js";
import { part02Skills } from "./skills/part02/index.js";
import { part03Skills } from "./skills/part03/index.js";

/** @type { importCharacterConfig["skill"] } */
const skills = {
	...part01Skills,
	...part02Skills,
	...part03Skills,
};

export default skills;

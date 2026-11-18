import { createModeIdentity } from "./identity.js";
import { createModeGuozhan } from "./guozhan.js";
import { createModeVersus } from "./versus.js";
import { createModeConnect } from "./connect.js";
import { createModeBoss } from "./boss.js";
import { createModeDoudizhu } from "./doudizhu.js";
import { createModeSingle } from "./single.js";
import { createModeChess } from "./chess.js";
import { createModeTafang } from "./tafang.js";
import { createModeBrawl } from "./brawl.js";
import { createModeStone } from "./stone.js";
export function createMode() {
	return {
		identity: createModeIdentity(),
		guozhan: createModeGuozhan(),
		versus: createModeVersus(),
		connect: createModeConnect(),
		boss: createModeBoss(),
		doudizhu: createModeDoudizhu(),
		single: createModeSingle(),
		chess: createModeChess(),
		tafang: createModeTafang(),
		brawl: createModeBrawl(),
		stone: createModeStone(),
	};
}

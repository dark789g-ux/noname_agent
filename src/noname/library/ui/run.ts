/* eslint-disable no-var -- 保留原实现的函数作用域及 arguments 协议。 */
import { lib } from "noname";

export function run(time) {
	lib.status.time = time;
	for (var i = 0; i < lib.updates.length; i++) {
		if (!("_time" in lib.updates[i])) {
			lib.updates[i]._time = time;
		}
		if (lib.updates[i](time - lib.updates[i]._time - lib.status.delayed) === false) {
			lib.updates.splice(i--, 1);
		}
	}
	if (lib.updates.length) {
		lib.status.frameId = requestAnimationFrame(lib.run);
	} else {
		lib.status.time = 0;
		lib.status.delayed = 0;
	}
}

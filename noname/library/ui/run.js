import "../../../noname.js";
import { lib } from "../index.js";
function run(time) {
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
export {
  run
};

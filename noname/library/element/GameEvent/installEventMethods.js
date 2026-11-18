function installEventMethods(prototype, groups) {
  const descriptors = Object.getOwnPropertyDescriptors(prototype);
  for (const group of groups) {
    for (const key of Reflect.ownKeys(group)) {
      const descriptor = Object.getOwnPropertyDescriptor(group, key);
      if (!descriptor) throw new Error(`Missing event method ${String(key)}`);
      descriptors[key] = { ...descriptor, enumerable: false };
    }
  }
  const order = ["constructor", Symbol.toStringTag, "set", "setRaw", "setContent", "then", "catch", "finally", "forResult", "getParent", "insert", "insertAfter", "getTrigger", "resolve", "start", "loop", "checkSkipped", "waitNext", "addTrigger", "removeTrigger", "trigger", "untrigger", "finish", "cancel", "neutralize", "unneutralize", "step", "updateStep", "goto", "redo", "backup", "restore", "getPlayer", "getPlayers", "getTarget", "getTargets", "changeToZero", "setHiddenSkill", "getLogv", "send", "sendAsync", "getRand", "isMine", "isOnline", "notLink", "isPhaseUsing", "callHandler", "getDefaultHandlerType", "getDefaultNextHandlerType", "getHandler", "hasHandler", "pushHandler", "pushHandlersFrom", "putStepCache", "getStepCache", "clearStepCache", "callFuncUseStepCache", "putTempCache", "getTempCache", "resume"];
  for (const key of order) {
    if (!descriptors[key]) throw new Error(`Missing event method ${String(key)}`);
    if (Object.hasOwn(prototype, key)) Reflect.deleteProperty(prototype, key);
  }
  for (const key of order) Object.defineProperty(prototype, key, descriptors[key]);
}
export {
  installEventMethods
};

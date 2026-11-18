function installPlayerMethods(prototype, groups) {
  const seen = /* @__PURE__ */ new Set();
  for (const group of groups) {
    for (const key of Reflect.ownKeys(group)) {
      if (seen.has(key) || Object.hasOwn(prototype, key)) {
        throw new Error(`Duplicate Player prototype member: ${String(key)}`);
      }
      const descriptor = Object.getOwnPropertyDescriptor(group, key);
      if (!descriptor) {
        throw new Error(`Missing descriptor for Player member: ${String(key)}`);
      }
      seen.add(key);
      Object.defineProperty(prototype, key, { ...descriptor, enumerable: false });
    }
  }
}
export {
  installPlayerMethods
};

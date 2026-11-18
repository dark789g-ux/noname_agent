function createCharacterSort() {
  return new Proxy(
    {},
    {
      get(target, prop, receiver) {
        if (typeof prop == "string" && prop.startsWith("mode_extension_")) {
          prop = prop.slice("mode_extension_".length);
        }
        return Reflect.get(target, prop, receiver);
      },
      set(target, prop, value, receiver) {
        if (typeof prop == "string" && prop.startsWith("mode_extension_")) {
          prop = prop.slice("mode_extension_".length);
        }
        return Reflect.set(target, prop, value, receiver);
      },
      defineProperty(target, prop, descriptor) {
        if (typeof prop == "string" && prop.startsWith("mode_extension_")) {
          prop = prop.slice("mode_extension_".length);
        }
        return Reflect.defineProperty(target, prop, descriptor);
      }
    }
  );
}
export {
  createCharacterSort
};

const setAllPropertiesEnumerable = (object) => {
  Object.getOwnPropertyNames(object).forEach((propertyKey) => {
    if (propertyKey == "constructor") {
      return;
    }
    const propertyDescriptor = Object.getOwnPropertyDescriptor(object, propertyKey);
    if (!propertyDescriptor) {
      throw new TypeError(`Missing own property descriptor: ${propertyKey}`);
    }
    if (!propertyDescriptor.enumerable) {
      propertyDescriptor.enumerable = true;
    }
    Object.defineProperty(object, propertyKey, propertyDescriptor);
  }, {});
  return object;
};
function initializeElementPrototypes(lib) {
  setAllPropertiesEnumerable(lib.element.Player.prototype);
  const cardPrototype = setAllPropertiesEnumerable(lib.element.Card.prototype), vCardPrototype = setAllPropertiesEnumerable(lib.element.VCard.prototype);
  Object.keys(vCardPrototype).forEach((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(vCardPrototype, key);
    if (!descriptor) {
      throw new TypeError(`Missing virtual card property descriptor: ${key}`);
    }
    Object.defineProperty(cardPrototype, key, descriptor);
  });
  setAllPropertiesEnumerable(lib.element.Button.prototype);
  setAllPropertiesEnumerable(lib.element.GameEvent.prototype);
  setAllPropertiesEnumerable(lib.element.Dialog.prototype);
  setAllPropertiesEnumerable(lib.element.Control.prototype);
  setAllPropertiesEnumerable(lib.element.Client.prototype);
  setAllPropertiesEnumerable(lib.element.NodeWS.prototype);
}
export {
  initializeElementPrototypes
};

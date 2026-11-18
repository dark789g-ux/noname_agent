const handlersMethods = {
  /**
   * @param {Parameters<typeof this.hasHandler>[0]} type
   * @param {GameEvent} event
   * @param {{
   * state?: 'begin' | 'end';
   * }} option
   * @returns {this}
   */
  callHandler(type, event, option) {
    if (this.hasHandler(type)) {
      const handlers = this.getHandler(type);
      if (!Array.isArray(handlers)) {
        throw new TypeError("Event handler did not normalize to an array");
      }
      handlers.forEach((handler) => {
        if (typeof handler == "function") {
          Reflect.apply(handler, void 0, [event, option]);
        }
      });
    }
    return this;
  },
  getDefaultHandlerType() {
    const eventName = this.name;
    if (eventName) {
      return `on${eventName[0].toUpperCase()}${eventName.slice(1)}`;
    } else {
      return "";
    }
  },
  getDefaultNextHandlerType() {
    const eventName = this.name;
    if (eventName) {
      return `onNext${eventName[0].toUpperCase()}${eventName.slice(1)}`;
    } else {
      return "";
    }
  },
  /**
   * Returns the raw dynamic handler slot after the legacy normalization write.
   * Accessors may replace that slot, so callers that need an array must check
   * the returned value at their own operation boundary.
   */
  getHandler(type) {
    if (!type) {
      type = this.getDefaultHandlerType();
    }
    const currentHandler = Reflect.get(this, type);
    if (!currentHandler) {
      if (!Reflect.set(this, type, [])) {
        throw new TypeError(`Cannot initialize event handler ${type || "(default)"}`);
      }
    } else if (!Array.isArray(currentHandler)) {
      if (!Reflect.set(this, type, [currentHandler])) {
        throw new TypeError(`Cannot normalize event handler ${type || "(default)"}`);
      }
    }
    return Reflect.get(this, type);
  },
  hasHandler(type) {
    if (!type) {
      type = this.getDefaultHandlerType();
    }
    if (!Reflect.get(this, type)) {
      return false;
    }
    const handlers = this.getHandler(type);
    if (typeof handlers === "string" || Array.isArray(handlers) || typeof handlers === "function") {
      return Boolean(handlers.length);
    }
    if (typeof handlers === "object" && handlers !== null) {
      return Boolean(Reflect.get(handlers, "length"));
    }
    return false;
  }
};
export {
  handlersMethods
};

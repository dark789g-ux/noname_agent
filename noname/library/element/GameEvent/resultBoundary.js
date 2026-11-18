function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isArrayOf(value, predicate) {
  return Array.isArray(value) && value.every(predicate);
}
function hasOptional(record, key, predicate) {
  if (!(key in record)) {
    return true;
  }
  if (!Object.hasOwn(record, key)) {
    return false;
  }
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (!descriptor || "get" in descriptor || "set" in descriptor) {
    return false;
  }
  return descriptor.value === void 0 || predicate(descriptor.value);
}
function isString(value) {
  return typeof value === "string";
}
function isNumber(value) {
  return typeof value === "number";
}
function isBooleanOrNull(value) {
  return typeof value === "boolean" || value === null;
}
function isCardBaseUIData(value, runtime) {
  if (!isRecord(value)) {
    return false;
  }
  return hasOptional(value, "name", isString) && hasOptional(value, "suit", isString) && hasOptional(value, "number", isNumber) && hasOptional(value, "nature", (value2) => isString(value2) || value2 === null) && hasOptional(value, "storage", isRecord) && hasOptional(value, "type", (value2) => isString(value2) || isArrayOf(value2, isString)) && hasOptional(value, "subtype", isString) && hasOptional(value, "color", isString) && hasOptional(value, "isCard", (value2) => typeof value2 === "boolean") && hasOptional(value, "cards", (value2) => isArrayOf(value2, runtime.isCard));
}
function isResultCard(value, runtime) {
  return runtime.isCard(value) || runtime.isVCard(value) || isCardBaseUIData(value, runtime);
}
function isSerializedSelectableButton(value) {
  return isRecord(value) && Object.getPrototypeOf(value) === Object.prototype && Reflect.ownKeys(value).length === 0;
}
function isSelectionResultObject(value, runtime) {
  if (!isRecord(value)) {
    return false;
  }
  return hasOptional(value, "bool", isBooleanOrNull) && hasOptional(value, "cards", (value2) => isArrayOf(value2, runtime.isCard)) && hasOptional(value, "targets", (value2) => isArrayOf(value2, runtime.isPlayer)) && hasOptional(value, "buttons", (value2) => isArrayOf(value2, (button) => runtime.isSelectableButton(button) || isSerializedSelectableButton(button))) && hasOptional(value, "links", Array.isArray) && hasOptional(value, "moved", Array.isArray) && hasOptional(value, "numbers", (value2) => isArrayOf(value2, isNumber)) && hasOptional(value, "control", isString) && hasOptional(value, "confirm", isString) && hasOptional(value, "skill", isString) && hasOptional(value, "index", isNumber) && hasOptional(value, "card", (value2) => isResultCard(value2, runtime)) && hasOptional(value, "cost_data", isRecord);
}
function normalizeSelectionResult(value, runtime) {
  if (value === "ai" || value === "cancelled" || value === "viewed" || isSelectionResultObject(value, runtime)) {
    return value;
  }
  return "cancelled";
}
function isImportModePayload(value) {
  if (!isRecord(value) || typeof value.name !== "string") {
    return false;
  }
  return typeof value.start === "function" || Array.isArray(value.start) && value.start.every((content) => typeof content === "function");
}
export {
  isImportModePayload,
  isSelectionResultObject,
  normalizeSelectionResult
};

export type SelectionResultRuntime = {
	isCard(value: unknown): value is Card;
	isPlayer(value: unknown): value is Player;
	isVCard(value: unknown): value is VCard;
	isSelectableButton(value: unknown): value is SelectableResultButton;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isArrayOf<T>(value: unknown, predicate: (item: unknown) => item is T): value is T[] {
	return Array.isArray(value) && value.every(predicate);
}

function hasOptional<T>(record: Record<string, unknown>, key: string, predicate: (value: unknown) => value is T): boolean {
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
	return descriptor.value === undefined || predicate(descriptor.value);
}

function isString(value: unknown): value is string {
	return typeof value === "string";
}

function isNumber(value: unknown): value is number {
	return typeof value === "number";
}

function isBooleanOrNull(value: unknown): value is boolean | null {
	return typeof value === "boolean" || value === null;
}

function isCardBaseUIData(value: unknown, runtime: SelectionResultRuntime): value is CardBaseUIData {
	if (!isRecord(value)) {
		return false;
	}
	return (
		hasOptional(value, "name", isString) &&
		hasOptional(value, "suit", isString) &&
		hasOptional(value, "number", isNumber) &&
		hasOptional(value, "nature", value => isString(value) || value === null) &&
		hasOptional(value, "storage", isRecord) &&
		hasOptional(value, "type", value => isString(value) || isArrayOf(value, isString)) &&
		hasOptional(value, "subtype", isString) &&
		hasOptional(value, "color", isString) &&
		hasOptional(value, "isCard", value => typeof value === "boolean") &&
		hasOptional(value, "cards", value => isArrayOf(value, runtime.isCard))
	);
}

function isResultCard(value: unknown, runtime: SelectionResultRuntime): value is Card | VCard | CardBaseUIData {
	return runtime.isCard(value) || runtime.isVCard(value) || isCardBaseUIData(value, runtime);
}

function isSerializedSelectableButton(value: unknown): value is SerializedSelectableResultButton {
	return isRecord(value) && Object.getPrototypeOf(value) === Object.prototype && Reflect.ownKeys(value).length === 0;
}

/**
 * Checks the documented selection fields while deliberately preserving unknown
 * business fields. Result objects are passed between extensions by reference,
 * so validation must never clone or normalize the accepted object.
 */
export function isSelectionResultObject(value: unknown, runtime: SelectionResultRuntime): value is Partial<Result> {
	if (!isRecord(value)) {
		return false;
	}
	return (
		hasOptional(value, "bool", isBooleanOrNull) &&
		hasOptional(value, "cards", value => isArrayOf(value, runtime.isCard)) &&
		hasOptional(value, "targets", value => isArrayOf(value, runtime.isPlayer)) &&
		hasOptional(value, "buttons", value => isArrayOf(value, button => runtime.isSelectableButton(button) || isSerializedSelectableButton(button))) &&
		hasOptional(value, "links", Array.isArray) &&
		hasOptional(value, "moved", Array.isArray) &&
		hasOptional(value, "numbers", value => isArrayOf(value, isNumber)) &&
		hasOptional(value, "control", isString) &&
		hasOptional(value, "confirm", isString) &&
		hasOptional(value, "skill", isString) &&
		hasOptional(value, "index", isNumber) &&
		hasOptional(value, "card", value => isResultCard(value, runtime)) &&
		hasOptional(value, "cost_data", isRecord)
	);
}

export function normalizeSelectionResult(value: unknown, runtime: SelectionResultRuntime): EventResult {
	if (value === "ai" || value === "cancelled" || value === "viewed" || isSelectionResultObject(value, runtime)) {
		return value;
	}
	return "cancelled";
}

/**
 * Mode payloads only need discrimination at this boundary. They remain open
 * extension objects and are not asserted to satisfy every mode configuration
 * field here.
 */
export function isImportModePayload(value: unknown): boolean {
	if (!isRecord(value) || typeof value.name !== "string") {
		return false;
	}
	return typeof value.start === "function" || (Array.isArray(value.start) && value.start.every(content => typeof content === "function"));
}

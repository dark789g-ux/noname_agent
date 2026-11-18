/**
 * Read an optional extension setting without claiming that Status initializes it.
 * Keep native Math.max coercion (including rejection of BigInt and Symbol).
 * @param {object} status
 * @param {number} fallback
 * @param {number} minimum
 * @returns {number}
 */
export function readMaximumNumberOfPlayers(status, fallback, minimum) {
	const math = Math;
	const max = math.max;
	/** @type {unknown} */
	const configured = Reflect.get(status, "maximumNumberOfPlayers");
	/** @type {unknown} */
	const result = Reflect.apply(max, math, [configured || fallback, minimum]);
	if (typeof result !== "number") throw new TypeError("Math.max must return a number");
	return result;
}

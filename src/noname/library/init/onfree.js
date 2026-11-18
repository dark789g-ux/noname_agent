/**
 * Startup-only consumers must not silently lose work after the queue is drained.
 * @param {Array<() => void> | undefined} callbacks
 * @returns {Array<() => void>}
 */
export function requireOnFree(callbacks) {
	if (callbacks === undefined) {
		throw new TypeError("The startup callback queue is no longer available");
	}
	return callbacks;
}

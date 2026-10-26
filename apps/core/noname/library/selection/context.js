const selectionTypes = ["button", "card", "target", "control", "number"];

/** @typedef {import("./step.js").SelectionItem} SelectionItem */
/**
 * @template {SelectionItem} T
 * @typedef {object} SelectionContextOptions
 * @property {object} [event] Opaque event identity, never inspected by the context.
 * @property {object} [player] Opaque player identity, never inspected by the context.
 * @property {string} [source]
 * @property {Record<string, T[]>} [selected]
 */

/**
 * Stores headless selections by step id. It never reads ui.selected or
 * _status.event, and only exposes copied data to rule callbacks.
 * @template {SelectionItem} [T=SelectionItem]
 */
export class SelectionContext {
	/** @param {SelectionContextOptions<T>} [options] */
	constructor({ event, player, source = "unknown", selected = {} } = {}) {
		/** @type {object | undefined} */
		this.event = event;
		/** @type {object | undefined} */
		this.player = player;
		this.source = source;
		/** @type {Map<string, { type: string, items: T[] }>} */
		this.selections = new Map();
		for (const type of selectionTypes) {
			if (Array.isArray(selected[type])) {
				this.setStepSelected(`initial:${type}`, type, selected[type]);
			}
		}
	}

	/** @param {string} stepId */
	getStepSelected(stepId) {
		return this.selections.get(stepId)?.items.slice() || [];
	}

	/** @param {string} stepId @param {string} type @param {T[]} items */
	setStepSelected(stepId, type, items) {
		this.assertType(type);
		if (!stepId || !Array.isArray(items)) {
			throw new TypeError("Selection step id and item array are required");
		}
		this.selections.set(stepId, { type, items: items.slice() });
		return this;
	}

	/** @param {string} stepId @param {string} type */
	bindInitialSelection(stepId, type) {
		this.assertType(type);
		const initialId = `initial:${type}`;
		const initial = this.selections.get(initialId);
		if (!initial || this.selections.has(stepId)) {
			return this;
		}
		this.selections.delete(initialId);
		this.setStepSelected(stepId, type, initial.items);
		return this;
	}

	/** @param {string} type */
	getSelected(type) {
		this.assertType(type);
		return this.getSelectedView()[type];
	}

	getSelectedView() {
		/** @type {Record<string, T[]>} */
		const selected = Object.fromEntries(selectionTypes.map(type => [type, []]));
		for (const { type, items } of this.selections.values()) {
			selected[type].push(...items);
		}
		for (const type of selectionTypes) {
			Object.freeze(selected[type]);
		}
		return Object.freeze(selected);
	}

	getReadonlyView() {
		const steps = {};
		for (const [id, { type, items }] of this.selections) {
			steps[id] = Object.freeze({ type, items: Object.freeze(items.slice()) });
		}
		return Object.freeze({
			event: this.event,
			player: this.player,
			source: this.source,
			selected: this.getSelectedView(),
			steps: Object.freeze(steps),
			getSelected: type => this.getSelected(type),
			getStepSelected: stepId => this.getStepSelected(stepId),
		});
	}

	toJSON() {
		const selected = this.getSelectedView();
		return {
			source: this.source,
			selectedCounts: Object.fromEntries(selectionTypes.map(type => [type, selected[type].length])),
		};
	}

	assertType(type) {
		if (!selectionTypes.includes(type)) {
			throw new TypeError(`Unsupported selection type: ${type}`);
		}
	}
}

export { selectionTypes };

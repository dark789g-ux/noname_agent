export const SelectionStatus = Object.freeze({
	PENDING: "pending",
	COMPLETE: "complete",
	INVALID: "invalid",
	UNSUPPORTED: "unsupported",
});

/** @typedef {Card | Player | Button | string | number} SelectionOutcomeItem */

/**
 * @typedef {{
 *   type: string | undefined,
 *   items: SelectionOutcomeItem[],
 *   selected: SelectionOutcomeItem[],
 *   range: [number, number],
 *   entries: { item: SelectionOutcomeItem, available: boolean }[],
 *   automatic: boolean,
 *   automaticSelected: SelectionOutcomeItem[],
 *   selectableItems: boolean,
 * }} SelectionInspection
 */

/**
 * @typedef {{
 *   type?: string,
 *   reason?: string,
 *   value?: SelectionOutcomeItem | SelectionOutcomeItem[],
 *   inspection?: SelectionInspection,
 * }} SelectionOutcomeOptions
 */

export class SelectionOutcome {
	/**
	 * @param {typeof SelectionStatus[keyof typeof SelectionStatus]} status
	 * @param {SelectionOutcomeOptions} [options]
	 */
	constructor(status, { type, reason, value, inspection } = {}) {
		this.status = status;
		this.type = type;
		this.reason = reason;
		this.value = value;
		this.inspection = inspection;
	}

	get ok() {
		return this.status === SelectionStatus.COMPLETE;
	}

	get pending() {
		return this.status === SelectionStatus.PENDING;
	}

	/** @param {SelectionOutcomeOptions} options */
	static complete(options) {
		return new SelectionOutcome(SelectionStatus.COMPLETE, options);
	}

	/** @param {SelectionOutcomeOptions} options */
	static pending(options) {
		return new SelectionOutcome(SelectionStatus.PENDING, options);
	}

	/** @param {SelectionOutcomeOptions} options */
	static invalid(options) {
		return new SelectionOutcome(SelectionStatus.INVALID, options);
	}

	/** @param {SelectionOutcomeOptions} options */
	static unsupported(options) {
		return new SelectionOutcome(SelectionStatus.UNSUPPORTED, options);
	}
}

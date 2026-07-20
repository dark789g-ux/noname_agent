export const SelectionStatus = Object.freeze({
	PENDING: "pending",
	COMPLETE: "complete",
	INVALID: "invalid",
	UNSUPPORTED: "unsupported",
});

export class SelectionOutcome {
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

	static complete(options) {
		return new SelectionOutcome(SelectionStatus.COMPLETE, options);
	}

	static pending(options) {
		return new SelectionOutcome(SelectionStatus.PENDING, options);
	}

	static invalid(options) {
		return new SelectionOutcome(SelectionStatus.INVALID, options);
	}

	static unsupported(options) {
		return new SelectionOutcome(SelectionStatus.UNSUPPORTED, options);
	}
}

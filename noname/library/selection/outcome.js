const SelectionStatus = Object.freeze({
  PENDING: "pending",
  COMPLETE: "complete",
  INVALID: "invalid",
  UNSUPPORTED: "unsupported"
});
class SelectionOutcome {
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
export {
  SelectionOutcome,
  SelectionStatus
};

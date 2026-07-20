import { SelectionOutcome } from "./outcome.js";
import { SelectionStep } from "./step.js";

/** Holds explicit selections by step id for one headless decision. */
export class SelectionSession {
	constructor({ context, filterOk } = {}) {
		if (!context) {
			throw new TypeError("SelectionSession requires a SelectionContext");
		}
		this.context = context;
		this.filterOk = filterOk;
		this.steps = new Map();
	}

	register(step) {
		const normalized = step instanceof SelectionStep ? step : new SelectionStep(step);
		if (!normalized.id || !normalized.type) {
			throw new TypeError("Selection step requires id and type");
		}
		if (this.steps.has(normalized.id)) {
			throw new TypeError(`Duplicate selection step id: ${normalized.id}`);
		}
		if (![...this.steps.values()].some(step => step.type === normalized.type)) {
			this.context.bindInitialSelection(normalized.id, normalized.type);
		}
		this.steps.set(normalized.id, normalized);
		return normalized;
	}

	getStep(id) {
		return this.steps.get(id);
	}

	evaluate(id, proposedSelected = this.context.getStepSelected(id)) {
		const step = this.getStep(id);
		if (!step) {
			return SelectionOutcome.unsupported({ reason: "unknown_step" });
		}
		const outcome = step.evaluate(this.context.getReadonlyView(), proposedSelected);
		if (outcome.inspection?.automatic && outcome.status !== "invalid") {
			this.context.setStepSelected(step.id, step.type, outcome.inspection.automaticSelected);
		}
		return outcome;
	}

	setSelection(id, items) {
		const step = this.getStep(id);
		if (!step) {
			return SelectionOutcome.unsupported({ reason: "unknown_step" });
		}
		if (!Array.isArray(items)) {
			return SelectionOutcome.invalid({ type: step.type, reason: "not_array" });
		}
		const outcome = step.evaluate(this.context.getReadonlyView(), items.slice());
		if (outcome.status === "invalid") {
			return outcome;
		}
		const resolved = outcome.inspection.automatic ? outcome.inspection.automaticSelected : items;
		this.context.setStepSelected(step.id, step.type, resolved);
		return outcome;
	}

	finalize() {
		for (const [id, step] of this.steps) {
			const outcome = this.evaluate(id);
			if (!outcome.ok) {
				return outcome;
			}
		}
		if (typeof this.filterOk === "function" && !this.filterOk(this.context.getReadonlyView())) {
			return SelectionOutcome.invalid({ reason: "filter_ok" });
		}
		return SelectionOutcome.complete({});
	}
}

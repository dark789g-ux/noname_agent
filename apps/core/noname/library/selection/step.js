import { SelectionValidator } from "./validator.js";

/**
 * @typedef {Card | Player | Button | { id: string } | string | number} SelectionItem
 */

/**
 * @typedef {object} SelectionStepOptions
 * @property {string} [id]
 * @property {string} [type]
 * @property {SelectionItem[] | ((context: object | undefined, selected: SelectionItem[], step: SelectionStep | undefined) => SelectionItem[])} [items]
 * @property {number | Select | string | ((context: object | undefined, selected: SelectionItem[], step: SelectionStep | undefined) => number | Select | string)} [select]
 * @property {(value: string | number | Select) => number | Select | string} [getSelect]
 * @property {(item: SelectionItem, context: object | undefined, selected: SelectionItem[], step: SelectionStep | undefined) => boolean} [isIncluded]
 * @property {(item: SelectionItem, context: object | undefined, selected: SelectionItem[], step: SelectionStep | undefined) => boolean} [isSelectable]
 * @property {boolean} [required]
 * @property {boolean} [forced]
 * @property {boolean} [complex]
 */

export class SelectionStep {
	/**
	 * @param {SelectionStepOptions} options
	 */
	constructor({ id, type, items = [], select, getSelect, isIncluded, isSelectable, required, forced, complex } = {}) {
		this.id = id || type;
		this.type = type;
		this.items = items;
		this.select = select;
		this.getSelect = getSelect;
		this.isIncluded = isIncluded;
		this.isSelectable = isSelectable;
		this.required = required;
		this.forced = forced;
		this.complex = complex;
	}

	inspect(context, proposedSelected = []) {
		return SelectionValidator.inspect({
			type: this.type,
			items: this.resolveItems(context, proposedSelected),
			selected: proposedSelected,
			range: this.select,
			getSelect: this.getSelect,
			isIncluded: this.isIncluded,
			isSelectable: this.isSelectable,
			context,
			step: this,
		});
	}

	evaluate(context, proposedSelected = []) {
		const inspection = this.inspect(context, proposedSelected);
		const selected = inspection.automatic ? inspection.automaticSelected : proposedSelected;
		return SelectionValidator.complete({
			type: this.type,
			selected,
			inspection,
			required: this.required,
			forced: this.forced,
			complex: this.complex,
		});
	}

	resolveItems(context, proposedSelected) {
		const items = typeof this.items === "function" ? this.items(context, proposedSelected.slice(), this) : this.items;
		if (!Array.isArray(items)) {
			throw new TypeError(`Selection step ${this.id} did not resolve to an item array`);
		}
		return items;
	}
}

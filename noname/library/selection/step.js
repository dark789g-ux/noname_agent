import { SelectionValidator } from "./validator.js";
class SelectionStep {
  /**
   * @param {SelectionStepOptions} options
   */
  constructor({ id, type, items = [], select, getSelect, isIncluded, isSelectable, required, forced, complex, selectionMode } = {}) {
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
    this.selectionMode = selectionMode;
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
      step: this
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
      complex: this.complex
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
export {
  SelectionStep
};

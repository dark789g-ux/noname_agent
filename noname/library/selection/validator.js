import { SelectionOutcome } from "./outcome.js";
class SelectionValidator {
  /**
   * Match get.select semantics for numbers, callbacks and select tuples while
   * allowing headless callbacks to receive explicit state.
   */
  static range(select, getSelect, context, proposedSelected = [], step) {
    if (select === void 0) {
      return [1, 1];
    }
    if (typeof select === "function") {
      return this.range(select(context, proposedSelected.slice(), step), getSelect, context, proposedSelected, step);
    }
    if (typeof select === "number") {
      return [select, select];
    }
    if (Array.isArray(select)) {
      return this.assertRange(select);
    }
    const resolved = typeof getSelect === "function" ? getSelect(select) : select;
    if (resolved !== select) {
      return this.range(resolved, void 0, context, proposedSelected, step);
    }
    throw new TypeError("Selection range must resolve to a number or [min, max] tuple");
  }
  static assertRange(range) {
    if (range.length < 2 || typeof range[0] !== "number" || typeof range[1] !== "number" || Number.isNaN(range[0]) || Number.isNaN(range[1])) {
      throw new TypeError("Selection range must resolve to a numeric [min, max] tuple");
    }
    return [range[0], range[1]];
  }
  /**
   * Inspect candidates without mutating them. Negative maximum ranges retain
   * the engine's left-to-right accumulation by passing prior legal items to
   * each predicate and returning that automatic collection.
   */
  /**
   * @template {SelectionItem} T
   * @param {SelectionInspectionOptions<T>} options
   */
  static inspect({ type, items = [], selected = [], range, getSelect, isIncluded, isSelectable, context, step }) {
    if (!Array.isArray(items) || !Array.isArray(selected)) {
      throw new TypeError("Selection items and selected values must be arrays");
    }
    const normalizedRange = this.range(range, getSelect, context, selected, step);
    const included = typeof isIncluded === "function" ? isIncluded : () => true;
    const selectable = typeof isSelectable === "function" ? isSelectable : () => true;
    const automatic = normalizedRange[1] < 0;
    const automaticSelected = [];
    const entries = items.map((item) => {
      const index = selected.indexOf(item);
      const proposedSelected = automatic ? automaticSelected.slice() : step?.selectionMode === "sequential" && index >= 0 ? selected.slice(0, index) : selected.slice();
      const available = Boolean(included(item, context, proposedSelected, step) && selectable(item, context, proposedSelected, step));
      if (automatic && available) {
        automaticSelected.push(item);
      }
      return { item, available };
    });
    return {
      type,
      items: items.slice(),
      selected: selected.slice(),
      range: normalizedRange,
      entries,
      automatic,
      automaticSelected,
      selectableItems: entries.some((entry) => entry.available)
    };
  }
  static evaluate(options) {
    const inspection = this.inspect(options);
    return this.complete({
      ...options,
      selected: inspection.automatic ? inspection.automaticSelected : options.selected,
      inspection
    });
  }
  static complete({ type, selected, inspection, required = false, forced = false, complex = false, strict = true, enforceMax = true }) {
    const values = Array.isArray(selected) ? selected : inspection.selected;
    const [min, max] = inspection.range;
    if (strict) {
      const seen = /* @__PURE__ */ new Set();
      for (const item of values) {
        if (seen.has(item)) {
          return SelectionOutcome.invalid({ type, reason: "duplicate", value: item, inspection });
        }
        seen.add(item);
        const entry = inspection.entries.find((entry2) => entry2.item === item);
        if (!entry || !entry.available) {
          return SelectionOutcome.invalid({ type, reason: "unavailable", value: item, inspection });
        }
      }
    }
    if (enforceMax && max >= 0 && values.length > max) {
      return SelectionOutcome.invalid({ type, reason: "too_many", inspection });
    }
    if (required && values.length === 0) {
      return SelectionOutcome.pending({ type, reason: "required", inspection, value: values.slice() });
    }
    if (values.length < min && (!forced || inspection.selectableItems || complex)) {
      return SelectionOutcome.pending({ type, reason: "too_few", inspection, value: values.slice() });
    }
    return SelectionOutcome.complete({ type, inspection, value: values.slice() });
  }
}
export {
  SelectionValidator
};

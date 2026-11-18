import { resolveBaseEvent } from "./skill-backup-semantics.js";
const COMPLEX_TARGET_KEYS = ["complexSelect", "complexTarget", "filterAddedTarget", "changeTarget"];
function evaluateSelectionSpec(value, event, player, sourceLabel, onFail) {
  if (value === false) return { mode: "disabled" };
  if (value === void 0) return { mode: "generic" };
  if (value === true) return { mode: "explicit", spec: {} };
  if (typeof value === "function") {
    let resolved;
    try {
      resolved = value(event, player);
    } catch (error) {
      onFail(`skill "${sourceLabel}" selectionSpec threw: ${error?.message || "unknown error"}`);
    }
    if (resolved === false) return { mode: "disabled" };
    if (resolved === void 0) return { mode: "generic" };
    if (resolved === true) return { mode: "explicit", spec: {} };
    if (resolved && typeof resolved === "object") return { mode: "explicit", spec: resolved };
    return { mode: "disabled" };
  }
  if (value && typeof value === "object") return { mode: "explicit", spec: value };
  return { mode: "disabled" };
}
function hasComplexTargetFlags(source) {
  return COMPLEX_TARGET_KEYS.some((key) => typeof source?.[key] === "function" || source?.[key] === true);
}
function isSingleCardAddedTarget(source) {
  return !!(source?.singleCard && typeof source?.filterAddedTarget === "function");
}
function splitAddedTargetPrimaryRange(range, doubledByEngine) {
  if (!doubledByEngine) return range;
  return [Math.max(1, Math.floor(range[0] / 2)), Math.max(1, Math.floor(range[1] / 2))];
}
function assertSupportedTargetRules(source, label, onFail) {
  const complex = COMPLEX_TARGET_KEYS.filter((key) => typeof source?.[key] === "function" || source?.[key] === true);
  if (complex.length) onFail(`${label} uses unsupported legacy target flags: ${complex.join(", ")}`);
}
function normalizeSelectionStep(step, skill, index, onFail) {
  if (!step || !["button", "card", "target", "control", "number"].includes(step.type)) {
    onFail(`skill "${skill}" has an unreadable selection step`);
  }
  return { ...step, id: step.id || `skill:${skill}:${step.type}:${index}` };
}
function deriveSkillSteps(info, includeViewAsCardFallback) {
  const steps = [];
  if (info?.selectCard !== void 0 || info?.filterCard !== void 0 || includeViewAsCardFallback && info?.viewAs) {
    steps.push({ type: "card" });
  }
  if (isSingleCardAddedTarget(info)) {
    steps.push({ type: "target", role: "primary", selectionMode: "sequential" });
    steps.push({ type: "target", role: "added", select: 1, addedTargetFilter: true });
  } else if (info?.selectTarget !== void 0 || info?.filterTarget !== void 0) {
    steps.push({ type: "target" });
  }
  return steps;
}
function evalFilterTargetValue(filterTarget, card, player, target) {
  if (filterTarget === true || filterTarget == null) return true;
  if (filterTarget === false) return false;
  if (typeof filterTarget === "function") return !!filterTarget(card, player, target);
  return false;
}
function resolveUnifiedSkillPlan(event, player, skill, info, onFail) {
  if (!info) return void 0;
  const evaluated = evaluateSelectionSpec(info.selectionSpec, event, player, skill, onFail);
  if (evaluated.mode === "disabled") return void 0;
  const generic = evaluated.mode === "generic";
  const spec = generic ? {} : evaluated.spec;
  const baseEvent = resolveBaseEvent(event);
  const viewAs = spec.viewAs ?? info.viewAs;
  const hasViewAs = Boolean(viewAs);
  if (!generic && typeof info.filterOk === "function" && !spec.finalPredicate) {
    onFail(`skill "${skill}" has UI-only filterOk`);
  }
  if (!generic) {
    if (hasViewAs) assertSupportedTargetRules(baseEvent, `skill "${skill}" event`, onFail);
    if (!spec.orderedTargets || !spec.steps?.some((step) => step.type === "target" && step.selectionMode === "sequential" && typeof step.filter === "function")) {
      assertSupportedTargetRules(info, `skill "${skill}"`, onFail);
    }
  }
  const includeViewAsCardFallback = Boolean(hasViewAs && (baseEvent?.filterCard !== void 0 || baseEvent?.selectCard !== void 0 || viewAs));
  const rawSteps = !generic && spec.steps !== void 0 ? spec.steps : deriveSkillSteps({ ...info, viewAs }, includeViewAsCardFallback);
  const isSequentialTarget = generic && !isSingleCardAddedTarget(info) && (hasComplexTargetFlags(info) || hasViewAs && hasComplexTargetFlags(baseEvent));
  const steps = rawSteps.map((step, index) => {
    const normalized = normalizeSelectionStep(step, skill, index, onFail);
    if (generic && normalized.type === "card" && !normalized.selectionMode) {
      normalized.selectionMode = "sequential";
    }
    if (isSequentialTarget && normalized.type === "target" && !normalized.selectionMode) {
      normalized.selectionMode = "sequential";
    }
    return normalized;
  });
  let targetDeferred = false;
  if (hasViewAs && event.name === "chooseToUse" && !steps.some((step) => step.type === "target") && (baseEvent.filterTarget !== void 0 || baseEvent.selectTarget !== void 0 || baseEvent.targetRequired)) {
    steps.push({
      id: `skill:${skill}:target:${steps.length}`,
      type: "target",
      select: void 0,
      deferredFromCards: true,
      selectionMode: isSequentialTarget ? "sequential" : void 0
    });
    targetDeferred = true;
  }
  for (const step of steps) {
    if (!generic && step.selectionMode === "sequential" && (!spec.orderedTargets || typeof step.filter !== "function")) {
      onFail(`skill "${skill}" has unaudited sequential dependency in ${step.id}`);
    }
  }
  const cardStep = steps.find((step) => step.type === "card");
  const targetStep = steps.find((step) => step.type === "target");
  const targetSteps = steps.filter((step) => step.type === "target");
  if (targetStep?.deferredFromCards || targetSteps.length > 1 || targetStep && (typeof viewAs === "function" || targetStep.selectionMode === "sequential" || typeof targetStep.items === "function" || generic && (info.complexCard || hasViewAs && baseEvent.complexCard || hasComplexTargetFlags(info) || hasViewAs && hasComplexTargetFlags(baseEvent) || cardStep && typeof info.selectTarget === "function" || cardStep && typeof info.filterTarget === "function"))) {
    targetDeferred = true;
  }
  return { spec, generic, steps, cardStep, targetStep, targetDeferred, viewAs };
}
export {
  COMPLEX_TARGET_KEYS,
  assertSupportedTargetRules,
  deriveSkillSteps,
  evalFilterTargetValue,
  evaluateSelectionSpec,
  hasComplexTargetFlags,
  isSingleCardAddedTarget,
  normalizeSelectionStep,
  resolveUnifiedSkillPlan,
  splitAddedTargetPrimaryRange
};

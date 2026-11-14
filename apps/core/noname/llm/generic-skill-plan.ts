export const COMPLEX_TARGET_KEYS = ["complexSelect", "complexTarget", "filterAddedTarget", "changeTarget"] as const;

export interface EvaluatedSelectionSpec {
	mode: "explicit" | "disabled" | "generic";
	spec?: any;
}

export interface UnifiedSkillPlan {
	spec: any;
	generic: boolean;
	steps: any[];
	cardStep?: any;
	targetStep?: any;
	targetDeferred: boolean;
	viewAs?: any;
}

export function evaluateSelectionSpec(value: any, event: any, player: any, sourceLabel: string, onFail: (message: string) => never): EvaluatedSelectionSpec {
	if (value === false) return { mode: "disabled" };
	if (value === undefined) return { mode: "generic" };
	if (value === true) return { mode: "explicit", spec: {} };
	if (typeof value === "function") {
		let resolved: any;
		try {
			resolved = value(event, player);
		} catch (error) {
			onFail(`skill "${sourceLabel}" selectionSpec threw: ${(error as Error)?.message || "unknown error"}`);
		}
		if (resolved === false) return { mode: "disabled" };
		if (resolved === undefined) return { mode: "generic" };
		if (resolved === true) return { mode: "explicit", spec: {} };
		if (resolved && typeof resolved === "object") return { mode: "explicit", spec: resolved };
		return { mode: "disabled" };
	}
	if (value && typeof value === "object") return { mode: "explicit", spec: value };
	return { mode: "disabled" };
}

export function hasComplexTargetFlags(source: any): boolean {
	return COMPLEX_TARGET_KEYS.some(key => typeof source?.[key] === "function" || source?.[key] === true);
}

export function isSingleCardAddedTarget(source: any): boolean {
	return !!(source?.singleCard && typeof source?.filterAddedTarget === "function");
}

export function splitAddedTargetPrimaryRange(range: [number, number], doubledByEngine: boolean): [number, number] {
	if (!doubledByEngine) return range;
	return [Math.max(1, Math.floor(range[0] / 2)), Math.max(1, Math.floor(range[1] / 2))];
}

export function assertSupportedTargetRules(source: any, label: string, onFail: (message: string) => never): void {
	const complex = COMPLEX_TARGET_KEYS.filter(key => typeof source?.[key] === "function" || source?.[key] === true);
	if (complex.length) onFail(`${label} uses unsupported legacy target flags: ${complex.join(", ")}`);
}

export function normalizeSelectionStep(step: any, skill: string, index: number, onFail: (message: string) => never): any {
	if (!step || !["button", "card", "target", "control", "number"].includes(step.type)) {
		onFail(`skill "${skill}" has an unreadable selection step`);
	}
	return { ...step, id: step.id || `skill:${skill}:${step.type}:${index}` };
}

export function deriveSkillSteps(info: any, includeViewAsCardFallback: boolean): any[] {
	const steps: any[] = [];
	if (info?.selectCard !== undefined || info?.filterCard !== undefined || (includeViewAsCardFallback && info?.viewAs)) {
		steps.push({ type: "card" });
	}
	if (isSingleCardAddedTarget(info)) {
		steps.push({ type: "target", role: "primary" });
		steps.push({ type: "target", role: "added", select: 1, addedTargetFilter: true });
	} else if (info?.selectTarget !== undefined || info?.filterTarget !== undefined) {
		steps.push({ type: "target" });
	}
	return steps;
}

export function evalFilterTargetValue(filterTarget: any, card: any, player: any, target: any): boolean {
	if (filterTarget === true || filterTarget == null) return true;
	if (filterTarget === false) return false;
	if (typeof filterTarget === "function") return !!filterTarget(card, player, target);
	return false;
}

export function resolveUnifiedSkillPlan(
	event: any,
	player: any,
	skill: string,
	info: any,
	onFail: (message: string) => never
): UnifiedSkillPlan | undefined {
	if (!info) return undefined;
	const evaluated = evaluateSelectionSpec(info.selectionSpec, event, player, skill, onFail);
	if (evaluated.mode === "disabled") return undefined;

	const generic = evaluated.mode === "generic";
	const spec = generic ? {} : evaluated.spec;

	if (!generic && typeof info.filterOk === "function" && !spec.finalPredicate) {
		onFail(`skill "${skill}" has UI-only filterOk`);
	}
	if (!generic) {
		assertSupportedTargetRules(event, `skill "${skill}" event`, onFail);
		if (!spec.orderedTargets || !spec.steps?.some((step: any) => step.type === "target" && step.selectionMode === "sequential" && typeof step.filter === "function")) {
			assertSupportedTargetRules(info, `skill "${skill}"`, onFail);
		}
	}

	const viewAs = spec.viewAs ?? info.viewAs;
	const rawSteps = !generic && spec.steps !== undefined ? spec.steps : deriveSkillSteps(info, !generic);
	const isSequentialTarget = generic && !isSingleCardAddedTarget(info) && (hasComplexTargetFlags(info) || hasComplexTargetFlags(event));
	const steps = rawSteps.map((step: any, index: number) => {
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
	if (viewAs && event.name === "chooseToUse" && !steps.some((step: any) => step.type === "target") && (event.filterTarget || event.selectTarget !== undefined || event.targetRequired)) {
		steps.push({
			id: `skill:${skill}:target:${steps.length}`,
			type: "target",
			select: undefined,
			deferredFromCards: true,
			selectionMode: isSequentialTarget ? "sequential" : undefined,
		});
		targetDeferred = true;
	}

	for (const step of steps) {
		if (!generic && step.selectionMode === "sequential" && (!spec.orderedTargets || typeof step.filter !== "function")) {
			onFail(`skill "${skill}" has unaudited sequential dependency in ${step.id}`);
		}
	}

	const cardStep = steps.find((step: any) => step.type === "card");
	const targetStep = steps.find((step: any) => step.type === "target");
	const targetSteps = steps.filter((step: any) => step.type === "target");
	if (
		targetStep?.deferredFromCards ||
		targetSteps.length > 1 ||
		(targetStep &&
			(typeof viewAs === "function" ||
				targetStep.selectionMode === "sequential" ||
				typeof targetStep.items === "function" ||
				(generic &&
					(info.complexCard ||
						hasComplexTargetFlags(info) ||
						hasComplexTargetFlags(event) ||
						(cardStep && typeof info.selectTarget === "function") ||
						(cardStep && typeof info.filterTarget === "function")))))
	) {
		targetDeferred = true;
	}

	return { spec, generic, steps, cardStep, targetStep, targetDeferred, viewAs };
}

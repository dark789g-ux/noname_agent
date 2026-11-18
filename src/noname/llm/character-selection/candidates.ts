import type { CharacterCandidate, CharacterSelectionSnapshot, CharacterVersion } from "./validation.js";

export interface DescribedVersion extends CharacterVersion {
	label: string;
	sex: string;
	faction: string;
	hp: string;
	skills: readonly { name: string; description: string }[];
}

export interface SelectionCandidates extends CharacterSelectionSnapshot {
	candidates: readonly (CharacterCandidate & { versions: readonly DescribedVersion[] })[];
}

export interface CandidateRuntime {
	versions(source: string): string[];
	source(name: string): string;
	allowed(name: string): boolean;
	describe(name: string): DescribedVersion;
}

/** 输入必须来自身份模式已经过滤的界面候选，不能从整个武将库补候选。 */
export function buildSelectionCandidates(sources: readonly string[], count: 1 | 2, runtime: CandidateRuntime): SelectionCandidates {
	const seen = new Set<string>();
	const candidates: SelectionCandidates["candidates"][number][] = [];
	for (const entry of sources) {
		const source = runtime.source(entry);
		if (seen.has(source)) continue;
		seen.add(source);
		const names = runtime.versions(entry).filter(name => runtime.allowed(name));
		const versions = [...new Set(names)].map(name => Object.freeze(runtime.describe(name)));
		if (versions.length) candidates.push(Object.freeze({ ref: `c${candidates.length}`, source, versions: Object.freeze(versions) }));
	}
	if (candidates.length < count) throw new Error("合法候选不足");
	return Object.freeze({ candidates: Object.freeze(candidates), count });
}

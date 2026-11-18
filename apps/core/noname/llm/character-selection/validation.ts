/** 每个候选来源只能选择一个版本；势力选项属于具体版本的主将。 */
export interface CharacterVersion {
	name: string;
	groups: readonly string[];
}

export interface CharacterCandidate {
	ref: string;
	source: string;
	versions: readonly CharacterVersion[];
}

export interface CharacterSelectionSnapshot {
	candidates: readonly CharacterCandidate[];
	count: 1 | 2;
}

export interface CharacterSelectionResult {
	characters: string[];
	sources: string[];
	group?: string;
}

/** 仅接受冻结候选中的引用与版本；第一个武将决定势力选项。 */
export function validateCharacterSelection(snapshot: CharacterSelectionSnapshot, value: unknown): CharacterSelectionResult {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("选将结果必须是对象");
	const data = value as Record<string, unknown>;
	if (!Array.isArray(data.characters) || data.characters.length !== snapshot.count) throw new Error("选将数量不正确");
	const characters: string[] = [];
	const sources: string[] = [];
	let main: CharacterVersion | undefined;
	for (const item of data.characters) {
		if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("武将选择必须是对象");
		const choice = item as Record<string, unknown>;
		const matching = snapshot.candidates.filter(candidate => candidate.ref === choice.ref);
		if (matching.length !== 1) throw new Error("武将引用无效");
		const candidate = matching[0];
		if (sources.includes(candidate.source)) throw new Error("不能重复选择同一来源武将");
		const version = candidate.versions.find(entry => entry.name === choice.version);
		if (!version) throw new Error("武将版本不在候选范围内");
		if (characters.includes(version.name)) throw new Error("不能重复选择同一武将版本");
		sources.push(candidate.source);
		characters.push(version.name);
		main ??= version;
	}
	const groups = main?.groups ?? [];
	if (groups.length > 1 && (typeof data.group !== "string" || !groups.includes(data.group))) {
		throw new Error("势力不在合法范围内");
	}
	const group = groups.length === 1 ? groups[0] : groups.length > 1 ? (data.group as string) : undefined;
	return { characters, sources, ...(group ? { group } : {}) };
}

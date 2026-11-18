import { buildSelectionCandidates } from "./candidates.js";
import type { OpeningLogger } from "./decision.js";
import type { TransportTurnResult } from "../harness/types.js";

export function candidates(count: 1 | 2 = 1) {
	return buildSelectionCandidates(["a", "b", "c"], count, {
		source: name => name,
		versions: name => [name + "1", name + "2"],
		allowed: () => true,
		describe: name => ({
			name,
			label: `武将${name}`,
			faction: "wei",
			sex: "男",
			hp: "4",
			groups: name.startsWith("a") ? ["wei", "shu"] : [],
			skills: [{ name: "技能", description: "技能说明" }],
		}),
	});
}

export function loggerFixture() {
	const entries: { method: string; args: any[] }[] = [];
	const logger = new Proxy(
		{},
		{
			get:
				(_target, method: string) =>
				(...args: any[]) => {
					entries.push({ method, args });
					return method === "start" ? `log_${entries.length}` : undefined;
				},
		}
	) as OpeningLogger;
	return { logger, entries };
}

export function response(ref = "c0", version = "a1", group: string | undefined = "wei"): TransportTurnResult {
	return {
		toolCall: { id: "call1", name: "select_character", reason: "适合当前身份", arguments: { characters: [{ ref, version }], ...(group ? { group } : {}) } },
		transport: "stream",
		syncedRemote: true,
	};
}

export function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}

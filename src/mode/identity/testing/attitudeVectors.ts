import { createHash } from "node:crypto";
import { createModuleRuntime } from "../../../noname/llm/testing/module-runtime.mjs";

interface Seat {
	identity: string;
	isZhu: boolean;
	hp: number;
	ai: { shown: number; identity_mark: string; friend: Seat[]; sizhong?: boolean };
	countCards: (position: string) => number;
}

/** Deterministic characterization vectors, independent of internal branching. */
export async function identityFingerprints(entry = "mode/identity.js") {
	let situation = 0,
		strategy = 1;
	const status = { mode: "normal" };
	const game = {
		players: [] as Seat[],
		zhu: undefined as Seat | undefined,
		hasPlayer: (filter: (player: Seat) => boolean) => game.players.some(filter),
	};
	const get = {
		situation: () => situation,
		aiStrategy: () => strategy,
		population: (identity?: string) => game.players.filter(player => !identity || player.identity === identity).length,
	};
	const runtime = await createModuleRuntime(
		{
			game,
			get,
			_status: status,
			createIdentityOpening() {},
			selectOpeningMonarch() {},
			selectOpeningSelf() {},
			selectRemainingOpening() {},
		},
		{},
		{ dedent: { default: value => value } }
	);
	runtime.run("Math.random = () => 0.25;");
	const createMode = (await runtime.import(entry)).default;
	const mode = createMode();
	const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
	const shape = digest({
		keys: Object.keys(mode),
		start: mode.start.length,
		game: Object.keys(mode.game),
		get: Object.keys(mode.get),
		player: Object.keys(mode.element.player),
		content: Object.keys(mode.element.content),
		skill: Object.keys(mode.skill),
		translate: Object.keys(mode.translate),
		help: Object.keys(mode.help),
	});
	const attitudes: Record<string, string> = {};
	for (const modeName of ["normal", "stratagem", "purple"]) {
		status.mode = modeName;
		const identities = modeName === "purple" ? ["rZhu", "rZhong", "rNei", "rYe", "bZhu", "bZhong", "bNei", "bYe"] : ["zhu", "zhong", "fan", "nei", "mingzhong", "commoner"];
		const results: unknown[] = [];
		for (let i = 0; i < 1500; i++) {
			situation = [-3, -1, 0, 1, 3][i % 5];
			strategy = 1 + (i % 6);
			game.players = Array.from(
				{ length: 2 + (i % 7) },
				(_, index): Seat => ({
					identity: identities[(Math.floor(i / (index + 1)) + index) % identities.length],
					isZhu: i % 4 !== 0,
					hp: [-1, 0, 1, 2, 3, 4, 6][(i + index) % 7],
					ai: { shown: ((i + index) % 3) / 2, identity_mark: i % 2 ? "fan" : "zhong", friend: [] },
					countCards: () => (i * 3 + index) % 9,
				})
			);
			game.players[0].identity = identities[0];
			game.zhu = i % 11 === 0 ? undefined : game.players[0];
			const from = game.players[i % game.players.length];
			const to = game.players[(i % 5 === 0 ? i : i + 1) % game.players.length];
			if (i % 4 === 0) from.ai.friend.push(to);
			results.push([mode.get.realAttitude(from, to), from.ai.sizhong]);
		}
		attitudes[modeName] = digest(results);
	}
	return { shape, attitudes, createMode };
}

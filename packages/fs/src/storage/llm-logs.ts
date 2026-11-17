import type Database from "better-sqlite3";

export const MAX_LLM_LOG_ENTRIES = 500;
export const LLM_LOGS_MIGRATION_KEY = "llm_logs_table_v1_migrated";

export interface LLMLogRowSummary {
	id: string;
	gameId: string;
	playerName: string;
	playerSeatNum?: number;
	timestamp: number;
	status: string;
	detailLoaded?: boolean;
	[key: string]: any;
}

export interface LLMLogQueryInput {
	gameId?: string;
	playerSeatNum?: number;
	playerName?: string;
	limit?: number;
}

export interface ActiveCheckpointInput {
	id: string;
	ownerId: string;
	revision: number;
	updatedAt: number;
}

export interface LLMLogSessionSummary {
	gameId: string;
	createdAt: number;
	logCount: number;
	successCount: number;
	lastPlayerName: string;
}

export function ensureLLMLogsSchema(db: Database.Database): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS llm_logs (
			id TEXT PRIMARY KEY,
			game_id TEXT NOT NULL,
			player_name TEXT NOT NULL,
			player_seat_num INTEGER,
			timestamp INTEGER NOT NULL,
			status TEXT NOT NULL,
			summary_json TEXT NOT NULL,
			payload_json TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_llm_logs_game_seat_ts
			ON llm_logs (game_id, player_seat_num, timestamp);
		CREATE INDEX IF NOT EXISTS idx_llm_logs_game_ts
			ON llm_logs (game_id, timestamp);
		CREATE INDEX IF NOT EXISTS idx_llm_logs_ts
			ON llm_logs (timestamp);
	`);
}

interface CodecNodeData {
	type: string;
	value?: any;
	extra?: any;
}

/** Decodes `apps/core/noname/storage/codec.ts` `{ format: 1, root, nodes }` payloads or plain JSON. */
export function decodeLegacyCodecValue(raw: string): any {
	const parsed = JSON.parse(raw);
	if (!parsed || typeof parsed !== "object" || parsed.format !== 1 || !Array.isArray(parsed.nodes) || !("root" in parsed)) {
		return parsed;
	}
	const { root, nodes } = parsed as { root: any; nodes: CodecNodeData[] };
	const objects: any[] = nodes.map(node => {
		switch (node.type) {
			case "object":
				return {};
			case "array":
				return new Array(node.extra);
			case "date":
				return new Date(Number(node.value));
			case "regexp":
				return new RegExp(...(node.value as [string, string]));
			case "map":
				return new Map();
			case "set":
				return new Set();
			case "error":
				return new Error(node.value?.[1] ?? "");
			default:
				return undefined;
		}
	});
	const read = (token: any): any => {
		if (!Array.isArray(token)) return token;
		switch (token[0]) {
			case "undefined":
				return undefined;
			case "bigint":
				return BigInt(token[1]);
			case "number":
				return token[1] === "-0" ? -0 : Number(token[1]);
			case "ref":
				return objects[token[1]];
			default:
				return undefined;
		}
	};
	nodes.forEach((node, index) => {
		if (node.type === "boxed") objects[index] = Object(read(node.value));
	});
	nodes.forEach((node, index) => {
		const object = objects[index];
		if (!object) return;
		if (node.type === "object" || node.type === "array") {
			for (const [key, token] of node.value || []) {
				Object.defineProperty(object, key, { value: read(token), writable: true, enumerable: true, configurable: true });
			}
		} else if (node.type === "map") {
			for (const [key, token] of node.value || []) object.set(read(key), read(token));
		} else if (node.type === "set") {
			for (const token of node.value || []) object.add(read(token));
		} else if (node.type === "error") {
			[object.name, object.message, object.stack, object.cause] = [node.value[0], node.value[1], node.value[2], read(node.value[3])];
		}
	});
	return read(root);
}

export function splitLogEntry(entry: Record<string, any>) {
	const { request, detailLoaded: _detailLoaded, turns, ...rest } = entry;
	const turnRequests: Record<string, any> = {};
	let strippedTurns: any[] | undefined;
	if (Array.isArray(turns)) {
		strippedTurns = turns.map((turn, idx) => {
			if (!turn || typeof turn !== "object") return turn;
			const { request: turnReq, ...turnRest } = turn;
			if (turnReq !== undefined) {
				const key = typeof turn.index === "number" ? String(turn.index) : String(idx);
				turnRequests[key] = turnReq;
			}
			return turnRest;
		});
	}
	const summary: Record<string, any> = {
		...rest,
		...(strippedTurns !== undefined ? { turns: strippedTurns } : {}),
	};
	const payload = {
		...(request !== undefined ? { request } : {}),
		...(Object.keys(turnRequests).length ? { turnRequests } : {}),
	};
	return {
		id: String(entry.id),
		gameId: String(entry.gameId || "game_unknown"),
		playerName: String(entry.playerName || ""),
		playerSeatNum: typeof entry.playerSeatNum === "number" ? entry.playerSeatNum : null,
		timestamp: typeof entry.timestamp === "number" ? entry.timestamp : 0,
		status: String(entry.status || "success"),
		summaryJson: JSON.stringify(summary),
		payloadJson: JSON.stringify(payload),
	};
}

export function mergeLogEntry(summaryJson: string, payloadJson: string): LLMLogRowSummary {
	const summary = JSON.parse(summaryJson) as LLMLogRowSummary;
	const payload = JSON.parse(payloadJson) as { request?: any; turnRequests?: Record<string, any> };
	if (payload.request !== undefined) summary.request = payload.request;
	if (Array.isArray(summary.turns) && payload.turnRequests) {
		summary.turns = summary.turns.map((turn: any, idx: number) => {
			if (!turn || typeof turn !== "object") return turn;
			const key = typeof turn.index === "number" ? String(turn.index) : String(idx);
			if (!Object.hasOwn(payload.turnRequests!, key)) return turn;
			return { ...turn, request: payload.turnRequests![key] };
		});
	}
	return summary;
}

export class LLMLogStorage {
	constructor(
		private readonly db: Database.Database,
		private readonly touchRevision: (namespace: "logs", store: string) => void
	) {}

	sessions(): LLMLogSessionSummary[] {
		return this.db
			.prepare(
				`SELECT
					game_id AS gameId,
					MIN(timestamp) AS createdAt,
					COUNT(*) AS logCount,
					SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successCount,
					(
						SELECT l2.player_name FROM llm_logs l2
						WHERE l2.game_id = llm_logs.game_id
						ORDER BY l2.timestamp DESC, l2.rowid DESC
						LIMIT 1
					) AS lastPlayerName
				FROM llm_logs
				GROUP BY game_id
				ORDER BY createdAt DESC`
			)
			.all() as LLMLogSessionSummary[];
	}

	query(input: LLMLogQueryInput = {}): LLMLogRowSummary[] {
		const conditions: string[] = [];
		const params: any[] = [];
		if (typeof input.gameId === "string" && input.gameId.length > 0) {
			conditions.push("game_id = ?");
			params.push(input.gameId);
		}
		if (typeof input.playerSeatNum === "number") {
			if (typeof input.playerName === "string") {
				conditions.push("(player_seat_num = ? OR (player_seat_num IS NULL AND player_name = ?))");
				params.push(input.playerSeatNum, input.playerName);
			} else {
				conditions.push("player_seat_num = ?");
				params.push(input.playerSeatNum);
			}
		} else if (typeof input.playerName === "string" && input.playerName.length > 0) {
			conditions.push("player_name = ?");
			params.push(input.playerName);
		}
		const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
		const limitClause = typeof input.limit === "number" && input.limit > 0 ? " LIMIT ?" : "";
		if (limitClause) params.push(Math.floor(input.limit!));
		const rows = this.db
			.prepare(`SELECT summary_json FROM llm_logs ${where} ORDER BY timestamp DESC${limitClause}`)
			.all(...params) as { summary_json: string }[];
		return rows.map(row => JSON.parse(row.summary_json) as LLMLogRowSummary);
	}

	getDetail(id: string): LLMLogRowSummary | null {
		if (typeof id !== "string" || !id) return null;
		const row = this.db.prepare("SELECT summary_json, payload_json FROM llm_logs WHERE id = ?").get(id) as { summary_json: string; payload_json: string } | undefined;
		if (!row) return null;
		return mergeLogEntry(row.summary_json, row.payload_json);
	}

	put(entry: Record<string, any>, keep = MAX_LLM_LOG_ENTRIES): { committed: true } {
		this.upsertEntry(entry);
		this.prune(keep);
		return { committed: true };
	}

	finalize(input: { active: ActiveCheckpointInput; entry: Record<string, any>; mode?: "finalize" | "recover" }, keep = MAX_LLM_LOG_ENTRIES): { finalized: boolean } {
		const { active, entry, mode = "finalize" } = input;
		if (!active || !entry || typeof active.id !== "string" || typeof entry.id !== "string" || active.id !== entry.id) {
			throw new Error("Completed LLM log id does not match its active checkpoint");
		}
		const completedExists = !!this.db.prepare("SELECT 1 FROM llm_logs WHERE id = ?").get(entry.id);
		const encodedKey = JSON.stringify(["string", active.id]);
		const activeRow = this.db
			.prepare("SELECT value FROM records WHERE namespace = 'logs' AND store = 'llm_log_active' AND key IN (?, ?)")
			.get(encodedKey, active.id) as { value: Buffer } | undefined;
		const current = activeRow ? (decodeLegacyCodecValue(activeRow.value.toString("utf8")) as { ownerId?: string; revision?: number } | undefined) : undefined;
		const canCommit =
			mode === "recover"
				? !completedExists && !!current && current.ownerId === active.ownerId && (current.revision ?? 0) === (active.revision ?? 0)
				: !completedExists && !!current && current.ownerId === active.ownerId && (current.revision ?? 0) === (active.revision ?? 0);
		if (!canCommit) return { finalized: false };
		this.upsertEntry(entry);
		this.db.prepare("DELETE FROM records WHERE namespace = 'logs' AND store = 'llm_log_active' AND key IN (?, ?)").run(encodedKey, active.id);
		this.touchRevision("logs", "llm_log_active");
		this.prune(keep);
		return { finalized: true };
	}

	pruneEntries(keep = MAX_LLM_LOG_ENTRIES): { removed: number } {
		const info = this.db
			.prepare("DELETE FROM llm_logs WHERE id IN (SELECT id FROM llm_logs ORDER BY timestamp DESC LIMIT -1 OFFSET ?)")
			.run(Math.max(0, keep));
		return { removed: info.changes };
	}

	clear(): { committed: true } {
		this.db.prepare("DELETE FROM llm_logs").run();
		return { committed: true };
	}

	private upsertEntry(entry: Record<string, any>): void {
		const row = splitLogEntry(entry);
		this.db
			.prepare(
				`INSERT INTO llm_logs (id, game_id, player_name, player_seat_num, timestamp, status, summary_json, payload_json)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(id) DO UPDATE SET
					game_id = excluded.game_id,
					player_name = excluded.player_name,
					player_seat_num = excluded.player_seat_num,
					timestamp = excluded.timestamp,
					status = excluded.status,
					summary_json = excluded.summary_json,
					payload_json = excluded.payload_json`
			)
			.run(row.id, row.gameId, row.playerName, row.playerSeatNum, row.timestamp, row.status, row.summaryJson, row.payloadJson);
	}

	private prune(keep = MAX_LLM_LOG_ENTRIES): void {
		this.db.prepare("DELETE FROM llm_logs WHERE id IN (SELECT id FROM llm_logs ORDER BY timestamp DESC LIMIT -1 OFFSET ?)").run(keep);
	}
}

import Database from "better-sqlite3";
import { pathToFileURL } from "node:url";
import { databasePath } from "./routes";
import { decodeLegacyCodecValue, ensureLLMLogsSchema, LLM_LOGS_MIGRATION_KEY, MAX_LLM_LOG_ENTRIES, splitLogEntry } from "./llm-logs";

export interface LLMLogsMigrationOptions {
	keep?: number;
	vacuum?: boolean;
}

export interface LLMLogsMigrationResult {
	migrated: number;
	totalLegacyRows: number;
	skipped: boolean;
}

/** Migrates legacy codec-encoded `logs/llm_logs` rows from `records` into `llm_logs`. */
export function migrateLegacyLLMLogs(db: Database.Database, options: LLMLogsMigrationOptions = {}): LLMLogsMigrationResult {
	ensureLLMLogsSchema(db);
	const keep = options.keep ?? MAX_LLM_LOG_ENTRIES;
	const result = db
		.transaction((): LLMLogsMigrationResult => {
			const legacyRows = db
				.prepare("SELECT key, value FROM records WHERE namespace = 'logs' AND store = 'llm_logs'")
				.all() as { key: string; value: Buffer }[];
			if (!legacyRows.length) {
				db.prepare("INSERT OR IGNORE INTO metadata (key, value) VALUES (?, ?)").run(
					LLM_LOGS_MIGRATION_KEY,
					JSON.stringify({ at: Date.now(), migrated: 0 })
				);
				return { migrated: 0, totalLegacyRows: 0, skipped: true };
			}
			const decoded: Record<string, any>[] = [];
			for (const row of legacyRows) {
				try {
					const entry = decodeLegacyCodecValue(row.value.toString("utf8"));
					if (entry && typeof entry === "object" && typeof entry.id === "string" && typeof entry.timestamp === "number") {
						decoded.push(entry);
					}
				} catch {
					// Skip corrupted legacy records rather than aborting migration.
				}
			}
			decoded.sort((a, b) => b.timestamp - a.timestamp);
			const retained = decoded.slice(0, Math.max(0, keep));
			const insertStmt = db.prepare(
				`INSERT OR IGNORE INTO llm_logs (id, game_id, player_name, player_seat_num, timestamp, status, summary_json, payload_json)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			);
			let migrated = 0;
			for (const entry of retained) {
				const split = splitLogEntry(entry);
				const info = insertStmt.run(
					split.id,
					split.gameId,
					split.playerName,
					split.playerSeatNum,
					split.timestamp,
					split.status,
					split.summaryJson,
					split.payloadJson
				);
				migrated += info.changes;
			}
			db.prepare("DELETE FROM records WHERE namespace = 'logs' AND store = 'llm_logs'").run();
			db.prepare("INSERT INTO revisions VALUES ('logs', 'llm_logs', 1) ON CONFLICT(namespace, store) DO UPDATE SET revision = revision + 1").run();
			db.prepare("INSERT INTO metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
				LLM_LOGS_MIGRATION_KEY,
				JSON.stringify({ at: Date.now(), migrated, totalLegacyRows: legacyRows.length })
			);
			return { migrated, totalLegacyRows: legacyRows.length, skipped: false };
		})
		.immediate();

	if (options.vacuum) {
		db.pragma("wal_checkpoint(TRUNCATE)");
		db.exec("VACUUM");
		db.pragma("wal_checkpoint(TRUNCATE)");
	}
	return result;
}

function parseCliArgs(argv: string[]): { dbPath: string; vacuum: boolean } {
	let dbPath = databasePath(process.cwd());
	let vacuum = true;
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--db" && argv[i + 1]) {
			dbPath = argv[++i];
		} else if (arg === "--no-vacuum") {
			vacuum = false;
		}
	}
	return { dbPath, vacuum };
}

const isEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntrypoint) {
	const { dbPath, vacuum } = parseCliArgs(process.argv.slice(2));
	const db = new Database(dbPath, { timeout: 10000 });
	try {
		db.pragma("journal_mode = WAL");
		const result = migrateLegacyLLMLogs(db, { vacuum });
		console.log(JSON.stringify({ dbPath, vacuum, ...result }));
	} finally {
		db.close();
	}
}

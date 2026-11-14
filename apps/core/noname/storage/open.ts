import { SqliteDatabase, transaction, type PersistenceDatabase } from "./database.js";
import { migrateIndexedDB } from "./migration.js";
import { StorageTransport, showStorageFailure } from "./transport.js";
import { createRetryingDatabaseResolver, llmLogDatabaseName, openLLMLogDatabase, openMainDatabase } from "../init/database-schema.js";

export let storageInitializing = false;

export function usesSqliteStorage() {
	return !(typeof window.require === "function" || typeof window.cordova !== "undefined" || typeof window.NonameAndroidBridge !== "undefined" || typeof window.noname_shijianInterfaces !== "undefined");
}

export async function openPersistence(prefix: string): Promise<{ main: PersistenceDatabase; logs: () => Promise<PersistenceDatabase> }> {
	if (!usesSqliteStorage()) {
		const main = await openMainDatabase(window.indexedDB, `${prefix}data`);
		main.onversionchange = () => {
			main.close();
			console.warn("数据库已在其他窗口升级，请刷新游戏");
		};
		return { main, logs: createRetryingDatabaseResolver(() => openLLMLogDatabase(window.indexedDB, llmLogDatabaseName(main.name))) };
	}
	const transport = new StorageTransport();
	storageInitializing = true;
	while (true) {
		try {
			await migrateIndexedDB(transport, window.indexedDB, prefix, location.origin);
			break;
		} catch (error) {
			await showStorageFailure(error instanceof Error ? error : new Error(String(error)));
		}
	}
	storageInitializing = false;
	const logs = new SqliteDatabase(transport, "logs");
	return { main: new SqliteDatabase(transport, "main"), logs: async () => logs };
}

export async function resetSqliteMain(): Promise<void> {
	const transport = new StorageTransport();
	if (!(await transport.request({ action: "status" })).initialized) return;
	const main = new SqliteDatabase(transport, "main");
	await transaction(main, ["config", "data", "video", "image", "audio"], "readwrite", async operation => {
		for (const store of ["config", "data", "video", "image", "audio"]) await operation.objectStore(store).clear();
	});
}

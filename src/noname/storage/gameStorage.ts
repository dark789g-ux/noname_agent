import type { SqliteDatabase } from "./database.js";
import { showStorageFailure } from "./transport.js";

/** Keep reload barriers and legacy callback signatures, but only signal success after SQLite commits. */
export async function sqliteGameOperation(database: SqliteDatabase, action: "get" | "put" | "delete", store: string, key: IDBValidKey | null | undefined, value: unknown, onSuccess: Function | undefined, onError: Function | undefined, context: { lib: { status: { reload: number } }; game: { reload2(): void }; status: { dburgent?: boolean } }): Promise<any> {
	const { lib, game, status } = context;
	lib.status.reload++;
	try {
		let result: any;
		while (true) {
			try {
				if (action === "get") result = key == null ? Object.fromEntries((await database.entries(store)).map(row => [String(row.key), row.value])) : await database.get(store, key);
				else if (action === "put") result = await database.put(store, value, key ?? undefined);
				else result = await database.delete(store, key ?? undefined);
				break;
			} catch (error) {
				try {
					onError?.(error);
				} catch (callbackError) {
					console.error(callbackError);
				}
				await showStorageFailure(error instanceof Error ? error : new Error(String(error)));
			}
		}
		if (action !== "get") {
			const event = new Event("success");
			Object.defineProperty(event, "target", { value: { result } });
			result = event;
		}
		status.dburgent = true;
		try {
			onSuccess?.(result);
		} catch (error) {
			console.error(`[${action}DB] callback threw`, error);
		} finally {
			delete status.dburgent;
		}
		return result;
	} finally {
		game.reload2();
	}
}

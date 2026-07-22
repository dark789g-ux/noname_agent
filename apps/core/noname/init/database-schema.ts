/** Creates only the stores required by the main configuration database. */
export function upgradeMainDatabase(database: IDBDatabase): void {
	if (!database.objectStoreNames.contains("video")) {
		database.createObjectStore("video", { keyPath: "time" });
	}
	if (!database.objectStoreNames.contains("image")) {
		database.createObjectStore("image");
	}
	if (!database.objectStoreNames.contains("audio")) {
		database.createObjectStore("audio");
	}
	if (!database.objectStoreNames.contains("config")) {
		database.createObjectStore("config");
	}
	if (!database.objectStoreNames.contains("data")) {
		database.createObjectStore("data");
	}
}

export function upgradeLLMLogDatabase(database: IDBDatabase): void {
	if (!database.objectStoreNames.contains("llm_logs")) {
		const store = database.createObjectStore("llm_logs", { keyPath: "id" });
		store.createIndex("timestamp", "timestamp");
		store.createIndex("gameId", "gameId");
		store.createIndex("gameId_playerSeatNum", ["gameId", "playerSeatNum"]);
		store.createIndex("status", "status");
	}
	if (!database.objectStoreNames.contains("llm_log_active")) {
		const store = database.createObjectStore("llm_log_active", { keyPath: "id" });
		store.createIndex("ownerId", "ownerId");
		store.createIndex("updatedAt", "updatedAt");
		store.createIndex("deadlineAt", "deadlineAt");
	}
	if (!database.objectStoreNames.contains("llm_log_instances")) {
		const store = database.createObjectStore("llm_log_instances", { keyPath: "instanceId" });
		store.createIndex("expiresAt", "expiresAt");
	}
}

export function llmLogDatabaseName(mainDatabaseName: string): string {
	return `${mainDatabaseName}_llm_logs`;
}

export function openMainDatabase(factory: IDBFactory, name: string): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		// Deliberately omit a version so an older tab cannot block startup with a
		// versionchange handshake. Existing v4/v5 databases both remain readable.
		const openRequest = factory.open(name);
		openRequest.onerror = () => reject(openRequest.error || new Error("Unable to open main database"));
		openRequest.onsuccess = () => resolve(openRequest.result);
		openRequest.onupgradeneeded = () => upgradeMainDatabase(openRequest.result);
	});
}

export function openLLMLogDatabase(factory: IDBFactory, name: string): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		// No explicit version: a future schema must not block startup merely because
		// another tab holds an older connection. Current fresh databases start at v1.
		const openRequest = factory.open(name);
		openRequest.onerror = () => reject(openRequest.error || new Error("Unable to open LLM log database"));
		openRequest.onsuccess = () => {
			const database = openRequest.result;
			database.onversionchange = () => database.close();
			resolve(database);
		};
		openRequest.onupgradeneeded = () => upgradeLLMLogDatabase(openRequest.result);
	});
}

/** Caches only successful opens so a transient failure can be retried later. */
export function createRetryingDatabaseResolver<T>(open: () => Promise<T>): () => Promise<T> {
	let database: T | undefined;
	let resolved = false;
	let opening: Promise<T> | undefined;
	return () => {
		if (resolved) return Promise.resolve(database!);
		if (!opening) {
			opening = open()
				.then(result => {
					database = result;
					resolved = true;
					return result;
				})
				.finally(() => {
					opening = undefined;
				});
		}
		return opening;
	};
}

function upgradeMainDatabase(database) {
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
function upgradeLLMLogDatabase(database) {
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
function llmLogDatabaseName(mainDatabaseName) {
  return `${mainDatabaseName}_llm_logs`;
}
function openMainDatabase(factory, name) {
  return new Promise((resolve, reject) => {
    const openRequest = factory.open(name);
    openRequest.onerror = () => reject(openRequest.error || new Error("Unable to open main database"));
    openRequest.onsuccess = () => resolve(openRequest.result);
    openRequest.onupgradeneeded = () => upgradeMainDatabase(openRequest.result);
  });
}
function openLLMLogDatabase(factory, name) {
  return new Promise((resolve, reject) => {
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
function createRetryingDatabaseResolver(open) {
  let database;
  let resolved = false;
  let opening;
  return () => {
    if (resolved) return Promise.resolve(database);
    if (!opening) {
      opening = open().then((result) => {
        database = result;
        resolved = true;
        return result;
      }).finally(() => {
        opening = void 0;
      });
    }
    return opening;
  };
}
export {
  createRetryingDatabaseResolver,
  llmLogDatabaseName,
  openLLMLogDatabase,
  openMainDatabase,
  upgradeLLMLogDatabase,
  upgradeMainDatabase
};

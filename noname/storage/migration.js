import { encode, encodeKey } from "./codec.js";
async function existingDatabase(factory, name) {
  return new Promise((resolve, reject) => {
    let missing = false;
    const opening = factory.open(name);
    opening.onupgradeneeded = () => {
      missing = true;
      opening.transaction.abort();
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => missing ? resolve(void 0) : reject(opening.error);
    opening.onblocked = () => reject(new Error("旧数据库正在升级，请关闭其他游戏页面后重试"));
  });
}
async function snapshot(database) {
  const stores = [...database.objectStoreNames];
  if (!stores.length) return [];
  return new Promise((resolve, reject) => {
    const records = [];
    const reading = database.transaction(stores, "readonly");
    reading.oncomplete = () => resolve(records);
    reading.onerror = reading.onabort = () => reject(reading.error || new Error("旧数据库读取失败"));
    for (const store of stores) {
      const cursor = reading.objectStore(store).openCursor();
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (row) {
          records.push({ store, key: row.key, value: row.value });
          row.continue();
        }
      };
    }
  });
}
async function migrateIndexedDB(transport, factory, prefix, source) {
  const status = await transport.request({ action: "status" });
  if (status.initialized) return;
  const { token } = await transport.request({ action: "migration-start" });
  if (factory) {
    for (const [namespace, name] of [
      ["main", `${prefix}data`],
      ["logs", `${prefix}data_llm_logs`]
    ]) {
      const database = await existingDatabase(factory, name);
      if (!database) continue;
      let records;
      try {
        records = await snapshot(database);
      } finally {
        database.close();
      }
      for (const row of records) {
        await transport.request({ action: "migration-stage", token, records: [{ namespace, store: row.store, key: encodeKey(row.key), value: await encode(row.value) }] });
      }
    }
  }
  await transport.request({ action: "migration-finish", token, source });
}
export {
  migrateIndexedDB
};

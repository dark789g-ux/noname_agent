import { encodeKey, decode, decodeKey, compareKeys, encode } from "./codec.js";
import { StorageConflict, showStorageFailure } from "./transport.js";
import { SnapshotStore } from "./transactionStore.js";
const mainStores = ["config", "data", "video", "image", "audio", "llm_logs", "llm_log_active", "llm_log_instances"];
const logStores = ["llm_logs", "llm_log_active", "llm_log_instances"];
function request(operation) {
  if (operation instanceof Promise) return operation;
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error || new Error("数据库请求失败"));
  });
}
function recordKey(store, value, key) {
  return key ?? value?.[store === "video" ? "time" : store === "llm_log_instances" ? "instanceId" : "id"];
}
class SqliteDatabase {
  constructor(transport, namespace) {
    this.transport = transport;
    this.namespace = namespace;
    this.name = namespace === "main" ? "noname.sqlite" : "noname.sqlite/logs";
    const names = [...namespace === "main" ? mainStores : logStores];
    this.objectStoreNames = Object.assign(names, { contains: (name) => names.includes(name) });
  }
  queue = Promise.resolve();
  backend = "sqlite";
  name;
  objectStoreNames;
  async get(store, key) {
    if (this.namespace === "logs" && store === "llm_logs") {
      return await this.llmLogsGetDetail(String(key)) ?? void 0;
    }
    await this.queue;
    const result = await this.transport.request({ action: "get", namespace: this.namespace, store, key: encodeKey(key) });
    return result.value === null ? void 0 : decode(result.value);
  }
  async entries(store) {
    await this.queue;
    const rows = await this.transport.request({ action: "entries", namespace: this.namespace, store });
    return rows.map((row) => ({ key: decodeKey(row.key), value: decode(row.value) })).sort((a, b) => compareKeys(a.key, b.key));
  }
  async put(store, value, key) {
    const clone = structuredClone(value);
    const resolvedKey = recordKey(store, clone, key);
    const encodedKey = encodeKey(resolvedKey);
    return this.enqueue(async () => {
      await this.transport.request({ action: "put", namespace: this.namespace, store, key: encodedKey, value: await encode(clone) });
      return resolvedKey;
    });
  }
  async delete(store, key) {
    await this.enqueue(() => this.transport.request({ action: key === void 0 ? "clear" : "delete", namespace: this.namespace, store, ...key === void 0 ? {} : { key: encodeKey(key) } }));
  }
  enqueue(operation) {
    const result = this.queue.then(operation);
    this.queue = result.then(
      () => {
      },
      () => {
      }
    );
    return result;
  }
  run(stores, mode, operation) {
    return this.enqueue(() => this.runTransaction(stores, mode, operation));
  }
  /** Read-only LLM log RPCs bypass the client write queue so WAL reads never stall behind checkpoints. */
  llmLogsSessions() {
    return this.transport.request({ action: "llm_logs_sessions", namespace: this.namespace });
  }
  llmLogsQuery(query = {}) {
    return this.transport.request({ action: "llm_logs_query", namespace: this.namespace, ...query });
  }
  async llmLogsGetDetail(logId) {
    const res = await this.transport.request({ action: "llm_logs_get_detail", namespace: this.namespace, logId });
    return res.entry;
  }
  llmLogsPut(entry) {
    return this.enqueue(async () => {
      await this.transport.request({ action: "llm_logs_put", namespace: this.namespace, entry });
    });
  }
  llmLogsFinalize(active, entry, mode = "finalize") {
    return this.enqueue(async () => {
      const res = await this.transport.request({ action: "llm_logs_finalize", namespace: this.namespace, active, entry, mode });
      return res.finalized;
    });
  }
  llmLogsClear() {
    return this.enqueue(async () => {
      await this.transport.request({ action: "llm_logs_clear", namespace: this.namespace });
    });
  }
  llmLogsPrune(keep = 500) {
    return this.enqueue(async () => {
      const res = await this.transport.request({ action: "llm_logs_prune", namespace: this.namespace, keep });
      return res.removed;
    });
  }
  /** Optimistic transactions rerun their isolated callback when another page changes a read dependency. */
  async runTransaction(stores, mode, operation) {
    for (let attempt = 0; ; attempt++) {
      try {
        const snapshot = await this.transport.request({ action: "snapshot", namespace: this.namespace, stores, includeEntries: false });
        const pending = [];
        const opened = /* @__PURE__ */ new Map();
        const objectStore = (store) => {
          if (!stores.includes(store)) throw new Error(`数据表不在事务范围内：${store}`);
          if (!opened.has(store)) opened.set(store, new SnapshotStore(store, mode, (action, key) => this.transport.request({ action, namespace: this.namespace, store, key, revision: snapshot[store].revision }), pending));
          return opened.get(store);
        };
        const result = await operation({ objectStore });
        if (mode === "readonly" || !pending.length) return result;
        const changes = [];
        for (const change of pending) changes.push({ ...change, ...change.action === "put" ? { value: await encode(change.value) } : {} });
        await this.transport.request({ action: "commit", namespace: this.namespace, revisions: Object.fromEntries(stores.map((name) => [name, snapshot[name].revision])), changes });
        return result;
      } catch (error) {
        if (!(error instanceof StorageConflict)) throw error;
        if (attempt && attempt % 8 === 0) {
          if (this.namespace === "logs") throw error;
          await showStorageFailure(error);
        }
      }
    }
  }
}
function transaction(database, stores, mode, operation) {
  if (database instanceof SqliteDatabase) return database.run(stores, mode, operation);
  return new Promise((resolve, reject) => {
    const native = database.transaction(stores, mode);
    let result;
    let failure;
    native.oncomplete = () => resolve(result);
    native.onerror = native.onabort = () => reject(failure || native.error || new Error("数据库事务失败"));
    const objectStore = (name) => {
      const store = native.objectStore(name);
      return {
        get: (key) => request(store.get(key)),
        getAll: (query) => request(store.getAll(query)),
        put: (value, key) => request(store.put(value, key)),
        delete: (key) => request(store.delete(key)),
        clear: () => request(store.clear()),
        count: () => request(store.count()),
        index: (field) => ({ getAll: (query) => request(store.index(field).getAll(query)) })
      };
    };
    operation({ objectStore }).then((value) => {
      result = value;
    }).catch((error) => {
      failure = error;
      try {
        native.abort();
      } catch {
        reject(error);
      }
    });
  });
}
export {
  SqliteDatabase,
  request,
  transaction
};

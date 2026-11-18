import { decode, encodeKey, compareKeys, decodeKey } from "./codec.js";
class SnapshotStore {
  constructor(name, mode, read, changes) {
    this.name = name;
    this.mode = mode;
    this.read = read;
    this.changes = changes;
  }
  values = /* @__PURE__ */ new Map();
  originalPresence = /* @__PURE__ */ new Map();
  loaded = false;
  cleared = false;
  async load(key) {
    if (this.loaded || this.originalPresence.has(key)) return;
    const { value } = await this.read("get", key);
    this.originalPresence.set(key, value !== null);
    if (value !== null) this.values.set(key, decode(value));
  }
  write(change) {
    if (this.mode === "readonly") throw new DOMException("只读事务不可修改数据", "ReadOnlyError");
    this.changes.push({ ...change, store: this.name });
  }
  async get(key) {
    const token = encodeKey(key);
    await this.load(token);
    return structuredClone(this.values.get(token));
  }
  async getAll(query) {
    if (query !== void 0) {
      const token = encodeKey(query);
      await this.load(token);
      return this.values.has(token) ? [structuredClone(this.values.get(token))] : [];
    }
    if (!this.loaded) {
      const entries = await this.read("entries");
      for (const row of entries) {
        if (!this.originalPresence.has(row.key)) this.values.set(row.key, decode(row.value));
      }
      this.loaded = true;
    }
    return [...this.values].sort(([left], [right]) => compareKeys(decodeKey(left), decodeKey(right))).map(([, value]) => structuredClone(value));
  }
  async count() {
    if (this.loaded || this.cleared) return this.values.size;
    let count = await this.read("count");
    for (const [key, existed] of this.originalPresence) count += Number(this.values.has(key)) - Number(existed);
    return count;
  }
  async put(value, key) {
    const clone = structuredClone(value);
    const resolvedKey = key ?? clone?.[this.name === "video" ? "time" : this.name === "llm_log_instances" ? "instanceId" : "id"];
    const token = encodeKey(resolvedKey);
    await this.load(token);
    this.write({ action: "put", key: token, value: clone });
    this.values.set(token, clone);
    return resolvedKey;
  }
  async delete(key) {
    const token = encodeKey(key);
    await this.load(token);
    this.write({ action: "delete", key: token });
    this.values.delete(token);
  }
  async clear() {
    this.write({ action: "clear" });
    this.cleared = true;
    this.loaded = true;
    this.values.clear();
  }
  index(name) {
    return { getAll: async (query) => (await this.getAll()).filter((value) => value[name] !== void 0 && (query === void 0 || encodeKey(value[name]) === encodeKey(query))) };
  }
}
export {
  SnapshotStore
};

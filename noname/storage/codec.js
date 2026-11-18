function base64(bytes2) {
  let binary = "";
  for (let offset = 0; offset < bytes2.length; offset += 8192) binary += String.fromCharCode(...bytes2.subarray(offset, offset + 8192));
  return btoa(binary);
}
function bytes(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
const viewTypes = new Map([Uint8Array, Uint8ClampedArray, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array, DataView].map((type) => [type.name, type]));
async function encode(value) {
  const nodes = [];
  const seen = /* @__PURE__ */ new Map();
  async function visit(current) {
    if (current === void 0) return ["undefined"];
    if (typeof current === "bigint") return ["bigint", String(current)];
    if (typeof current === "number" && (!Number.isFinite(current) || Object.is(current, -0))) return ["number", Object.is(current, -0) ? "-0" : String(current)];
    if (current === null || ["boolean", "string", "number"].includes(typeof current)) return current;
    if (typeof current !== "object") throw new DOMException("该值不能保存到数据库", "DataCloneError");
    if (seen.has(current)) return ["ref", seen.get(current)];
    const index = nodes.length;
    seen.set(current, index);
    const node = { type: "object" };
    nodes.push(node);
    if (current instanceof Blob) {
      node.type = typeof File !== "undefined" && current instanceof File ? "file" : "blob";
      node.value = base64(new Uint8Array(await current.arrayBuffer()));
      node.extra = { type: current.type, name: current instanceof File ? current.name : void 0, lastModified: current instanceof File ? current.lastModified : void 0 };
    } else if (current instanceof ArrayBuffer) {
      node.type = "buffer";
      node.value = base64(new Uint8Array(current));
    } else if (ArrayBuffer.isView(current)) {
      node.type = "view";
      node.value = await visit(current.buffer);
      node.extra = [current.constructor.name, current.byteOffset, current instanceof DataView ? current.byteLength : current.length];
    } else if (current instanceof Date) {
      node.type = "date";
      node.value = String(current.getTime());
    } else if (current instanceof RegExp) {
      node.type = "regexp";
      node.value = [current.source, current.flags];
    } else if (current instanceof Map) {
      node.type = "map";
      node.value = [];
      for (const [key, item] of current) node.value.push([await visit(key), await visit(item)]);
    } else if (current instanceof Set) {
      node.type = "set";
      node.value = [];
      for (const item of current) node.value.push(await visit(item));
    } else if (current instanceof Error) {
      node.type = "error";
      node.value = [current.name, current.message, current.stack, await visit(current.cause)];
    } else if (["[object Boolean]", "[object Number]", "[object String]", "[object BigInt]"].includes(Object.prototype.toString.call(current))) {
      node.type = "boxed";
      node.value = await visit(current.valueOf());
    } else {
      if (!Array.isArray(current) && ![Object.prototype, null].includes(Object.getPrototypeOf(current))) throw new DOMException(`无法无损保存该数据类型：${Object.prototype.toString.call(current)}`, "DataCloneError");
      if (Array.isArray(current)) {
        node.type = "array";
        node.extra = current.length;
      }
      node.value = [];
      for (const key of Object.keys(current)) node.value.push([key, await visit(current[key])]);
    }
    return ["ref", index];
  }
  const root = await visit(value);
  return JSON.stringify({ format: 1, root, nodes });
}
function decode(serialized) {
  const { format, root, nodes } = JSON.parse(serialized);
  if (format !== 1 || !Array.isArray(nodes)) throw new Error("无法识别的数据库内容格式");
  const objects = nodes.map((node) => {
    switch (node.type) {
      case "object":
        return {};
      case "array":
        return new Array(node.extra);
      case "buffer":
        return bytes(node.value).buffer;
      case "blob":
        return new Blob([bytes(node.value)], { type: node.extra.type });
      case "file":
        return new File([bytes(node.value)], node.extra.name, node.extra);
      case "date":
        return new Date(Number(node.value));
      case "regexp":
        return new RegExp(...node.value);
      case "map":
        return /* @__PURE__ */ new Map();
      case "set":
        return /* @__PURE__ */ new Set();
      case "error":
        return new Error(node.value[1]);
      case "view":
      case "boxed":
        return null;
      default:
        throw new Error(`无法识别的数据类型：${node.type}`);
    }
  });
  function read(token) {
    if (!Array.isArray(token)) return token;
    switch (token[0]) {
      case "undefined":
        return void 0;
      case "bigint":
        return BigInt(token[1]);
      case "number":
        return token[1] === "-0" ? -0 : Number(token[1]);
      case "ref":
        return objects[token[1]];
      default:
        throw new Error("无效的数据引用");
    }
  }
  nodes.forEach((node, index) => {
    if (node.type === "boxed") {
      objects[index] = Object(read(node.value));
      return;
    }
    if (node.type !== "view") return;
    const Constructor = viewTypes.get(node.extra[0]);
    if (!Constructor) throw new Error("无法识别的二进制视图");
    objects[index] = new Constructor(read(node.value), node.extra[1], node.extra[2]);
  });
  nodes.forEach((node, index) => {
    const object = objects[index];
    if (node.type === "object" || node.type === "array") {
      for (const [key, token] of node.value) Object.defineProperty(object, key, { value: read(token), writable: true, enumerable: true, configurable: true });
    } else if (node.type === "map") {
      for (const [key, token] of node.value) object.set(read(key), read(token));
    } else if (node.type === "set") {
      for (const token of node.value) object.add(read(token));
    } else if (node.type === "error") {
      [object.name, object.message, object.stack, object.cause] = [node.value[0], node.value[1], node.value[2], read(node.value[3])];
    }
  });
  return read(root);
}
function encodeKey(key) {
  if (typeof key === "string") return JSON.stringify(["string", key]);
  if (typeof key === "number" && !Number.isNaN(key)) return JSON.stringify(["number", key === Infinity ? "Infinity" : key === -Infinity ? "-Infinity" : key]);
  if (key instanceof Date && !Number.isNaN(key.getTime())) return JSON.stringify(["date", key.getTime()]);
  if (key instanceof ArrayBuffer || ArrayBuffer.isView(key)) return JSON.stringify(["binary", base64(key instanceof ArrayBuffer ? new Uint8Array(key) : new Uint8Array(key.buffer, key.byteOffset, key.byteLength))]);
  if (Array.isArray(key)) return JSON.stringify(["array", key.map((item) => JSON.parse(encodeKey(item)))]);
  throw new DOMException("无效的数据库记录键", "DataError");
}
function decodeKey(key) {
  const [type, value] = JSON.parse(key);
  if (type === "date") return new Date(value);
  if (type === "binary") return bytes(value).buffer;
  if (type === "array") return value.map((item) => decodeKey(JSON.stringify(item)));
  return type === "number" ? Number(value) : value;
}
function compareKeys(left, right) {
  if (globalThis.indexedDB) return indexedDB.cmp(left, right);
  const rank = (key) => typeof key === "number" ? 0 : key instanceof Date ? 1 : typeof key === "string" ? 2 : Array.isArray(key) ? 4 : 3;
  if (rank(left) !== rank(right)) return rank(left) - rank(right);
  if (left instanceof Date && right instanceof Date) return compareKeys(left.getTime(), right.getTime());
  if (rank(left) >= 3) {
    const array = (key) => Array.isArray(key) ? key : Array.from(key instanceof ArrayBuffer ? new Uint8Array(key) : new Uint8Array(key.buffer, key.byteOffset, key.byteLength));
    const first = array(left), second = array(right);
    for (let index = 0; index < Math.min(first.length, second.length); index++) {
      const comparison = compareKeys(first[index], second[index]);
      if (comparison) return comparison;
    }
    return first.length - second.length;
  }
  return left < right ? -1 : left > right ? 1 : 0;
}
export {
  compareKeys,
  decode,
  decodeKey,
  encode,
  encodeKey
};

import "../../../../../../../../noname.js";
import "../../../../../../../util/sandbox.js";
import { ui } from "../../../../../../index.js";
import { security } from "../../../../../../../util/sandbox/security.js";
import { get } from "../../../../../../../get/binding.js";
function parseEntityName(raw) {
  if (!raw) return null;
  const parts = raw.split("|");
  const id = parts[0];
  const translate = parts[1] || id;
  return { id, translate };
}
function hasEntityIdConflict(id, editingOldId, globalMap, packMap) {
  if (editingOldId !== null && editingOldId === id) {
    return false;
  }
  return Boolean(globalMap[id] || packMap[id]);
}
function readImageAsDataUrlAndBuffer(file) {
  return new Promise((resolve, reject) => {
    const dataUrlReader = new FileReader();
    dataUrlReader.onerror = reject;
    dataUrlReader.onload = (e) => {
      const dataUrl = String(e.target?.result || "");
      const bufReader = new FileReader();
      bufReader.onerror = reject;
      bufReader.onload = (e2) => {
        resolve({ dataUrl, buffer: e2.target?.result });
      };
      bufReader.readAsArrayBuffer(file);
    };
    dataUrlReader.readAsDataURL(file);
  });
}
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => resolve(e.target?.result);
    reader.readAsArrayBuffer(file);
  });
}
function openValidatedCodeEditor(initialValue, validate, onSave) {
  ui.create.editor({
    language: "javascript",
    value: initialValue,
    saveInput: (result) => {
      validate(result);
      onSave(result);
    }
  });
}
function validateNamedObjectCode(varName, result) {
  const parsed = security.exec2(result);
  const target = parsed?.[varName];
  if (target == null || typeof target !== "object") {
    throw new Error("代码格式有错误，请对比示例代码仔细检查");
  }
  return target;
}
function serializeSkillToCode(skillInfo) {
  const obj = Object.defineProperty(get.copy(skillInfo), "_priority", {
    enumerable: false,
    writable: true,
    configurable: true
  });
  let str = "{\n";
  const indent = "    ";
  for (const key in obj) {
    const descriptor = Object.getOwnPropertyDescriptor(obj, key);
    if (descriptor?.get || descriptor?.set) {
      if (descriptor.get) str += `${indent}${get.stringify(descriptor.get, 1)},
`;
      if (descriptor.set) str += `${indent}${get.stringify(descriptor.set, 1)},
`;
    } else {
      let keyString = (/[^a-zA-Z]/.test(key) ? `"${key}"` : key) + ": ";
      if (get.is.functionMethod(obj, key)) keyString = "";
      str += `${indent}${keyString}${get.stringify(obj[key], 1)},
`;
    }
  }
  for (const symbol of Object.getOwnPropertySymbols(obj)) {
    str += `${indent}[${String(symbol)}]: ${get.stringify(obj[symbol], 1)},
`;
  }
  str += "}";
  return `skill=${str}`;
}
export {
  hasEntityIdConflict,
  openValidatedCodeEditor,
  parseEntityName,
  readFileAsArrayBuffer,
  readImageAsDataUrlAndBuffer,
  serializeSkillToCode,
  validateNamedObjectCode
};

const errors = [];
const disabledExtensions = [];
function record(input) {
  const entry = {
    ...input,
    timestamp: Date.now()
  };
  errors.push(entry);
  const e = input.error;
  const desc = e instanceof Error ? e.stack : String(e);
  const msg = "[loadErrors:" + input.stage + "]" + (input.name ? " 「" + input.name + "」" : "") + ": " + desc;
  console.error(msg, e);
}
function recordDisabledExtension(name) {
  if (!disabledExtensions.includes(name)) {
    disabledExtensions.push(name);
  }
}
function getAll() {
  return errors;
}
function getDisabledExtensions() {
  return disabledExtensions;
}
function hasErrors() {
  return errors.length > 0;
}
function summarize() {
  if (errors.length === 0) return "";
  const lines = [];
  const count = Math.min(errors.length, 10);
  for (let i = 0; i < count; i++) {
    const err = errors[i];
    let shortDesc;
    if (err.error instanceof Error) {
      shortDesc = err.error.message || String(err.error);
    } else {
      shortDesc = String(err.error);
    }
    if (shortDesc.length > 120) {
      shortDesc = shortDesc.slice(0, 120) + "…";
    }
    const namePart = err.name ? " " + err.name + ":" : "";
    lines.push("• [" + err.stage + "]" + namePart + " " + shortDesc);
  }
  if (errors.length > 10) {
    lines.push("... 还有 " + (errors.length - 10) + " 条");
  }
  return lines.join("\n");
}
function clear() {
  errors.length = 0;
  disabledExtensions.length = 0;
}
export {
  clear,
  getAll,
  getDisabledExtensions,
  hasErrors,
  record,
  recordDisabledExtension,
  summarize
};

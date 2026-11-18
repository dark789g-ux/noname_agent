function applyBackground(el, binding) {
  const name = binding.value;
  if (!name) {
    el.style.backgroundImage = "";
    return;
  }
  if (typeof el.setBackground === "function") {
    el.setBackground(name, binding.arg || void 0);
  }
}
const vCharBg = {
  mounted(el, binding) {
    applyBackground(el, binding);
  },
  updated(el, binding) {
    if (binding.value === binding.oldValue && binding.arg === void 0) return;
    applyBackground(el, binding);
  }
};
export {
  vCharBg
};

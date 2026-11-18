import { isReactive } from "vue";
function doToggle(nodeEl, config) {
  if (nodeEl.classList.contains("disabled")) {
    return;
  }
  if (!nodeEl._link) nodeEl._link = { config };
  const currentOn = config.init === true;
  const newInit = !currentOn;
  config.init = newInit;
  const reactive = isReactive(config);
  if (!reactive) {
    nodeEl.classList.toggle("on");
  }
  if (config.onclick) {
    if (config.onclick.call(nodeEl, newInit) === false) {
      config.init = currentOn;
      if (!reactive) {
        nodeEl.classList.toggle("on");
      }
    }
  }
  if (config.update) {
    config.update();
  }
}
function doMenuItem(nodeEl, menuItemEl, config) {
  let link = menuItemEl._link;
  if (!nodeEl._link) nodeEl._link = { config };
  nodeEl._link.current = link;
  const oldInit = config.init;
  config.init = link;
  const reactive = isReactive(config);
  let tmpName;
  if (!reactive) {
    tmpName = nodeEl.lastChild.innerHTML;
    nodeEl.lastChild.innerHTML = config.item[link];
  }
  if (config.onclick) {
    if (config.onclick.call(nodeEl, link, menuItemEl) === false) {
      config.init = oldInit;
      if (!reactive && tmpName !== void 0) {
        nodeEl.lastChild.innerHTML = tmpName;
      }
    }
  }
  if (config.update) {
    config.update();
  }
}
export {
  doMenuItem,
  doToggle
};

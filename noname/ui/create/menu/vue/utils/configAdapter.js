function makeConfigAdapter(cfg) {
  const origUpdatex = cfg.updatex;
  if (typeof origUpdatex === "function") {
    cfg.updatex = function() {
      try {
        origUpdatex.call(this);
      } catch (e) {
      }
    };
  }
  const classListShim = {
    add(cls) {
      if (cls === "on") cfg.init = true;
    },
    remove(cls) {
      if (cls === "on") cfg.init = false;
    }
  };
  return {
    hide: () => {
      cfg._hidden = true;
    },
    show: () => {
      cfg._hidden = false;
    },
    _link: { config: cfg },
    classList: classListShim
  };
}
export {
  makeConfigAdapter
};

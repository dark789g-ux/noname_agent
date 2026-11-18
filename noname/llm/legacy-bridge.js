const BACKUP_FIELDS = [
  "filterButton",
  "selectButton",
  "filterTarget",
  "selectTarget",
  "deadTarget",
  "chessForceAll",
  "filterCard",
  "selectCard",
  "position",
  "forced",
  "fakeforce",
  "_aiexclude",
  "allowChooseAll",
  "complexSelect",
  "complexCard",
  "complexTarget",
  "_buttonChoice",
  "_cardChoice",
  "_targetChoice",
  "_skillChoice",
  "ai1",
  "ai2",
  "filterOk",
  "selectionSpec"
];
function buildBackupSnapshot(event) {
  const snapshot = {};
  for (const key of BACKUP_FIELDS) {
    if (key in event) snapshot[key] = event[key];
  }
  snapshot.selectionSpecExists = Object.prototype.hasOwnProperty.call(event, "selectionSpec");
  return snapshot;
}
function saveOwnProperty(target, key) {
  return {
    had: Object.prototype.hasOwnProperty.call(target, key),
    value: target[key]
  };
}
function restoreOwnProperty(target, key, saved) {
  if (saved.had) target[key] = saved.value;
  else delete target[key];
}
function withVirtualSelection(host, state, fn) {
  const ui = host?.ui;
  const status = host?.status;
  const event = state.event;
  const hadUiSelected = Boolean(ui && Object.prototype.hasOwnProperty.call(ui, "selected"));
  const prevUiSelected = ui?.selected;
  let selectedTarget;
  let prevButtons;
  let prevCards;
  let prevTargets;
  if (ui) {
    if (!prevUiSelected || typeof prevUiSelected !== "object") {
      ui.selected = { buttons: [], cards: [], targets: [] };
    }
    selectedTarget = ui.selected;
    prevButtons = saveOwnProperty(selectedTarget, "buttons");
    prevCards = saveOwnProperty(selectedTarget, "cards");
    prevTargets = saveOwnProperty(selectedTarget, "targets");
    selectedTarget.buttons = [...state.buttons ?? []];
    selectedTarget.cards = [...state.cards ?? []];
    selectedTarget.targets = [...state.targets ?? []];
  }
  const prevStatusEvent = status ? saveOwnProperty(status, "event") : void 0;
  if (status && event !== void 0) status.event = event;
  const savedEventProps = [];
  if (event && typeof event === "object") {
    if (state.skill !== void 0) {
      savedEventProps.push({ key: "skill", saved: saveOwnProperty(event, "skill") });
      event.skill = state.skill;
    }
    if (state.player !== void 0) {
      savedEventProps.push({ key: "player", saved: saveOwnProperty(event, "player") });
      event.player = state.player;
    }
    if (state.backup !== void 0) {
      savedEventProps.push({ key: "_backup", saved: saveOwnProperty(event, "_backup") });
      event._backup = state.backup;
    } else if (state.synthesizeBackup && !event._backup) {
      savedEventProps.push({ key: "_backup", saved: saveOwnProperty(event, "_backup") });
      event._backup = buildBackupSnapshot(event);
    }
    if (state.eventOverrides) {
      for (const [key, value] of Object.entries(state.eventOverrides)) {
        savedEventProps.push({ key, saved: saveOwnProperty(event, key) });
        event[key] = value;
      }
    }
  }
  try {
    return fn();
  } finally {
    for (let i = savedEventProps.length - 1; i >= 0; i--) {
      const entry = savedEventProps[i];
      restoreOwnProperty(event, entry.key, entry.saved);
    }
    if (status && prevStatusEvent) {
      restoreOwnProperty(status, "event", prevStatusEvent);
    }
    if (ui) {
      if (selectedTarget && prevButtons && prevCards && prevTargets) {
        restoreOwnProperty(selectedTarget, "buttons", prevButtons);
        restoreOwnProperty(selectedTarget, "cards", prevCards);
        restoreOwnProperty(selectedTarget, "targets", prevTargets);
      }
      if (!hadUiSelected) delete ui.selected;
      else ui.selected = prevUiSelected;
    }
  }
}
export {
  withVirtualSelection
};

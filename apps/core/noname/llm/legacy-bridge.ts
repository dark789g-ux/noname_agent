export interface LegacyBridgeHost {
	ui?: any;
	status?: any;
}

export interface VirtualSelectionState {
	event?: any;
	player?: any;
	skill?: string;
	backup?: any;
	synthesizeBackup?: boolean;
	cards?: any[];
	targets?: any[];
	buttons?: any[];
	eventOverrides?: Record<string, any>;
}

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
	"allowChooseAll",
	"complexSelect",
	"complexCard",
	"complexTarget",
	"filterOk",
] as const;

function buildBackupSnapshot(event: any): Record<string, any> {
	const snapshot: Record<string, any> = {};
	for (const key of BACKUP_FIELDS) {
		if (key in event) snapshot[key] = event[key];
	}
	return snapshot;
}

function saveOwnProperty(target: any, key: string): { had: boolean; value: any } {
	return {
		had: Object.prototype.hasOwnProperty.call(target, key),
		value: target[key],
	};
}

function restoreOwnProperty(target: any, key: string, saved: { had: boolean; value: any }): void {
	if (saved.had) target[key] = saved.value;
	else delete target[key];
}

/**
 * 在纯计算求值期间同步桥接遗留 UI/事件全局状态（`ui.selected`、`_status.event`、`event._backup`），并在 `finally` 中完整恢复。
 */
export function withVirtualSelection<T>(host: LegacyBridgeHost | undefined, state: VirtualSelectionState, fn: () => T): T {
	const ui = host?.ui;
	const status = host?.status;
	const event = state.event;

	const hadUiSelected = Boolean(ui && Object.prototype.hasOwnProperty.call(ui, "selected"));
	const prevUiSelected = ui?.selected;
	let selectedTarget: any;
	let prevButtons: { had: boolean; value: any } | undefined;
	let prevCards: { had: boolean; value: any } | undefined;
	let prevTargets: { had: boolean; value: any } | undefined;

	if (ui) {
		if (!prevUiSelected || typeof prevUiSelected !== "object") {
			ui.selected = { buttons: [], cards: [], targets: [] };
		}
		selectedTarget = ui.selected;
		prevButtons = saveOwnProperty(selectedTarget, "buttons");
		prevCards = saveOwnProperty(selectedTarget, "cards");
		prevTargets = saveOwnProperty(selectedTarget, "targets");
		selectedTarget.buttons = [...(state.buttons ?? [])];
		selectedTarget.cards = [...(state.cards ?? [])];
		selectedTarget.targets = [...(state.targets ?? [])];
	}

	const prevStatusEvent = status ? saveOwnProperty(status, "event") : undefined;
	if (status && event !== undefined) status.event = event;

	const savedEventProps: Array<{ key: string; saved: { had: boolean; value: any } }> = [];
	if (event && typeof event === "object") {
		if (state.skill !== undefined) {
			savedEventProps.push({ key: "skill", saved: saveOwnProperty(event, "skill") });
			event.skill = state.skill;
		}
		if (state.player !== undefined) {
			savedEventProps.push({ key: "player", saved: saveOwnProperty(event, "player") });
			event.player = state.player;
		}
		if (state.backup !== undefined) {
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

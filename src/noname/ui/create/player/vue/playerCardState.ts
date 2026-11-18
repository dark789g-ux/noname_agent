import { reactive } from "vue";
import { game, get } from "noname";
import type { Player } from "../../../library/element/player.js";

export interface PlayerLLMBadgeState {
	label: string;
	visible: boolean;
	highlighted: boolean;
	title: string;
}

export interface PlayerCardState {
	nameHtml: string;
	name2Html: string;
	nameNature: string;
	nameLong: boolean;
	identityText: string;
	identityColor: string;
	hp: number | undefined;
	maxHp: number | undefined;
	hpCondition: string;
	isNewLayout: boolean;
	count: string;
	countCondition: string;
	chainLength: number;
	isMainPlayer: boolean;
	llmBadge: PlayerLLMBadgeState;
}

const playerCardStateMap = new WeakMap<object, PlayerCardState>();

export function getPlayerCardState(player: object): PlayerCardState | undefined {
	return playerCardStateMap.get(player);
}

export function setPlayerCardState(player: object, state: PlayerCardState): void {
	playerCardStateMap.set(player, state);
}

export function deletePlayerCardState(player: object): void {
	playerCardStateMap.delete(player);
}

export function createPlayerCardState(): PlayerCardState {
	return reactive<PlayerCardState>({
		nameHtml: "",
		name2Html: "",
		nameNature: "",
		nameLong: false,
		identityText: "",
		identityColor: "",
		hp: undefined,
		maxHp: undefined,
		hpCondition: "",
		isNewLayout: Boolean(get.is.newLayout?.()),
		count: "",
		countCondition: "",
		chainLength: game.layout == "default" ? 64 : 40,
		isMainPlayer: false,
		llmBadge: {
			label: "AI",
			visible: false,
			highlighted: false,
			title: "",
		},
	});
}

export function syncHpState(state: PlayerCardState, player: Player): void {
	const hidden = player.classList?.contains("unseen_show") || player.classList?.contains("unseen2_show") || false;
	const maxHp = hidden ? 1 : player.maxHp;
	state.hp = player.hp;
	state.maxHp = maxHp;
	state.isNewLayout = Boolean(get.is.newLayout());

	const hpNode = player.node?.hp;
	if (hidden) {
		state.hpCondition = "hidden";
	} else if (hpNode?.classList?.contains("room")) {
		state.hpCondition = "high";
	} else if (player.hp == 0) {
		state.hpCondition = "";
	} else if (Number(player.hp) > Math.round(Number(maxHp) / 2) || player.hp === maxHp) {
		state.hpCondition = "high";
	} else if (Number(player.hp) > Math.floor(Number(maxHp) / 3)) {
		state.hpCondition = "mid";
	} else {
		state.hpCondition = "low";
	}
}

export function syncCountState(state: PlayerCardState, numh: number | undefined): void {
	state.count = numh?.toString() ?? "";
	if (typeof numh !== "number") {
		state.countCondition = "high";
	} else if (numh < 10) {
		state.countCondition = "low";
	} else if (numh < 100) {
		state.countCondition = "mid";
	} else {
		state.countCondition = "high";
	}
}

export function syncIdentityState(state: PlayerCardState, player: Player, identity?: string, nature?: string): void {
	const resolvedIdentity = identity || player.identity || "";
	const text = get.is.jun(player) ? "君" : get.translation(resolvedIdentity);
	const color = nature || resolvedIdentity;
	state.identityText = text;
	state.identityColor = color;
	const identityNode = player.node?.identity;
	if (identityNode) {
		if (identityNode.firstChild instanceof HTMLElement) {
			identityNode.firstChild.innerHTML = text;
		}
		identityNode.dataset.color = color;
	}
}

export function syncCharacterName1State(state: PlayerCardState, character: string, group?: string, isMinskin?: boolean): void {
	const html = character ? get.slimName(character) : "";
	state.nameHtml = html;
	if (group !== undefined) {
		state.nameNature = get.groupnature(String(group));
	}
	if (isMinskin !== undefined) {
		state.nameLong = Boolean(isMinskin && (html.match(/<br\s*\/?>/gi)?.length ?? 0) >= 4);
	}
}

export function syncCharacterName2State(state: PlayerCardState, character2?: string | null): void {
	state.name2Html = character2 ? get.slimName(character2) : "";
}

export function syncLLMBadgeState(state: PlayerCardState, badge: PlayerLLMBadgeState): void {
	state.llmBadge.label = badge.label;
	state.llmBadge.visible = badge.visible;
	state.llmBadge.highlighted = badge.highlighted;
	state.llmBadge.title = badge.title;
}

export function syncMainPlayerState(state: PlayerCardState, player: Player): void {
	state.isMainPlayer = Boolean(player && player === game.me);
}

export function syncAllMainPlayerStates(): void {
	const allPlayers = [...(game.players || []), ...(game.dead || [])];
	for (const p of allPlayers) {
		const state = getPlayerCardState(p);
		if (state) {
			syncMainPlayerState(state, p);
		}
	}
}

export function resetPlayerCardState(state: PlayerCardState): void {
	state.nameHtml = "";
	state.name2Html = "";
	state.nameNature = "";
	state.nameLong = false;
	state.hp = undefined;
	state.maxHp = undefined;
	state.hpCondition = "";
	state.count = "0";
}

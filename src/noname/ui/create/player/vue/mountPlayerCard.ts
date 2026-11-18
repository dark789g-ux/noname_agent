import { createApp, type App } from "vue";
import { lib, ui } from "noname";
import { ChildNodesWatcher } from "../../../../library/cache/childNodesWatcher.js";
import type { WatchedCardContainer } from "../../../../library/element/Player/contracts/instanceFieldsContract.js";
import type { Player } from "../../../../library/element/player.js";
import PlayerCard from "./components/PlayerCard.vue";
import {
	createPlayerCardState,
	deletePlayerCardState,
	getPlayerCardState,
	resetPlayerCardState,
	setPlayerCardState,
	syncCharacterName1State,
	syncCharacterName2State,
	syncCountState,
	syncHpState,
	syncIdentityState,
	syncLLMBadgeState,
	syncAllMainPlayerStates,
	syncMainPlayerState,
	type PlayerLLMBadgeState,
} from "./playerCardState.js";

const mountedApps = new WeakMap<object, { app: App<Element>; observer: MutationObserver }>();

/**
 * 挂载人物卡片 Vue 组件，并同步回填 `player.node.*` DOM 引用。
 */
export function mountPlayerCard(player: Player): Record<string, HTMLDivElement> {
	unmountPlayerCard(player);

	const state = createPlayerCardState();
	syncMainPlayerState(state, player);
	setPlayerCardState(player, state);

	const handcards1: WatchedCardContainer = ui.create.div(".handcards");
	const handcards2: WatchedCardContainer = ui.create.div(".handcards");
	handcards1._childNodesWatcher = new ChildNodesWatcher(handcards1);
	handcards2._childNodesWatcher = new ChildNodesWatcher(handcards2);

	const expansions = ui.create.div(".expansions");
	expansions.style.display = "none";

	const nodeMap: Record<string, HTMLDivElement> = {
		handcards1,
		handcards2,
		expansions,
	};
	player.node = nodeMap;

	const app = createApp(PlayerCard, {
		player,
		state,
		onNodeReady(key: string, el: HTMLDivElement) {
			nodeMap[key] = el;
		},
	});
	app.mount(player);

	const observer = new MutationObserver(mutationsList => {
		for (const mutation of mutationsList) {
			if (mutation.type === "childList") {
				const addedNodes = Array.from(mutation.addedNodes);
				const removedNodes = Array.from(mutation.removedNodes);
				if (
					addedNodes.some(card => card instanceof lib.element.Card && !card.classList.contains("emptyequip")) ||
					removedNodes.some(card => card instanceof lib.element.Card && !card.classList.contains("emptyequip"))
				) {
					player.$handleEquipChange();
				}
			}
		}
	});
	if (nodeMap.equips) {
		observer.observe(nodeMap.equips, { childList: true });
	}

	mountedApps.set(player, { app, observer });
	return nodeMap;
}

/**
 * 卸载人物卡片 Vue 组件并清理状态与观察者。
 */
export function unmountPlayerCard(player: object): void {
	const mounted = mountedApps.get(player);
	if (mounted) {
		mounted.observer.disconnect();
		mounted.app.unmount();
		mountedApps.delete(player);
	}
	deletePlayerCardState(player);
}

/**
 * 供 Player 生命周期方法及 UI 方法调用的响应式同步桥接。
 */
export const playerCardVueBridge = {
	mount: mountPlayerCard,
	unmount: unmountPlayerCard,
	syncHp(player: Player): boolean {
		const state = getPlayerCardState(player);
		if (!state) return false;
		const hpNode = player.node?.hp;
		if (hpNode) {
			hpNode.style.transition = "none";
		}
		syncHpState(state, player);
		if (hpNode) {
			setTimeout(() => {
				hpNode.style.transition = "";
			});
		}
		return true;
	},
	syncCount(player: Player, numh: number | undefined): boolean {
		const state = getPlayerCardState(player);
		if (!state) return false;
		syncCountState(state, numh);
		return true;
	},
	syncIdentity(player: Player, identity?: string, nature?: string): boolean {
		const state = getPlayerCardState(player);
		if (!state) return false;
		syncIdentityState(state, player, identity, nature);
		return true;
	},
	syncName1(player: Player, character: string, group?: string, isMinskin?: boolean): boolean {
		const state = getPlayerCardState(player);
		if (!state) return false;
		syncCharacterName1State(state, character, group, isMinskin);
		return true;
	},
	syncName2(player: Player, character2?: string | null): boolean {
		const state = getPlayerCardState(player);
		if (!state) return false;
		syncCharacterName2State(state, character2);
		return true;
	},
	syncLLMBadge(player: Player, badge: PlayerLLMBadgeState): boolean {
		const state = getPlayerCardState(player);
		if (!state) return false;
		syncLLMBadgeState(state, badge);
		return true;
	},
	syncMainPlayer(player?: Player): boolean {
		if (player) {
			const state = getPlayerCardState(player);
			if (!state) return false;
			syncMainPlayerState(state, player);
			return true;
		}
		syncAllMainPlayerStates();
		return true;
	},
	reset(player: Player): boolean {
		const state = getPlayerCardState(player);
		if (!state) return false;
		resetPlayerCardState(state);
		return true;
	},
};

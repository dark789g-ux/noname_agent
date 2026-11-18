import html from "dedent";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";
import type { SelectionContext } from "../contracts.js";

export function assignIdentities(context: SelectionContext) {
	const { event, chosen, stratagemMode, list2, list3, list4 } = context;

	const identityList = context.identityList;
	event.list = [];
	identityList.randomSort();
	if (event.identity) {
		identityList.remove(event.identity);
		identityList.unshift(event.identity);
		if (event.fixedseat) {
			const zhuIdentity = _status.mode === "zhong" ? "mingzhong" : "zhu";
			if (zhuIdentity !== event.identity) {
				identityList.remove(zhuIdentity);
				identityList.splice(event.fixedseat, 0, zhuIdentity);
			}
			delete event.fixedseat;
		}
		delete event.identity;
	} else if (_status.mode !== "zhong" && (!_status.brawl || !_status.brawl.identityShown)) {
		const banIdentity: any[] = [];
		banIdentity.push(get.config("ban_identity", undefined) || "off");
		if (banIdentity[0] !== "off") {
			banIdentity.push(get.config("ban_identity2", undefined) || "off");
			if (banIdentity[1] !== "off") {
				banIdentity.push(get.config("ban_identity3", undefined) || "off");
			}
		}
		banIdentity.remove("off");
		if (banIdentity.length) {
			const identityList2 = identityList.slice(0);
			for (const bannedIdentity of banIdentity) {
				while (identityList2.includes(bannedIdentity)) {
					identityList2.remove(bannedIdentity);
				}
			}
			const selectedIdentity = identityList2.randomGet();
			identityList.remove(selectedIdentity);
			identityList.splice(game.players.indexOf(game.me!), 0, selectedIdentity);
		}
	}
	let playerIndex = 0;
	for (const currentPlayer of game.players) {
		const currentIdentity = identityList[playerIndex];
		playerIndex++;
		if (_status.brawl && _status.brawl.identityShown) {
			if (currentPlayer.identity === "zhu") {
				game.zhu = currentPlayer;
			}
			if (!stratagemMode) {
				currentPlayer.identityShown = true;
			}
			continue;
		}
		currentPlayer.node.identity.classList.add("guessing");
		currentPlayer.identity = currentIdentity;
		currentPlayer.setIdentity("cai");
		if (event.zhongmode) {
			if (currentIdentity === "mingzhong") {
				game.zhu = currentPlayer;
			} else if (currentIdentity === "zhu") {
				game.zhu2 = currentPlayer;
			}
		} else if (currentIdentity === "zhu") {
			game.zhu = currentPlayer;
		}
		currentPlayer.identityShown = false;
	}

	if (get.config("special_identity", undefined) && !event.zhongmode && !event.stratagemMode && game.players.length === 8) {
		for (const currentPlayer of game.players) {
			delete currentPlayer.special_identity;
		}
		event.special_identity = [];
		const zhongs = game.filterPlayer(current => current.identity === "zhong");
		const fans = game.filterPlayer(current => current.identity === "fan");
		if (fans.length >= 1) {
			fans.randomRemove()!.special_identity = "identity_zeishou";
			event.special_identity.push("identity_zeishou");
		}
		if (zhongs.length > 1) {
			zhongs.randomRemove()!.special_identity = "identity_dajiang";
			zhongs.randomRemove()!.special_identity = "identity_junshi";
			event.special_identity.push("identity_dajiang");
			event.special_identity.push("identity_junshi");
		} else if (zhongs.length === 1) {
			if (Math.random() < 0.5) {
				zhongs.randomRemove()!.special_identity = "identity_dajiang";
				event.special_identity.push("identity_dajiang");
			} else {
				zhongs.randomRemove()!.special_identity = "identity_junshi";
				event.special_identity.push("identity_junshi");
			}
		}
	}

	if (!game.zhu) {
		game.zhu = game.me!;
	} else {
		if (!stratagemMode) {
			game.zhu.setIdentity();
			game.zhu.isZhu = game.zhu.identity === "zhu";
			game.zhu.identityShown = true;
			game.zhu.node.identity.classList.remove("guessing");
		}
		game.me!.setIdentity();
		game.me!.node.identity.classList.remove("guessing");
	}
}

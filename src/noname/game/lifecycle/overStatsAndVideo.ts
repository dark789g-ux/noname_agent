import { _status, lib, get, ui } from "noname";
import { persistVideo } from "../../storage/videos.js";
import { game } from "../index.js";

function appendStatHeaders(tr: HTMLTableRowElement): void {
	tr.appendChild(document.createElement("td"));
	for (const label of ["伤害", "受伤", "摸牌", "出牌", "杀敌", "手牌"]) {
		const td = document.createElement("td");
		td.innerHTML = label;
		tr.appendChild(td);
	}
}

function appendPlayerStatRow(table: HTMLTableElement, target: Player, hsMap: Map<Player, Card[]>, showCamouflage: boolean): void {
	const tr = document.createElement("tr");
	let td = document.createElement("td");
	const playerAi = target.ai;
	td.innerHTML = get.translation(target) + (showCamouflage && "stratagem_camouflage" in playerAi && playerAi.stratagem_camouflage ? "(被伪装)" : "");
	tr.appendChild(td);

	let num = 0;
	td = document.createElement("td");
	for (const stat of target.stat) {
		if (stat.damage != undefined) num += stat.damage;
	}
	td.textContent = String(num);
	tr.appendChild(td);

	td = document.createElement("td");
	num = 0;
	for (const stat of target.stat) {
		if (stat.damaged != undefined) num += stat.damaged;
	}
	td.textContent = String(num);
	tr.appendChild(td);

	td = document.createElement("td");
	num = 0;
	for (const stat of target.stat) {
		if (stat.gain != undefined) num += stat.gain;
	}
	td.textContent = String(num);
	tr.appendChild(td);

	td = document.createElement("td");
	num = 0;
	for (const stat of target.stat) {
		for (const k in stat.card) {
			num += stat.card[k] ?? 0;
		}
	}
	td.textContent = String(num);
	tr.appendChild(td);

	td = document.createElement("td");
	num = 0;
	for (const stat of target.stat) {
		if (stat.kill != undefined) num += stat.kill;
	}
	td.textContent = String(num);
	tr.appendChild(td);

	td = document.createElement("td");
	td.innerHTML = get.poptip({
		name: `<img style="width:15px; vertical-align: middle;" src="${lib.assetURL}image/card/handcard.png">`,
		dialog(dialog) {
			const hs = hsMap.get(target) ?? [];
			dialog.add(`${get.translation(target)}的手牌`);
			dialog[hs.length > 0 ? "addSmall" : "addText"](hs.length > 0 ? hs : "（没有手牌）");
			return dialog;
		},
	});
	tr.appendChild(td);
	table.appendChild(tr);
}

export function renderGameOverTable(dialog: Dialog, hsMap: Map<Player, Card[]>): void {
	if (game.players.length) {
		const table = document.createElement("table");
		const tr = document.createElement("tr");
		appendStatHeaders(tr);
		table.appendChild(tr);
		for (let i = 0; i < game.players.length; i++) {
			appendPlayerStatRow(table, game.players[i], hsMap, true);
		}
		dialog.add(ui.create.div(".placeholder"));
		dialog.content.appendChild(table);
	}
	if (game.dead.length) {
		const table = document.createElement("table");
		table.style.opacity = "0.5";
		if (game.players.length == 0) {
			const tr = document.createElement("tr");
			appendStatHeaders(tr);
			table.appendChild(tr);
		}
		for (let i = 0; i < game.dead.length; i++) {
			appendPlayerStatRow(table, game.dead[i], hsMap, true);
		}
		dialog.add(ui.create.div(".placeholder"));
		dialog.content.appendChild(table);
	}
	if (game.additionaldead && game.additionaldead.length) {
		const table = document.createElement("table");
		table.style.opacity = "0.5";
		for (let i = 0; i < game.additionaldead.length; i++) {
			appendPlayerStatRow(table, game.additionaldead[i], hsMap, false);
		}
		dialog.add(ui.create.div(".placeholder"));
		dialog.content.appendChild(table);
	}
}

export function saveGameOverVideo(result: string): boolean {
	const vinum = parseInt(lib.config.video);
	if (!_status.video && vinum && game.getVideoName && lib.db && _status.videoInited) {
		const removedVideos: import("../contracts/gameContract.js").Videos[] = [];
		const videos = lib.videos.slice(0);
		for (let i = 0; i < videos.length; i++) {
			if (videos[i].starred) {
				videos.splice(i--, 1);
			}
		}
		for (let deletei = 0; deletei < 5; deletei++) {
			if (videos.length >= vinum) {
				const toremove = videos.pop();
				if (!toremove) break;
				removedVideos.push(toremove);
			} else {
				break;
			}
		}
		const me = game.me || game.players[0];
		if (!me) {
			return false;
		}
		const newvid = {
			name: game.getVideoName(),
			mode: lib.config.mode,
			video: lib.video,
			win: result == "战斗胜利",
			name1: me.name1 || me.name,
			name2: me.name2,
			time: lib.getUTC(new Date()),
		};
		let modecharacters = lib.characterPack["mode_" + get.mode()];
		if (modecharacters) {
			if (get.mode() == "guozhan") {
				if (modecharacters[String(newvid.name1)]) {
					if (newvid.name1 === undefined) throw new TypeError("Video character name is missing");
					if (newvid.name1.startsWith("gz_shibing")) {
						newvid.name1 = newvid.name1.slice(3, 11);
					} else {
						newvid.name1 = newvid.name1.slice(3);
					}
				}
				const name2 = newvid.name2;
				if (name2 && modecharacters[name2]) {
					if (name2.startsWith("gz_shibing")) {
						newvid.name2 = name2.slice(3, 11);
					} else {
						newvid.name2 = name2.slice(3);
					}
				}
			} else {
				if (modecharacters[String(newvid.name1)]) {
					newvid.name1 = get.mode() + "::" + newvid.name1;
				}
				const name2 = newvid.name2;
				if (name2 && modecharacters[name2]) {
					newvid.name2 = get.mode() + "::" + name2;
				}
			}
		}
		if (newvid.name1 && newvid.name1.startsWith("subplayer_")) {
			newvid.name1 = newvid.name1.slice(10, newvid.name1.lastIndexOf("_"));
		}
		if (newvid.name2 && newvid.name2.startsWith("subplayer_")) {
			if (newvid.name1 === undefined) throw new TypeError("Video character name is missing");
			newvid.name1 = newvid.name2.slice(10, newvid.name1.lastIndexOf("_"));
		}
		// 清洗代理对象
		newvid.video = structuredClone(newvid.video);
		lib.status.reload++;
		persistVideo(
			lib.db,
			newvid,
			removedVideos.map(video => video.time)
		)
			.then(() => {
				for (const video of removedVideos) lib.videos.remove(video);
				lib.videos.unshift(newvid);
				ui.create.videoNode(newvid, true);
			})
			.catch(error => console.error("录像保存失败", error))
			.finally(() => game.reload2());
	}
	return true;
}

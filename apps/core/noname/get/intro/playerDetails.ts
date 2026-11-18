import { game, lib, _status, ui } from "noname";
import { get } from "../dependencies.js";

export function playerDetails(node, simple, evt, uiintro, createButtons) {
	// Function-scoped bindings intentionally remain shared across legacy branches.
	let i, translation, intro, str, listi;

	if (lib.config.right_range && _status.gameStarted) {
		uiintro.add(ui.create.div(".placeholder"));
		let table, tr, td;
		table = document.createElement("table");
		tr = document.createElement("tr");
		table.appendChild(tr);
		td = document.createElement("td");
		td.innerHTML = "距离";
		tr.appendChild(td);
		td = document.createElement("td");
		td.innerHTML = "手牌";
		tr.appendChild(td);
		td = document.createElement("td");
		td.innerHTML = "行动";
		tr.appendChild(td);
		td = document.createElement("td");
		td.innerHTML = "伤害";
		tr.appendChild(td);

		tr = document.createElement("tr");
		table.appendChild(tr);
		td = document.createElement("td");
		if (node == game.me || !game.me || !game.me.isIn()) {
			td.innerHTML = "-";
		} else {
			let dist1 = get.numStr(Math.max(1, game.me.distanceTo(node)), undefined);
			let dist2 = get.numStr(Math.max(1, node.distanceTo(game.me)), undefined);
			if (dist1 == dist2) {
				td.innerHTML = dist1;
			} else {
				td.innerHTML = dist1 + "/" + dist2;
			}
		}
		tr.appendChild(td);
		td = document.createElement("td");
		let handcardLimit = node.getHandcardLimit();
		td.innerHTML = `${node.countCards("h")}/${handcardLimit >= 114514 ? "∞" : handcardLimit}`;
		tr.appendChild(td);
		td = document.createElement("td");
		td.innerHTML = node.phaseNumber;
		tr.appendChild(td);
		td = document.createElement("td");

		(function () {
			let num = 0;
			for (let j = 0; j < node.stat.length; j++) {
				if (typeof node.stat[j].damage == "number") {
					num += node.stat[j].damage;
				}
			}
			td.innerHTML = String(num);
		})();
		tr.appendChild(td);
		table.style.width = "calc(100% - 20px)";
		table.style.marginLeft = "10px";

		uiintro.content.appendChild(table);
		if (!lib.config.show_favourite) {
			table.style.paddingBottom = "5px";
		}
	}
	if (!simple || get.is.phoneLayout()) {
		let es = node.getCards("e");
		for (let i = 0; i < es.length; i++) {
			const special = [es[i]].concat(es[i].cards || []).find(j => j.name == es[i].name && lib.card[j.name]?.cardPrompt);
			str = special ? lib.card[special.name].cardPrompt(special, node) : lib.translate[es[i].name + "_info"];
			uiintro.add('<div><div class="skill">' + es[i].outerHTML + "</div><div>" + str + "</div></div>");
			uiintro.content.lastChild.querySelector(".skill>.card").style.transform = "";

			if (lib.translate[es[i].name + "_append"]) {
				uiintro.add('<div class="text">' + lib.translate[es[i].name + "_append"] + "</div>");
			}
		}
		let js = node.getCards("j");
		for (let i = 0; i < js.length; i++) {
			const Vcard = js[i][js[i].cardSymbol];
			if (js[i].viewAs && Vcard.cards.length == 1 && js[i].viewAs != Vcard.cards[0].name) {
				let html = Vcard.cards[0].outerHTML;
				let cardInfo = lib.card[js[i].viewAs],
					showCardIntro = true;
				if (cardInfo.blankCard) {
					let cardOwner = get.owner(js[i]);
					if (cardOwner && !cardOwner.isUnderControl(true)) {
						showCardIntro = false;
					}
				}
				if (!showCardIntro) {
					html = ui.create.button(js[i], "blank").outerHTML;
				}
				uiintro.add(`<div><div class="skill">${html}</div><div>${lib.translate[js[i].viewAs]}：${lib.card[js[i].viewAs]?.cardPrompt?.(js[i], node) || lib.translate[`${js[i].viewAs}_info`]}</div></div>`);
			} else {
				uiintro.add(`<div><div class="skill">${js[i].outerHTML}</div><div>${lib.translate[js[i].name]}：${lib.card[js[i].name]?.cardPrompt?.(js[i], node) || lib.translate[`${js[i].name}_info`]}</div></div>`);
			}
			uiintro.content.lastChild.querySelector(".skill>.card").style.transform = "";
		}
		if (get.is.phoneLayout()) {
			let markCoutainer = ui.create.div(".mark-container.marks");
			for (let i in node.marks) {
				const mark = node.marks[i];
				if (!(mark instanceof HTMLDivElement)) {
					continue;
				}
				const markClone = mark.cloneNode(true);
				if (!(markClone instanceof HTMLDivElement)) {
					continue;
				}
				let nodemark = Object.assign(markClone, { link: mark });
				nodemark.classList.add("pointerdiv");
				nodemark.style.transform = "";
				markCoutainer.appendChild(nodemark);
				nodemark.listen(function () {
					uiintro.noresume = true;
					let rect = mark.getBoundingClientRect();
					ui.click.intro.call(mark, {
						clientX: rect.left + rect.width,
						clientY: rect.top + rect.height / 2,
					});
					if (lib.config.touchscreen) {
						uiintro._close();
					}
				});
			}
			if (markCoutainer.childElementCount) {
				uiintro.addText("标记");
				uiintro.add(markCoutainer);
			}
		}
	}
	if (!game.observe && _status.gameStarted && game.me && node != game.me) {
		ui.throwEmotion = [];
		uiintro.addText("发送交互表情");
		let click = /** @this {HTMLDivElement & { link: string }} */ function (this: HTMLDivElement & { link: string }) {
			if (_status.dragged) {
				return;
			}
			if (_status.justdragged) {
				return;
			}
			if (_status.throwEmotionWait) {
				return;
			}
			let emotion = this.link;
			if (game.online) {
				game.send("throwEmotion", node, emotion);
			} else {
				game.getMe().throwEmotion(node, emotion);
			}
			uiintro._close();
			_status.throwEmotionWait = true;
			setTimeout(
				function () {
					_status.throwEmotionWait = false;
					if (ui.throwEmotion) {
						for (let i of ui.throwEmotion) {
							i.classList.remove("exclude");
						}
					}
				},
				emotion == "flower" || emotion == "egg" ? 500 : 5000
			);
		};
		let table = document.createElement("div");
		table.classList.add("add-setting");
		table.style.margin = "0";
		table.style.width = "100%";
		table.style.position = "relative";
		listi = ["flower", "egg"];
		for (let i = 0; i < listi.length; i++) {
			const td = Object.assign(ui.create.div(".menubutton.reduce_radius.pointerdiv.tdnode"), { link: listi[i] });
			ui.throwEmotion.add(td);
			if (_status.throwEmotionWait) {
				td.classList.add("exclude");
			}
			table.appendChild(td);
			td.innerHTML = "<span>" + get.translation(listi[i]) + "</span>";
			td.addEventListener(lib.config.touchscreen ? "touchend" : "click", click);
		}
		uiintro.content.appendChild(table);
		table = document.createElement("div");
		table.classList.add("add-setting");
		table.style.margin = "0";
		table.style.width = "100%";
		table.style.position = "relative";
		listi = ["wine", "shoe"];
		if (game.me.storage.zhuSkill_shanli) {
			listi = ["yuxisx", "jiasuo"];
		}
		for (let i = 0; i < listi.length; i++) {
			const td = Object.assign(ui.create.div(".menubutton.reduce_radius.pointerdiv.tdnode"), { link: listi[i] });
			ui.throwEmotion.add(td);
			if (_status.throwEmotionWait) {
				td.classList.add("exclude");
			}
			table.appendChild(td);
			td.innerHTML = "<span>" + get.translation(listi[i]) + "</span>";
			td.addEventListener(lib.config.touchscreen ? "touchend" : "click", click);
		}
		uiintro.content.appendChild(table);
	}
	let modepack = lib.characterPack["mode_" + get.mode()];
	if (lib.config.show_favourite && lib.character[node.name] && game.players.includes(node) && (!modepack || !modepack[node.name]) && (!simple || get.is.phoneLayout())) {
		let addFavourite = Object.assign(ui.create.div(".text.center.pointerdiv"), { link: node.name });
		addFavourite.style.marginRight = "15px";
		if (lib.config.favouriteCharacter.includes(node.name)) {
			addFavourite.innerHTML = "移除收藏";
		} else {
			addFavourite.innerHTML = "添加收藏";
		}
		addFavourite.listen(ui.click.favouriteCharacter);
		uiintro.add(addFavourite);
	}
	if (!simple || get.is.phoneLayout()) {
		if (!node.name.startsWith("unknown")) {
			let viewInfo = Object.assign(ui.create.div(".text.center.pointerdiv"), { link: node });
			viewInfo.innerHTML = "查看资料";
			viewInfo.listen(function () {
				let player = node;
				let audioName = player.skin.name || player.name1 || player.name;
				ui.click.charactercard(player.name1 || player.name, null, null, true, player.node.avatar, audioName);
			});
			uiintro.add(viewInfo);
		}
	}
	if ((lib.config.change_skin || lib.skin) && (!simple || get.is.phoneLayout())) {
		[node.name1, node.name2].forEach((nameskin, index: number) => {
			if (nameskin) {
				createButtons(nameskin, src => {
					const avatar = node.node[index ? "avatar2" : "avatar"];
					if (src === "origin") avatar.setBackground(nameskin, "character");
					else avatar.style.backgroundImage = `url('${src}')`;
				});
			}
		});
	}
	uiintro.add(ui.create.div(".placeholder.slim"));
}

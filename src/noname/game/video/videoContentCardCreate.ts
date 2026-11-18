import { lib, get, ui } from "noname";
import { game } from "../index.js";

export function createVideoContentCardCreate() {
	return {
		hidePlayer: function (player) {
			if (player) {
				player.hide();
			}
		},
		deleteHandcards: function (player) {
			if (player) {
				player.node.handcards1.delete();
				player.node.handcards2.delete();
			}
		},
		hideCharacter: function (player, num) {
			if (player && player.classList) {
				switch (num) {
					case 0:
						player.classList.add("unseen_v");
						break;
					case 1:
						player.classList.add("unseen2_v");
						break;
					case 2:
						player.classList.add("unseen_v");
						player.classList.add("unseen2_v");
						break;
				}
			} else {
				console.log(num);
			}
		},
		popup: function (player, info) {
			if (player && info) {
				player.popup(info[0], info[1]);
			} else {
				console.log(player);
			}
		},
		log: function (str) {
			game.log(str);
		},
		draw: function (player, info) {
			if (player && player.$draw) {
				player.$draw(info);
			} else {
				console.log(player);
			}
		},
		drawCard: function (player, info) {
			if (player && info) {
				player.$draw(get.infoCards(info));
			} else {
				console.log(player);
			}
		},
		throw: function (player, info) {
			if (player && info) {
				player.$throw(get.infoCards(info[0]), info[1], null, info[2]);
			} else {
				console.log(player);
			}
		},
		compare: function (player, info) {
			if (player && info) {
				player.$compare(get.infoCard(info[0]), game.playerMap[info[1]], get.infoCard(info[2]));
			} else {
				console.log(player);
			}
		},
		compareMultiple: function (player, info) {
			if (player && info) {
				player.$compareMultiple(get.infoCard(info[0]), get.infoTargets(info[1]), get.infoCards(info[2]));
			} else {
				console.log(player);
			}
		},
		give: function (player, info) {
			if (player && info) {
				player.$give(info[0], game.playerMap[info[1]]);
			} else {
				console.log(player);
			}
		},
		giveCard: function (player, info) {
			if (player && info) {
				player.$give(get.infoCards(info[0]), game.playerMap[info[1]]);
			} else {
				console.log(player);
			}
		},
		gain: function (player, info) {
			if (player && player.$gain) {
				player.$gain(info);
			} else {
				console.log(player);
			}
		},
		gainCard: function (player, info) {
			if (player && info) {
				player.$gain(get.infoCards(info));
			} else {
				console.log(player);
			}
		},
		gain2: function (player, cards) {
			if (player && player.$draw) {
				let nodeList = document.querySelectorAll("#arena>.card,#chess>.card");
				let nodes = [];
				for (let i = 0; i < nodeList.length; i++) {
					const node = nodeList[i];
					if (node instanceof lib.element.Card) {
						nodes.push(node);
					}
				}
				for (let i = 0; i < cards.length; i++) {
					for (let j = 0; j < nodes.length; j++) {
						if (cards[i][2] == nodes[j].name && cards[i][0] == nodes[j].suit && cards[i][1] == nodes[j].number) {
							nodes[j].moveDelete(player);
							cards.splice(i--, 1);
							nodes.splice(j--, 1);
							break;
						}
					}
				}
				if (cards.length) {
					player.$draw(get.infoCards(cards));
				}
			} else {
				console.log(player);
			}
		},
		deletenode: function (player, cards, method) {
			if (cards) {
				let nodeList = document.querySelectorAll("#arena>.card,#chess>.card");
				let nodes = [];
				for (let i = 0; i < nodeList.length; i++) {
					const node = nodeList[i];
					if (node instanceof lib.element.Card) {
						nodes.push(node);
					}
				}
				for (let i = 0; i < cards.length; i++) {
					for (let j = 0; j < nodes.length; j++) {
						if (cards[i][2] == nodes[j].name && cards[i][0] == nodes[j].suit && cards[i][1] == nodes[j].number) {
							nodes[j].delete();
							if (method == "zoom") {
								nodes[j].style.transform = "scale(0)";
							}
							cards.splice(i--, 1);
							nodes.splice(j--, 1);
							break;
						}
					}
				}
			} else {
				console.log(player, cards);
			}
		},
		highlightnode: function (player, card) {
			if (card) {
				let nodeList = document.querySelectorAll("#arena>.card,#chess>.card");
				let nodes = [];
				for (let i = 0; i < nodeList.length; i++) {
					const node = nodeList[i];
					if (node instanceof lib.element.Card) {
						nodes.push(node);
					}
				}
				for (let j = nodes.length - 1; j >= 0; j--) {
					if (card[2] == nodes[j].name && card[0] == nodes[j].suit && card[1] == nodes[j].number) {
						nodes[j].classList.add("thrownhighlight");
						break;
					}
				}
			} else {
				// ?
				// console.log(player, cards);
			}
		},
		uiClear: function () {
			ui.clear();
		},
		judge1: function (player, content) {
			if (player && content) {
				let judging = get.infoCard(content[0]);
				if (game.chess) {
					judging.copy("thrown", "center", "thrownhighlight", ui.arena).addTempClass("start");
				} else {
					player.$throwordered(judging.copy("thrownhighlight"), true);
				}

				ui.create.dialog(content[1]).videoId = content[2];
				ui.arena.classList.add("thrownhighlight");
			} else {
				console.log(player);
			}
		},
		centernode: function (content) {
			get.infoCard(content).copy("thrown", "center", "thrownhighlight", ui.arena).addTempClass("start");
		},
		judge2: function (videoId) {
			for (let i = 0; i < ui.dialogs.length; i++) {
				if (ui.dialogs[i].videoId == videoId) {
					ui.dialogs[i].close();
				}
			}
			ui.arena.classList.remove("thrownhighlight");
		},
		unmarkname: function (player, name) {
			if (player && player.unmark) {
				player.unmark(name);
			} else {
				console.log(player);
			}
		},
		unmark: function (player, name) {
			if (player && player.marks && player.marks[name]) {
				player.marks[name].delete();
				player.marks[name].style.transform += " scale(0.2)";
				delete player.marks[name];
				ui.updatem(this);
			}
		},
		flame: function (player, type) {
			if (player && type) {
				player["$" + type]();
			} else {
				console.log(player);
			}
		},
		throwEmotion: function (player, content) {
			if (player && content) {
				player.$throwEmotion(game.playerMap[content[0]], content[1]);
			} else {
				console.log(player);
			}
		},
		addGaintag: function (player, content) {
			if (player && content) {
				let checkMatch = function (l1, l2) {
					for (let i = 0; i < l1.length; i++) {
						for (let j = 0; j < l2.length; j++) {
							if (l1[i].length === 5) {
								if (l1[i][4] === l2[j].cardid) {
									l2[j].addGaintag(content[1]);
									l2.splice(j--, 1);
									break;
								}
							} else if (l2[j].suit == l1[i][0] && l2[j].number == l1[i][1] && l2[j].name == l1[i][2]) {
								l2[j].addGaintag(content[1]);
								l2.splice(j--, 1);
								break;
							}
						}
					}
				};
				checkMatch(content[0], player.getCards("hs"));
			} else {
				console.log(player);
			}
		},
		removeGaintag: function (player, content) {
			if (player && content) {
				if (Array.isArray(content)) {
					const checkMatch = function (l1, l2) {
						for (let i = 0; i < l1.length; i++) {
							for (let j = 0; j < l2.length; j++) {
								if (l1[i].length === 5) {
									if (l1[i][4] === l2[j].cardid) {
										l2[j].removeGaintag(content[0]);
										l2.splice(j--, 1);
										break;
									}
								} else if (l2[j].suit == l1[i][0] && l2[j].number == l1[i][1] && l2[j].name == l1[i][2]) {
									l2[j].removeGaintag(content[0]);
									l2.splice(j--, 1);
									break;
								}
							}
						}
					};
					// player.removeGaintag.apply(player, content);
					checkMatch(content[1], player.getCards("hs"));
				} else {
					player.removeGaintag(content);
				}
			} else {
				console.log(player);
			}
		},
	};
}

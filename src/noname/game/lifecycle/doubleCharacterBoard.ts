import { lib, get, ui } from "noname";
import { game } from "../index.js";

export function setupDoubleCharacterBoard(event: any): void {
	event.nodes = [];
	event.avatars = [];
	event.friend = [];
	event.enemy = [];
	event.blank = [];
	for (let i = 0; i < event.config.size; i++) {
		event.nodes.push(ui.create.div(".shadowed.reduce_radius.choosedouble"));
	}
	event.moveAvatar = function (node, i) {
		if (!node.classList.contains("moved")) {
			event.blank.push(node.index);
		}
		event.nodes[node.index].style.display = "";
		event.nodes[node.index].show();
		clearTimeout(event.nodes[node.index].choosetimeout);
		event.moveNode(node, i);
		const nodex = event.nodes[node.index];
		nodex.choosetimeout = setTimeout(function () {
			nodex.hide();
			nodex.choosetimeout = setTimeout(function () {
				nodex.show();
				nodex.style.display = "none";
			}, 300);
		}, 400);
	};
	event.promptbar = ui.create.div(".hidden", ui.window);
	event.promptbar.style.width = "100%";
	event.promptbar.style.left = 0;
	event.promptbar.style.top = get.is.phoneLayout() ? "20px" : "58px";
	event.promptbar.style.pointerEvents = "none";
	event.promptbar.style.textAlign = "center";
	event.promptbar.style.zIndex = "2";
	ui.create.div(".shadowed.reduce_radius", event.promptbar);
	event.promptbar.firstChild.style.fontSize = "18px";
	event.promptbar.firstChild.style.padding = "6px 10px";
	event.promptbar.firstChild.style.position = "relative";
	event.prompt = function (str) {
		event.promptbar.firstChild.innerHTML = str;
		event.promptbar.show();
	};
	event.moveNode = function (node, i) {
		const width = event.width,
			height = event.height,
			margin = event.margin;
		const left = (-(width + 10) * event.config.width) / 2 + 5 + (i % event.config.width) * (width + 10);
		const top = (-(height + 10) * event.config.height) / 2 + 5 + Math.floor(i / event.config.width) * (height + 10) + margin / 2;
		node.style.transform = "translate(" + left + "px," + top + "px)";
		node.index = i;
	};
	event.resize = function () {
		let margin = 0;
		if (!get.is.phoneLayout()) {
			margin = 38;
		}
		let height = (ui.window.offsetHeight - 10 * (event.config.height + 1) - margin) / event.config.height;
		let width = (ui.window.offsetWidth - 10 * (event.config.width + 1)) / event.config.width;
		if (width * event.config.ratio < height) {
			height = width * event.config.ratio;
		} else {
			width = height / event.config.ratio;
		}
		event.width = width;
		event.height = height;
		event.margin = margin;
		for (let i = 0; i < event.config.size; i++) {
			event.moveNode(event.nodes[i], i);
			event.nodes[i].style.width = width + "px";
			event.nodes[i].style.height = height + "px";
			if (event.avatars[i]) {
				event.moveNode(event.avatars[i], event.avatars[i].index);
				event.avatars[i].style.width = width + "px";
				event.avatars[i].style.height = height + "px";
				event.avatars[i].nodename.style.fontSize = Math.max(14, Math.round(width / 5.6)) + "px";
			}
		}
		if (event.deciding) {
			const str = "px," + (event.margin / 2 - event.height * 0.5) + "px)";
			for (let i = 0; i < event.friendlist.length; i++) {
				event.friendlist[i].style.transform = "scale(1.2) translate(" + ((-(event.width + 14) * event.friendlist.length) / 2 + 7 + i * (event.width + 14)) + str;
			}
		}
	};
	lib.onresize.push(event.resize);
	event.skipnode = ui.create.system("跳过", function (this: HTMLDivElement) {
		this.remove();
		event._skiprest = true;
		if (event.imchoosing) {
			game.resume();
		}
	});
	if (get.config("change_choice")) {
		event.replacenode = ui.create.system(
			"换将",
			function () {
				event.promptbar.hide();
				while (event.avatars.length) {
					event.avatars.shift().remove();
				}
				for (let i = 0; i < event.config.size; i++) {
					event.nodes[i].show();
					event.nodes[i].style.display = "";
					clearTimeout(event.nodes[i].choosetimeout);
				}
				delete event.list2;
				event.friend.length = 0;
				event.enemy.length = 0;
				event.blank.length = 0;
				event.redoing = true;
				if (event.imchoosing) {
					game.resume();
				}
			},
			true
		);
	}
	if (get.config("free_choose")) {
		const createCharacterDialog = function () {
			event.freechoosedialog = ui.create.characterDialog();
			event.freechoosedialog.style.height = "80%";
			event.freechoosedialog.style.top = "10%";
			event.freechoosedialog.style.transform = "scale(0.8)";
			event.freechoosedialog.style.transition = "all 0.3s";
			event.freechoosedialog.listen(function () {
				if (!event.replacing) {
					event.dialoglayer.clicked = true;
				}
			});
			event.freechoosedialog.classList.add("pointerdialog");
			event.dialoglayer = ui.create.div(".popup-container.hidden", function (this: HTMLDivElement & { clicked: boolean; delete: () => void }, e: Event) {
				if (this.classList.contains("removing")) {
					return;
				}
				if (this.clicked) {
					this.clicked = false;
					return;
				}
				ui.window.classList.remove("modepaused");
				this.delete();
				e.stopPropagation();
				event.freechoosedialog.style.transform = "scale(0.8)";
				if (event.replacing) {
					event.prompt("用" + get.translation(event.replacing) + "替换一名武将");
				} else {
					if (event.side == 0) {
						event.prompt("请选择两名武将");
					} else {
						event.prompt("请选择一名武将");
					}
				}
			});
			event.dialoglayer.classList.add("modenopause");
			event.dialoglayer.appendChild(event.freechoosedialog);
			event.freechoosenode.classList.remove("hidden");
		};

		event.custom.replace.button = function (button) {
			event.replacing = button.link;
		};
		event.custom.add.window = function () {
			if (event.replacing) {
				delete event.replacing;
				if (event.side == 0) {
					event.prompt("请选择两名武将");
				} else {
					event.prompt("请选择一名武将");
				}
			}
		};
		event.freechoosenode = ui.create.system(
			"自由选将",
			function (this: HTMLDivElement) {
				if (this.classList.contains("hidden")) {
					return;
				}
				if (!event.imchoosing) {
					event.prompt("请等待敌方选将");
					return;
				}
				delete event.replacing;
				ui.window.classList.add("modepaused");
				ui.window.appendChild(event.dialoglayer);
				ui.refresh(event.dialoglayer);
				event.dialoglayer.show();
				event.freechoosedialog.style.transform = "scale(1)";
				event.promptbar.hide();
			},
			true
		);
		if (lib.onfree) {
			event.freechoosenode.classList.add("hidden");
			lib.onfree.push(createCharacterDialog);
		} else {
			createCharacterDialog();
		}
	}
	event.checkredo = function () {
		if (event.redoing) {
			event.goto(1);
			delete event.redoing;
			return true;
		}
	};
}

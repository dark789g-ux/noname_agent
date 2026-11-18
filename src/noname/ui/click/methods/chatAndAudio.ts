import { lib, game, get, _status, ui } from "noname";

function resolveActiveChatPlayer() {
	if (game.me) {
		return game.me;
	}
	if (!game.connectPlayers) {
		return undefined;
	}
	if (game.online) {
		return game.connectPlayers.find(p => p.playerid == game.onlineID);
	}
	return game.connectPlayers[0];
}

function sendQuickChatMessage(text: string): void {
	const player = resolveActiveChatPlayer();
	if (!player) {
		return;
	}
	if (game.online) {
		game.send("chat", game.onlineID, text);
	} else {
		player.chat(text);
	}
}

export const chatAndAudioMethods = {
	chat() {
		ui.system1.classList.add("shown");
		ui.system2.classList.add("shown");

		const uiintro = ui.create.dialog("hidden");
		uiintro.listen(function (e) {
			e.stopPropagation();
		});

		const list = ui.create.div(".caption") as HTMLDivElement & { _chatempty?: boolean };
		list.style.maxHeight = get.is.phoneLayout() ? "110px" : "220px";
		list.style.overflow = "scroll";
		lib.setScroll(list);
		uiintro.contentContainer.style.overflow = "hidden";

		const addEntry = function (info: [string | null | undefined, string], _clear?: boolean) {
			if (list._chatempty) {
				list.innerHTML = "";
				delete list._chatempty;
			}
			const node = ui.create.div(".text.chat");
			node.innerHTML = info[0] + ": " + info[1];
			list.appendChild(node);
			list.scrollTop = list.scrollHeight;
			uiintro.style.height = uiintro.content.scrollHeight + "px";
		};
		addEntry._origin = uiintro;
		_status.addChatEntry = addEntry;
		if (lib.chatHistory.length) {
			for (let i = 0; i < lib.chatHistory.length; i++) {
				addEntry(lib.chatHistory[i]);
			}
		} else {
			list._chatempty = true;
			list.appendChild(ui.create.div(".text.center", "无聊天记录"));
		}
		uiintro.add(list);
		uiintro.style.height = uiintro.content.offsetHeight + "px";
		list.scrollTop = list.scrollHeight;

		if (!_status.chatValue) {
			_status.chatValue = "";
		}
		const node = uiintro.add('<input type="text" value="' + _status.chatValue + '">');
		if (!(node instanceof HTMLDivElement)) {
			throw new TypeError("chat input container is not a div");
		}
		node.style.paddingTop = "0";
		node.style.marginBottom = "16px";
		const input = node.firstChild;
		if (!(input instanceof HTMLInputElement)) {
			throw new TypeError("chat input is not an input element");
		}
		input.style.width = "calc(100% - 20px)";
		input.onchange = function () {
			_status.chatValue = input.value;
		};
		input.onkeydown = function (e) {
			if (e.key == "Enter" && input.value) {
				const player = resolveActiveChatPlayer();
				const str = input.value;
				if (!player) {
					return;
				}
				if (get.is.banWords(input.value)) {
					player.say(input.value);
				} else if (game.online) {
					game.send("chat", game.onlineID, str);
				} else {
					player.chat(str);
				}
				input.value = "";
				_status.chatValue = "";
			}
			e.stopPropagation();
		};
		uiintro._onopen = function () {
			input.focus();
			list.scrollTop = list.scrollHeight;
		};
		uiintro._heightfixed = true;
		const emotionTitle = ui.create.div(".text.center", "聊天表情", function () {
			if (emotionTitle.innerHTML == "快捷语音") {
				emotionTitle.innerHTML = "聊天表情";
				list2.remove();
				list3.remove();
				uiintro.add(list1);
				while (list2.childNodes.length) {
					const firstChild = list2.firstChild;
					if (!firstChild) {
						throw new TypeError("chat emotion list child is missing");
					}
					firstChild.remove();
				}
			} else {
				emotionTitle.innerHTML = "快捷语音";
				list1.remove();
				list2.remove();
				uiintro.add(list3);
			}
		});
		uiintro.add(emotionTitle);
		const list1 = ui.create.div("");
		list1.style.height = get.is.phoneLayout() ? "110px" : "150px";
		list1.style.overflow = "scroll";
		lib.setScroll(list1);
		uiintro.add(list1);
		uiintro.style.height = uiintro.content.scrollHeight + "px";
		const list2 = ui.create.div("");
		list2.style.height = get.is.phoneLayout() ? "110px" : "150px";
		list2.style.overflow = "scroll";
		lib.setScroll(list2);

		const createEmotion = function (name: string) {
			const srcBase = `${lib.assetURL}image/emotion/${name}/`;
			const emotionCache = _status.emotion_cache;
			if (!emotionCache) {
				return;
			}
			const files = emotionCache[name];
			for (const file of files) {
				const emotionButton = Object.assign(
					ui.create.div(".card.fullskin", `<img src="${srcBase}${file}" width="50" height="50">`, function (this: HTMLDivElement & { pack: string; emotionID: string }) {
						const player = resolveActiveChatPlayer();
						if (!player) {
							return;
						}
						if (game.online) {
							game.send("emotion", game.onlineID, this.pack, this.emotionID);
						} else {
							player.emotion(this.pack, this.emotionID);
						}
					}),
					{ emotionID: file, pack: name }
				);
				emotionButton.style.height = "50px";
				emotionButton.style.width = "50px";
				list2.appendChild(emotionButton);
			}
		};
		const srcBase = `${lib.assetURL}image/emotion/`;
		for (const folder in _status.emotion_cache) {
			const emotionPack = Object.assign(
				ui.create.div(".card.fullskin", `<img src="${srcBase}${folder}/1.gif" width="50" height="50">`, function (this: HTMLDivElement & { pack: string }) {
					emotionTitle.innerHTML = get.translation(this.pack);
					createEmotion(this.pack);
					list1.remove();
					uiintro.add(list2);
				}),
				{ pack: folder }
			);
			emotionPack.style.height = "50px";
			emotionPack.style.width = "50px";
			list1.appendChild(emotionPack);
		}
		list1.scrollTop = list1.scrollHeight;
		uiintro.style.height = uiintro.content.scrollHeight + "px";
		const list3 = ui.create.div(".caption");
		list3.style.height = get.is.phoneLayout() ? "110px" : "150px";
		list3.style.overflow = "scroll";
		lib.setScroll(list3);
		for (let i = 0; i < lib.quickVoice.length; i++) {
			const voiceNode = ui.create.div(".text.chat", function (this: HTMLDivElement) {
				const str = this.innerHTML;
				if (get.is.banWords(str)) {
					resolveActiveChatPlayer()?.say(str);
				} else {
					sendQuickChatMessage(str);
				}
			});
			voiceNode.innerHTML = lib.quickVoice[i];
			list3.appendChild(voiceNode);
		}
		list3.scrollTop = list1.scrollHeight;
		return uiintro;
	},
	volumn() {
		const uiintro = ui.create.dialog("hidden");
		uiintro.listen(function (e) {
			e.stopPropagation();
		});
		uiintro.add("背景音乐");
		const vol1 = ui.create.div(".volumn");
		uiintro.add(vol1);
		for (let i = 0; i < 8; i++) {
			const span = Object.assign(document.createElement("span"), { link: i + 1 });
			span.addEventListener(lib.config.touchscreen ? "touchend" : "click", ui.click.volumn_background);
			span.innerHTML = i < lib.config.volumn_background ? "●" : "○";
			vol1.appendChild(span);
		}
		uiintro.add("游戏音效");
		const vol2 = ui.create.div(".volumn");
		uiintro.add(vol2);
		for (let i = 0; i < 8; i++) {
			const span = Object.assign(document.createElement("span"), { link: i + 1 });
			span.addEventListener(lib.config.touchscreen ? "touchend" : "click", ui.click.volumn_audio);
			span.innerHTML = i < lib.config.volumn_audio ? "●" : "○";
			vol2.appendChild(span);
		}
		uiintro.add(ui.create.div(".placeholder"));
		return uiintro;
	},
	volumn_background(this: HTMLSpanElement & { link: number }, e: Event) {
		if (_status.dragged) {
			return;
		}
		let volume = this.link;
		if (volume === 1 && lib.config.volumn_background === 1) {
			volume = 0;
		}
		game.saveConfig("volumn_background", volume);
		ui.backgroundMusic.volume = volume / 8;
		for (let i = 0; i < 8; i++) {
			const child = this.parentElement?.children[i];
			if (child instanceof HTMLElement) {
				child.innerHTML = i < lib.config.volumn_background ? "●" : "○";
			}
		}
		e.stopPropagation();
	},
	volumn_audio(this: HTMLSpanElement & { link: number }, e: Event) {
		if (_status.dragged) {
			return;
		}
		let volume = this.link;
		if (volume === 1 && lib.config.volumn_audio === 1) {
			volume = 0;
		}
		game.saveConfig("volumn_audio", volume);
		for (let i = 0; i < 8; i++) {
			const child = this.parentElement?.children[i];
			if (child instanceof HTMLElement) {
				child.innerHTML = i < lib.config.volumn_audio ? "●" : "○";
			}
		}
		e.stopPropagation();
	},
};

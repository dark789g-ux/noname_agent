import { lib, game, get, _status, ui } from "noname";
import { resolvePlayerButtonState, type PlayerButtonStatusSnapshot } from "@/llm/player-button-state.js";
import type { UI } from "../index.js";

function resetDialogHeightSet(): void {
	if (typeof ui.dialog._heightset == "string") {
		ui.dialog.style.height = ui.dialog._heightset;
	} else if (ui.dialog._heightset) {
		ui.dialog.style.height = "";
	}
	delete ui.dialog._heightset;
}

export const arenaAndPlayerStateMethods = {
	refresh(node: Element) {
		void window.getComputedStyle(node, null).getPropertyValue("opacity");
	},
	clear() {
		game.addVideo("uiClear");
		const thrown = document.getElementsByClassName("thrown");
		const nodes: Element[] = [];
		for (let i = 0; i < thrown.length; i++) {
			nodes.push(thrown[i]);
		}
		for (let i = 0; i < nodes.length; i++) {
			const node = nodes[i];
			if (node instanceof HTMLDivElement && (!("fixed" in node) || !node.fixed)) {
				node.delete();
			}
		}
	},
	update() {
		for (let i = 0; i < ui.updates.length; i++) {
			ui.updates[i]();
		}
		if (ui.dialog && !ui.dialog.classList.contains("noupdate")) {
			if (game.chess) {
				if (ui.dialog.content.scrollHeight < 240 && (!ui.dialog.buttons || !ui.dialog.buttons.length) && !ui.dialog.forcebutton) {
					ui.dialog.style.height = ui.dialog.content.offsetHeight + "px";
					ui.dialog.classList.add("slim");
				} else {
					ui.dialog.style.height = "";
					ui.dialog.classList.remove("slim");
				}
			} else {
				if ((!ui.dialog.buttons || !ui.dialog.buttons.length) && !ui.dialog.forcebutton && ui.dialog.classList.contains("fullheight") == false && get.mode() != "stone") {
					if (!ui.dialog.classList.contains("addNewRow")) {
						ui.dialog.classList.add("nobutton");
					}
					if (ui.dialog.content.offsetHeight < 240) {
						if (!ui.dialog._heightset) {
							ui.dialog._heightset = ui.dialog.style.height || true;
						}
						ui.dialog.style.height = ui.dialog.content.offsetHeight + "px";
						if (lib.config.show_log != "off") {
							ui.dialog.classList.add("scroll1");
							ui.dialog.classList.add("scroll2");
							return;
						}
					} else {
						resetDialogHeightSet();
					}
				} else {
					resetDialogHeightSet();
					if (!ui.dialog.classList.contains("addNewRow")) {
						ui.dialog.classList.remove("nobutton");
					}
				}
			}
			const height1 = ui.dialog.content.offsetHeight;
			const height2 = ui.dialog.contentContainer.offsetHeight;
			if (game.chess) {
				if (height1 < 240) {
					ui.dialog.style.height = height1 + "px";
				}
			} else {
				if (!ui.dialog.forcebutton && !ui.dialog._scrollset && (height1 <= 190 || (height2 >= height1 && height2 >= 210))) {
					ui.dialog.classList.remove("scroll1");
					ui.dialog.classList.remove("scroll2");
				} else {
					ui.dialog.classList.add("scroll1");
					ui.dialog.classList.add("scroll2");
					if (game.layout != "default") {
						ui.dialog.style.height = Math.min(height1, (game.layout == "long2" || game.layout == "nova") && ui.arena.classList.contains("choose-character") ? 380 : 350) + "px";
						ui.dialog._scrollset = true;
					}
				}
				if (game.layout == "long2" || game.layout == "nova") {
					if (height1 + 240 >= ui.arena.offsetHeight) {
						ui.dialog.classList.add("scroll3");
					} else {
						ui.dialog.classList.remove("scroll3");
					}
				}
			}
		}
	},
	recycle(node: HTMLElement | string, key?: string) {
		if (typeof node == "string") {
			return ui._recycle[node];
		}
		if (key !== undefined) {
			ui._recycle[key] = node;
		}
	},
	/**
	 * @author curpond
	 * @author Tipx-L
	 */
	updateConnectPlayerPositions(numberOfPlayers?: number) {
		if (typeof numberOfPlayers != "number") {
			const configOL = lib.configOL;
			numberOfPlayers = parseInt(configOL.player_number) || configOL.number;
		}
		if (!numberOfPlayers) {
			return;
		}
		const playerPositions = ui.playerPositions;
		playerPositions.forEach(position => {
			game.dynamicStyle.remove(position);
		});
		playerPositions.length = 0;
		const temporaryPlayer = ui.create.div(".player.connect", ui.window).hide();
		const computedStyle = getComputedStyle(temporaryPlayer);
		const halfWidth = parseFloat(computedStyle.width) / 2;
		const halfHeight = parseFloat(computedStyle.height) / 2;
		temporaryPlayer.remove();
		const halfNumberOfPlayers = Math.round(numberOfPlayers / 2);
		const upperPercentage = 100 / (halfNumberOfPlayers + 1);
		const scale = 10 / numberOfPlayers;
		for (let ordinal = 0; ordinal < halfNumberOfPlayers; ordinal++) {
			const selector = `#window>.player.connect[data-position='${ordinal}']`;
			const css: Record<string, string> = {
				left: `calc(${upperPercentage * (ordinal + 1)}% - ${halfWidth}px)`,
				top: `calc(${100 / 3}% - ${halfHeight}px)`,
			};
			if (scale < 1) {
				css["transform"] = `scale(${scale})`;
			}

			game.dynamicStyle.add(selector, css);
			playerPositions.push(selector);
		}
		const lowerPercentage = 100 / (numberOfPlayers - halfNumberOfPlayers + 1);
		for (let ordinal = halfNumberOfPlayers; ordinal < numberOfPlayers; ordinal++) {
			const selector = `#window>.player.connect[data-position='${ordinal}']`;
			const css: Record<string, string> = {
				left: `calc(${lowerPercentage * (ordinal - halfNumberOfPlayers + 1)}% - ${halfWidth}px)`,
				top: `calc(${(100 * 2) / 3}% - ${halfHeight}px)`,
			};
			if (scale < 1) {
				css["transform"] = `scale(${scale})`;
			}

			game.dynamicStyle.add(selector, css);
			playerPositions.push(selector);
		}
	},
	/**
	 * @author curpond
	 * @author Tipx-L
	 */
	updatePlayerPositions(numberOfPlayers?: number) {
		if (typeof numberOfPlayers != "number") {
			numberOfPlayers = Number.parseInt(ui.arena.dataset.number || "", 10);
		}
		// 当人数不超过8人时，还是用以前的布局
		if (!numberOfPlayers || numberOfPlayers <= 8) {
			return;
		}
		const playerPositions = ui.playerPositions;
		playerPositions.forEach(position => {
			game.dynamicStyle.remove(position);
		});
		playerPositions.length = 0;
		// 单个人物的宽度，这里要设置玩家的实际的宽度
		const temporaryPlayer = ui.create.div(".player", ui.arena).hide();
		const computedStyle = getComputedStyle(temporaryPlayer);
		const scale = 6 / numberOfPlayers;
		// 玩家顶部距离父容器上边缘的距离偏移的单位距离
		const quarterHeight = (parseFloat(computedStyle.height) / 4) * scale;
		const halfWidth = parseFloat(computedStyle.width) / 2;
		temporaryPlayer.remove();
		// 列数，即假如8人场，除去自己后，上面7个人占7列
		const columnCount = numberOfPlayers - 1;
		const percentage = 90 / (columnCount - 1);
		// 仅当游戏人数大于8人，且玩家的座位号大于0时，设置玩家的位置；因为0号位是game.me在最下方，无需设置
		for (let ordinal = 1; ordinal < numberOfPlayers; ordinal++) {
			const reversedOrdinal = columnCount - ordinal;
			// 动态计算玩家的top属性，实现拱桥的效果；只让两边的各两个人向下偏移一些
			const top = Math.max(0, Math.round(numberOfPlayers / 5) - Math.min(Math.abs(ordinal - 1), Math.abs(reversedOrdinal))) * quarterHeight;
			const selector = `#arena[data-number='${numberOfPlayers}']>.player[data-position='${ordinal}']`;
			game.dynamicStyle.add(selector, {
				left: `calc(${percentage * reversedOrdinal + 5}% - ${halfWidth}px)`,
				top: `${top}px`,
				transform: `scale(${scale})`,
			});
			playerPositions.push(selector);
		}
	},
	updateRoundNumber(roundNumber: number, cardPileNumber: number) {
		if (ui.cardPileNumber) {
			ui.cardPileNumber.innerHTML = `${roundNumber}轮 剩余牌: ${cardPileNumber}`;
		}
	},
	updateAIModeIndicator() {
		if (!ui.aiModeIndicator) return;
		const enabled = !!lib.config.llm_enabled;
		ui.aiModeIndicator.innerHTML = enabled ? "AI: 开" : "AI: 关";
		ui.aiModeIndicator.classList.toggle("on", enabled);
	},
	/**
	 * 更新所有 AI 武将牌上 LLM 日志按钮的显隐。
	 * 活动日志始终显示并高亮，避免配置或控制权变化时中断查看入口。
	 *
	 * 调用时机：gameStart、LLM 开关切换、玩家加入/离开
	 */
	updateLLMLogButtons(this: UI) {
		const players = new Set([...(game.players || []), ...(game.dead || [])]);
		for (const player of players) this.updateLLMLogButton(player);
	},
	updateLLMLogButton(player: any) {
		const button = player?.node?.llmLogBtn;
		if (!button) return;
		const playerName = player.getName();
		const state = resolvePlayerButtonState(player, _status as PlayerButtonStatusSnapshot, lib.config);
		const label = state.label || "AI";
		const title = state.active ? `${playerName}（${label}）正在思考；点击查看日志` : `查看 ${playerName}（${label}）的 AI 日志`;
		if (
			ui?.create?.playerCard?.syncLLMBadge?.(player, {
				label,
				visible: state.visible,
				highlighted: state.highlighted,
				title,
			})
		) {
			return;
		}
		button.textContent = label;
		button.style.display = state.visible ? "" : "none";
		button.classList.toggle("llm-log-btn-active", state.highlighted);
		button.title = title;
	},
};

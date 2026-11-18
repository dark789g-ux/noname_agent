import { _status, game, get, lib, ui } from "noname";
import { resolvePlayerButtonState, type PlayerButtonStatusSnapshot } from "@/llm/player-button-state.js";
import { ChildNodesWatcher } from "../../../cache/childNodesWatcher.js";
import type { Player } from "../../player.js";
import type { WatchedCardContainer } from "../contracts/instanceFieldsContract.js";

export const lifecycleBuildMethods = {
	build(this: Player, noclick?: boolean) {
		const player = this;
		player.buildNode();
		player.buildProperty();
		player.buildExtra();
		player.buildEventListener(noclick);
		return this;
	},
	buildNode(this: Player) {
		const player = this;
		if (ui.create?.playerCard?.mount) {
			ui.create.playerCard.mount(player);
			return;
		}
		const node: Record<string, HTMLDivElement> = (player.node = {
			avatar: ui.create.div(".avatar", player, ui.click.avatar).hide(),
			avatar2: ui.create.div(".avatar2", player, ui.click.avatar2).hide(),
			turnedover: ui.create.div(".turned", "<div>翻面<div>", player),
			framebg: ui.create.div(".framebg", player),
			intro: ui.create.div(".intro", player),
			identity: ui.create.div(".identity", player),
			hp: ui.create.div(".hp", player),
			name: ui.create.div(".name", player),
			name2: ui.create.div(".name.name2", player),
			nameol: ui.create.div(".nameol", player),
			count: ui.create.div(".count", player).hide(),
			equips: ui.create.div(".equips", player).hide(),
			judges: ui.create.div(".judges", player),
			marks: ui.create.div(".marks", player),
			chain: ui.create.div(".chain", "<div></div>", player),
			handcards1: ui.create.div(".handcards"),
			handcards2: ui.create.div(".handcards"),
			expansions: ui.create.div(".expansions"),
		});
		const handcards1: WatchedCardContainer = player.node.handcards1;
		const handcards2: WatchedCardContainer = player.node.handcards2;
		handcards1._childNodesWatcher = new ChildNodesWatcher(handcards1);
		handcards2._childNodesWatcher = new ChildNodesWatcher(handcards2);
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
		const config = { childList: true };
		observer.observe(node.equips, config);
		node.expansions.style.display = "none";
		const chainLength = game.layout == "default" ? 64 : 40;
		for (let repetition = 0; repetition < chainLength; repetition++) {
			ui.create.div(node.chain.firstChild, ".cardbg").style.transform = `translateX(${repetition * 5 - 5}px)`;
		}
		node.action = ui.create.div(".action", node.avatar);
	},
	buildExtra(this: Player) {
		const player = this;
		const node = player.node;
		node.link = player.mark(" ", {
			mark: get.linkintro,
		});
		(node.link.firstChild as HTMLDivElement).setBackgroundImage("image/card/tiesuo_mark.png");
		(node.link.firstChild as HTMLDivElement).style.backgroundSize = "cover";
		if (!node.identity.firstChild) {
			ui.create.div(node.identity);
		}
		// 角色卡片上方 AI 名称徽标（仅外部 LLM / CLI 控场角色或存在活跃日志时显示，点击查看日志）
		if (!node.llmLogBtn) {
			node.llmLogBtn = ui.create.div(".llm-log-btn", player);
			node.llmLogBtn.textContent = "AI";
			node.llmLogBtn.style.display = "none";
			node.llmLogBtn.addEventListener("click", function (e) {
				e.stopPropagation();
				const state = resolvePlayerButtonState(player, _status as PlayerButtonStatusSnapshot, lib.config);
				if (!state.visible) return;
				import("@/llm/openLLMPlayerLog.js")
					.then(({ openLLMPlayerLog }) => {
						openLLMPlayerLog(player);
					})
					.catch(() => {
						// 加载失败静默处理
					});
			});
		}
		ui.updateLLMLogButton(player);
	},
	buildProperty(this: Player) {
		const player = this;
		player.phaseNumber = 0;
		player.skipList = [];
		player.skills = [];
		player.invisibleSkills = [];
		player.initedSkills = [];
		player.additionalSkills = {};
		player.disabledSkills = {};
		player.hiddenSkills = [];
		player.awakenedSkills = [];
		player.forbiddenSkills = {};
		player.popups = [];
		player.damagepopups = [];
		player.judging = [];
		player.extraEquip = [];
		player.stat = [
			{
				card: {},
				skill: {},
				triggerSkill: {},
			},
		];
		player.actionHistory = [
			{
				useCard: [],
				respond: [],
				skipped: [],
				lose: [],
				gain: [],
				sourceDamage: [],
				damage: [],
				custom: [],
				useSkill: [],
			},
		];
		player.tempSkills = {};
		player.storage = {
			counttrigger: new Proxy(
				{},
				{
					get(_, prop) {
						return player.getStat("triggerSkill")[prop];
					},
					set(_, prop, value) {
						player.getStat("triggerSkill")[prop] = value;
						return true;
					},
					deleteProperty(_, prop) {
						delete player.getStat("triggerSkill")[prop];
						return true;
					},
					has(_, prop) {
						return prop in player.getStat("triggerSkill");
					},
					ownKeys() {
						return Reflect.ownKeys(player.getStat("triggerSkill"));
					},
					getOwnPropertyDescriptor(_, prop) {
						return Object.getOwnPropertyDescriptor(player.getStat("triggerSkill"), prop);
					},
				}
			),
		};
		player.marks = {};
		player.expandedSlots = {};
		player.disabledSlots = {};
		player.ai = {
			friend: [],
			enemy: [],
			neutral: [],
			handcards: {
				global: [],
				source: [],
				viewed: [],
			},
		};
		player.queueCount = 0;
		player.outCount = 0;
		player.vcardsMap = {
			handcards: [],
			equips: [],
			judges: [],
		};
		player.updates = [];
	},
	buildEventListener(this: Player, noclick?: boolean) {
		const player = this;
		const node = player.node;
		if (noclick) {
			player.noclick = true;
		} else {
			player.addEventListener(lib.config.touchscreen ? "touchend" : "click", ui.click.target);
			node.identity.addEventListener(lib.config.touchscreen ? "touchend" : "click", ui.click.identity);
			node.count.addEventListener("pointerdown", ui.click.count);

			if (lib.config.touchscreen) {
				player.addEventListener("touchstart", ui.click.playertouchstart);
				player.addEventListener("touchmove", ui.click.playertouchmove);
			}
		}
	},
};

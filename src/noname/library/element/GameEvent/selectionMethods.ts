import { _status, game, get, lib, ui } from "noname";
import { Player, Card, Button } from "../index.js";
import type { GameEvent } from "../gameEvent.js";
import { requireRegisteredSkill } from "../../skillRegistry.js";
import type { triggerSkillTodo, triggerPlayerTodo, GameEventNumberValue, GameEventCustomCallbacks, GameEventSetValue, EventSelectionRange, EventButtonFilter, EventCardFilter, EventTargetFilter, LegacySelectionCallback, EventFinalFilter, LegacySelectionChoice, EventSelectionState, EventSelectionBackup, GameEventHandlerKey, GameEventDefaultHandlerKey, GameEventHandler, GameEventSetEntry, GameEventParentFallback, EventExecution, EventCreationFields, GameEventSetFields, EventCreationFieldInput, GameDrawNumber, GameDrawNumberValue, GameDrawSupportFields, RawGameDrawEvent, GameDrawFields, GameDrawEvent, GameDrawEventDraft, EventContentFieldRequirements, EventContentNameFor } from "./eventContracts.js";

export const selectionMethods = {
	backup<E extends GameEvent<GameEventNumberValue>>(this: E, skill) {
		this._backup = {
			filterButton: this.filterButton,
			selectButton: this.selectButton,
			filterTarget: this.filterTarget,
			selectTarget: this.selectTarget,
			deadTarget: this.deadTarget,
			chessForceAll: this.chessForceAll,
			filterCard: this.filterCard,
			selectCard: this.selectCard,
			position: this.position,
			forced: this.forced,
			fakeforce: this.fakeforce,
			_aiexclude: this._aiexclude,
			allowChooseAll: this.allowChooseAll,
			complexSelect: this.complexSelect,
			complexCard: this.complexCard,
			complexTarget: this.complexTarget,
			_buttonChoice: this._buttonChoice,
			_cardChoice: this._cardChoice,
			_targetChoice: this._targetChoice,
			_skillChoice: this._skillChoice,
			ai1: this.ai1,
			ai2: this.ai2,
			filterOk: this.filterOk,
			selectionSpec: this.selectionSpec,
			selectionSpecExists: Object.hasOwn(this, "selectionSpec"),
		};
		if (skill) {
			const info = get.info(skill);
			this.skill = skill;
			this._aiexclude = [];
			if (info.viewAs) {
				if (info.filterButton != undefined) {
					this.filterButton = get.filter(info.filterButton);
				}
				if (info.selectButton != undefined) {
					this.selectButton = info.selectButton;
				}
				if (info.filterTarget != undefined) {
					this.filterTarget = get.filter(typeof info.filterTarget === "boolean" ? {} : info.filterTarget);
				}
				if (info.selectTarget != undefined) {
					this.selectTarget = info.selectTarget;
				}
				if (info.deadTarget != undefined) {
					this.deadTarget = info.deadTarget;
				}
				if (info.chessForceAll != undefined) {
					this.chessForceAll = info.chessForceAll;
				}
				if (info.filterCard != undefined) {
					if (info.ignoreMod) {
						this.ignoreMod = true;
					}
					this.filterCard2 = get.filter(typeof info.filterCard === "boolean" ? {} : info.filterCard);
					this.filterCard = function (card, player, event) {
						const evt = event || _status.event;
						if (!evt.ignoreMod && player) {
							const mod = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
							if (mod != "unchanged") {
								return mod;
							}
						}
						/*if (evt.ignoreMod) {
							console.log(card);
							card.cards = [];
						}*/
						return get.filter(evt.filterCard2).apply(this, [card, player, event]);
					};
				}
				this.filterOk = function () {
					const evt = _status.event;
					const card = get.card(),
						player = get.player();
					const savedState = evt._backup;
					if (!savedState) {
						throw new TypeError("choose event backup state is missing");
					}
					const filter = savedState.filterCard;
					if (info.viewAs && filter) {
						if (!player) {
							throw new Error("choose event filter requires a player");
						}
						if (!filter(card, player, evt)) {
							//typeof info.viewAs !== "function" &&
							return false;
						}
					}
					if (info.filterOk != undefined) {
						return info.filterOk();
					}
					const currentBackup = evt._backup;
					if (!currentBackup) {
						throw new TypeError("choose event backup state is missing");
					}
					if (currentBackup.filterOk) {
						return currentBackup.filterOk();
					}
					return true;
				};
				if (info.selectCard != undefined) {
					this.selectCard = info.selectCard;
				}
				if (info.position != undefined) {
					this.position = info.position;
				}
				//if(info.forced!=undefined) this.forced=info.forced;
				if (info.allowChooseAll != undefined) {
					this.allowChooseAll = info.allowChooseAll;
				}
				if (info.complexSelect != undefined) {
					this.complexSelect = info.complexSelect;
				}
				if (info.complexCard != undefined) {
					this.complexCard = info.complexCard;
				}
				if (info.complexTarget != undefined) {
					this.complexTarget = info.complexTarget;
				}
				if (info.ai1 != undefined) {
					this.ai1 = info.ai1;
				}
				if (info.ai2 != undefined) {
					this.ai2 = info.ai2;
				}
			} else {
				this.filterButton = info.filterButton ? get.filter(info.filterButton) : undefined;
				this.selectButton = info.selectButton;
				this.filterTarget = info.filterTarget ? get.filter(typeof info.filterTarget === "boolean" ? {} : info.filterTarget) : undefined;
				this.selectTarget = info.selectTarget;
				this.deadTarget = info.deadTarget;
				this.chessForceAll = info.chessForceAll;
				this.filterCard = info.filterCard ? get.filter(typeof info.filterCard === "boolean" ? {} : info.filterCard) : undefined;
				this.selectCard = info.selectCard;
				this.position = info.position;
				//this.forced=info.forced;
				this.allowChooseAll = info.allowChooseAll;
				this.complexSelect = info.complexSelect;
				this.complexCard = info.complexCard;
				this.complexTarget = info.complexTarget;
				if (info.ai1 != undefined) {
					this.ai1 = info.ai1;
				}
				if (info.ai2 != undefined) {
					this.ai2 = info.ai2;
				}
				this.filterOk = info.filterOk;
			}
			if (info.selectionSpec !== undefined) {
				this.selectionSpec = info.selectionSpec;
			} else {
				delete this.selectionSpec;
			}
			delete this.fakeforce;
		}
		delete this._buttonChoice;
		delete this._cardChoice;
		delete this._targetChoice;
		delete this._skillChoice;
		return this;
	},
	restore<E extends GameEvent<GameEventNumberValue>>(this: E) {
		if (this._backup) {
			this.filterButton = this._backup.filterButton;
			this.selectButton = this._backup.selectButton;
			this.filterTarget = this._backup.filterTarget;
			this.selectTarget = this._backup.selectTarget;
			this.deadTarget = this._backup.deadTarget;
			this.chessForceAll = this._backup.chessForceAll;
			this.filterCard = this._backup.filterCard;
			this.selectCard = this._backup.selectCard;
			this.position = this._backup.position;
			this.forced = this._backup.forced;
			this.fakeforce = this._backup.fakeforce;
			this._aiexclude = this._backup._aiexclude;
			this.allowChooseAll = this._backup.allowChooseAll;
			this.complexSelect = this._backup.complexSelect;
			this.complexCard = this._backup.complexCard;
			this.complexTarget = this._backup.complexTarget;
			this.ai1 = this._backup.ai1;
			this.ai2 = this._backup.ai2;
			this._buttonChoice = this._backup._buttonChoice;
			this._cardChoice = this._backup._cardChoice;
			this._targetChoice = this._backup._targetChoice;
			this._skillChoice = this._backup._skillChoice;
			this.filterOk = this._backup.filterOk;
			if (this._backup.selectionSpecExists) {
				this.selectionSpec = this._backup.selectionSpec;
			} else {
				delete this.selectionSpec;
			}
		}
		delete this.skill;
		delete this.ignoreMod;
		delete this.filterCard2;
		return this;
	},
	resume<E extends GameEvent<GameEventNumberValue>>(this: E) {
		delete this._buttonChoice;
		delete this._cardChoice;
		delete this._targetChoice;
		delete this._skillChoice;
		return this;
	},
};

export type SelectionMethods = typeof selectionMethods;

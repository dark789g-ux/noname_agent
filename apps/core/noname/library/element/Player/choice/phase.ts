import { _status, game, get } from "noname";
import type { GameEvent, GameEventParentFallback } from "../../gameEvent.js";
import type { Player } from "../../player.js";
import "../contracts/choiceAndPhaseContract.js";
import { requireParentEvent } from "../dom/nodeGuards.js";

export const phaseMethods = {
	isPhaseUsing(this: Player, notmeisok?: boolean): boolean {
		if (!notmeisok && _status.currentPhase != this) {
			return false;
		}
		return _status.event.name == "phaseUse" || _status.event.getParent("phaseUse").name == "phaseUse";
	},

	insertPhase(this: Player, skill?: string, insert?: boolean): GameEvent {
		let evt: GameEvent | GameEventParentFallback | null = _status.event.getParent("phase") as GameEvent | GameEventParentFallback;
		let next: GameEvent;
		if (evt && evt.parent && evt.parent.next) {
			evt = evt.parent as GameEvent;
			next = game.createEvent("phase", false, requireParentEvent(evt));
		} else if (_status.event.parent && _status.event.parent.next) {
			evt = _status.event.parent as GameEvent;
			next = game.createEvent("phase", false, requireParentEvent(evt));
		} else {
			evt = null;
			next = game.createEvent("phase", false);
		}
		if (evt && insert && requireParentEvent(evt).next.includes(next)) {
			requireParentEvent(evt).next.remove(next);
			requireParentEvent(evt).next.unshift(next);
		}
		next.player = this;
		next.forceDie = true;
		next.includeOut = true;
		next.skill = skill || _status.event.name;
		next.setContent("phase");
		return next;
	},

	phase(this: Player, skill?: string): GameEvent {
		const next = game.createEvent("phase", false);
		next.player = this;
		next.setContent("phase");
		if (!_status.roundStart) {
			_status.roundStart = this;
		}
		if (skill) {
			next.skill = skill;
		}
		next.forceDie = true;
		next.includeOut = true;
		return next;
	},

	phaseZhunbei(this: Player): GameEvent {
		const next = game.createEvent("phaseZhunbei");
		next.player = this;
		next.setContent("phaseZhunbei");
		return next;
	},

	phaseJudge(this: Player): GameEvent {
		const next = game.createEvent("phaseJudge");
		next.player = this;
		next.setContent("phaseJudge");
		return next;
	},

	phaseDraw(this: Player): GameEvent {
		const next = game.createEvent("phaseDraw");
		next.player = this;
		next.num = 2;
		if ((get.config("first_less") || _status.connectMode || _status.first_less_forced) && game.phaseNumber == 1 && _status.first_less) {
			next.num--;
		}
		next.setContent("phaseDraw");
		return next;
	},

	phaseUse(this: Player): GameEvent {
		const next = game.createEvent("phaseUse", false);
		next.player = this;
		next.setContent("phaseUse");
		return next;
	},

	phaseDiscard(this: Player): GameEvent {
		const next = game.createEvent("phaseDiscard");
		next.player = this;
		next.setContent("phaseDiscard");
		return next;
	},

	phaseJieshu(this: Player): GameEvent {
		const next = game.createEvent("phaseJieshu");
		next.player = this;
		next.setContent("phaseJieshu");
		return next;
	},

	skip(this: Player, name: string): void {
		this.skipList.add(name);
	},
};

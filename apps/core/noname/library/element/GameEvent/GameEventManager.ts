import { lib } from "noname";
import { ActiveEventExecution, EventExecution, GameEvent } from "../gameEvent.js";

export type NonameGameEventChangedArgs = [newEvent: EventExecution | undefined, oldEvent: EventExecution | undefined];

export default class GameEventManager {
	get [Symbol.toStringTag]() {
		return "GameEventManager";
	}
	eventStack: ActiveEventExecution[] = [];
	rootEvent?: ActiveEventExecution;
	tempEvent?: ActiveEventExecution;
	get event() {
		return this.getStatusEvent();
	}
	getStartedEvent() {
		return this.tempEvent || this.eventStack.at(-1);
	}
	getStatusEvent() {
		return this.tempEvent || this.eventStack.at(-1) || this.rootEvent;
	}
	setStatusEvent(event: ActiveEventExecution, internal: boolean = false) {
		if (!(event instanceof GameEvent)) {
			return;
		}

		const oldEvent = this.getStatusEvent();
		if (this.eventStack.length === 0) {
			this.rootEvent = event;
			if (internal) {
				this.eventStack.push(event);
			}
		} else if (internal) {
			this.eventStack.push(event);
		} else if (this.eventStack.includes(event)) {
			this.tempEvent = event;
		} else {
			throw new Error("Cannot assign a value to _status.event that is not in eventStack.");
		}

		if (oldEvent == null || event !== oldEvent) {
			lib.announce.publish<NonameGameEventChangedArgs>("Noname.Game.Event.Changed", [event, oldEvent]);
		}
	}
	popStatusEvent() {
		const lastEvent = this.eventStack.pop();
		const now = this.getStatusEvent();
		if (lastEvent == null || lastEvent !== now) {
			lib.announce.publish<NonameGameEventChangedArgs>("Noname.Game.Event.Changed", [now, lastEvent]);
		}
	}
}

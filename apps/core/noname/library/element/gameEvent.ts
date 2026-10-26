import { _status, game, get, lib, ui } from "noname";
import { Player, Card, Button } from "./index.js";
import ContentCompiler from "./GameEvent/compilers/ContentCompiler.js";
import { EventCompileable, EventCompiledContent, EventContentBinding, PublicEventContentCallback } from "./GameEvent/compilers/IContentCompiler.js";
import GameEventManager from "./GameEvent/GameEventManager.js";
import type { EventLogSkill } from "./GameEvent/logSkill.js";
import type { CardMoveCandidate } from "../experimental/cardInput.js";
import type { EventAnimation } from "./GameEvent/eventContracts.js";
import type { triggerSkillTodo, triggerPlayerTodo, GameEventNumberValue, GameEventCustomCallbacks, GameEventSetValue, EventSelectionRange, EventButtonFilter, EventCardFilter, EventTargetFilter, LegacySelectionCallback, EventFinalFilter, LegacySelectionChoice, EventSelectionState, EventSelectionBackup, GameEventHandlerKey, GameEventDefaultHandlerKey, GameEventHandler, GameEventSetEntry, GameEventParentFallback, EventExecution, EventCreationFields, GameEventSetFields, EventCreationFieldInput, GameDrawNumber, GameDrawNumberValue, GameDrawSupportFields, RawGameDrawEvent, GameDrawFields, GameDrawEvent, GameDrawEventDraft, EventContentFieldRequirements, EventContentNameFor, EventSelectionFields } from "./GameEvent/eventContracts.js";
import { installEventMethods } from "./GameEvent/installEventMethods.js";
import "./GameEvent/eventMethodsContract.js";
import { triggerMethods, type TriggerMethods } from "./GameEvent/triggerMethods.js";
import { selectionMethods, type SelectionMethods } from "./GameEvent/selectionMethods.js";
import { promiseMethods, type PromiseMethods } from "./GameEvent/promiseMethods.js";
import { handlersMethods, type HandlersMethods } from "./GameEvent/handlersMethods.js";
import { stateMethods, type StateMethods } from "./GameEvent/stateMethods.js";
export { GameEventManager, ContentCompiler };
export { initializeEvent } from "./GameEvent/initializeEvent.js";
export type { GameEventNumberValue, GameEventHandlerKey, GameEventParentFallback, EventExecution, ActiveEventExecution, EventCreationFields, GameEventSetFields, RawGameDrawEvent, GameDrawFields, GameDrawEvent, GameDrawEventDraft, EventContentFieldRequirements } from "./GameEvent/eventContracts.js";

export class GameEvent<N extends GameEventNumberValue = never> implements PromiseLike<void>, EventSelectionState {
	constructor(name: string | GameEvent<GameEventNumberValue> = "", trigger: boolean = true, manager: GameEventManager = _status.eventManager) {
		if (name instanceof GameEvent) {
			const other = name;
			name = other.name;
			manager = other.manager;
			trigger = other._triggered !== null;
		}

		this.name = name;
		this.manager = manager;
		if (trigger && !game.online) {
			this._triggered = 0;
		}
		game.globalEventHandlers.addHandlerToEvent(this);
	}
	static initialGameEvent() {
		const event = new GameEvent();
		event.finish();
		return event;
	}
	get [Symbol.toStringTag]() {
		return "GameEvent";
	}
	name: string;
	declare hsskill?: string;
	/** A DOM transition listener used by the guhuo animation paths. */
	onEnd01?: () => void;
	/** Parent override supplied by the online send/receive path. */
	_modparent?: GameEvent<GameEventNumberValue>;
	_cancelled?: boolean;
	_neutralize_event?: GameEvent<GameEventNumberValue>;
	isSkipped?: boolean;
	/** History-log identifier written by game.logv; ancestor lookup can yield null. */
	declare logvid?: string | null;
	/** Card/skill use may opt out of counting; absence preserves normal counting. */
	declare addCount?: boolean;
	/** The button-choice producer can bypass a redundant confirmation. */
	declare direct?: boolean;
	/** Card-choice and movement producers explicitly reveal their cards. */
	declare visible?: boolean;
	/** Delay-card and move-card choices set whether judgement is skipped. */
	declare nojudge?: boolean;
	/** Movement content records whether the draw-pile counter needs refresh. */
	declare updatePile?: boolean;
	/** Timestamp removed by the asynchronous card-transition listener. */
	declare waitingForTransition?: number;
	/** The discard animation hands transition ownership to its parent. */
	declare discardTransition?: boolean;
	/** Created by the choose-all UI and closed/deleted by selection cleanup. */
	declare cardChooseAll?: Control;
	/** Choice-dialog producers force the existing direct-confirmation branch. */
	declare forceDirect?: boolean;
	/** The skill-trigger content records its direct activation path. */
	declare _direct?: boolean;
	/** chooseUseTarget can bypass range checks without changing card identity. */
	declare nodistance?: boolean;
	/** The useCard producer can suppress this action's AI identity inference. */
	declare noai?: boolean;
	/** The useCard producer can disable the nullification response window. */
	declare nowuxie?: boolean;
	/** Choice producers store already-rendered secondary prompt text. */
	declare prompt2?: string;
	/** The secondary-prompt UI can opt into centered text. */
	declare centerprompt2?: boolean;
	/** Choice producers may return selected cards without performing the action. */
	declare chooseonly?: boolean;
	/** Nullification choices can defer card use until the response is accepted. */
	declare nouse?: boolean;
	/** Skill producers can keep their current choice state across AI retries. */
	declare norestore?: boolean;
	/** Gain/expansion producers can suppress the delay after moving cards. */
	declare delay?: boolean;
	/** Choice producers explicitly require a target even with no target step. */
	declare targetRequired?: boolean;
	/** Draw configuration is deleted after its no-animation option is applied. */
	declare nodelay?: boolean;
	/** chooseUseTarget's legacy option suppresses its child use-card delay. */
	declare nodelayx?: boolean;
	/** Use-card content and sha's damage branch can suppress the final delay. */
	declare delayx?: boolean;
	/** Compare producers explicitly request the delayed comparison branch. */
	declare isDelay?: boolean;
	/** chooseUseTarget/respond producers can suppress their skill-name popup. */
	declare nopopup?: boolean;
	/** Card-use producers can disable throwing the physical card animation. */
	declare throw?: boolean;
	/** chooseUseTarget passes this option to its useCard child's targetDelay. */
	declare noTargetDelay?: boolean;
	/** useCard can suppress the waiting interval between its target effects. */
	declare targetDelay?: boolean;
	/** The useCard producer records that its AI log is deferred; never a callback. */
	declare postAi?: boolean;
	/** Skills and mode rules can exclude every target of an existing card use. */
	declare all_excluded?: boolean;
	/** Legacy pile/lose options insert cards at the top of the selected pile. */
	declare insert_card?: boolean;
	/** The pile factory requests the wash hook before recording movement. */
	declare washCard?: boolean;
	/** The pile factory applies movement immediately and leaves content to trigger hooks. */
	declare _triggeronly?: boolean;
	/** HP/skill-change producers choose whether to display their popup. */
	declare popup?: boolean;
	/** Set by simultaneous comparison content after validating participants. */
	declare compareMeanwhile?: boolean;
	/** Set only after the multiple-comparison callback child has been bound. */
	declare compareMultiple?: boolean;
	/** Dialog/replay content writes the shared numeric video counter or an existing dialog ID. */
	declare videoId?: number;
	/** The deprecated hand-display content records its own dialog ID. */
	declare dialogid?: number;
	/** Discard animation content records its parent's numeric discard batch ID. */
	declare discardid?: number;
	/** Draw/respond flags and gain's legacy string or event-callback animation. */
	declare animate?: EventAnimation;
	numFixed?: boolean;
	_rand_map?: Record<string, number>;
	_rand?: number;
	/**
	 * Step-cache values are keyed by generated strings and can be produced by
	 * arbitrary callers.  They remain unknown until the consumer validates its
	 * own cache entry contract.
	 */
	declare _stepCache?: Record<string, unknown>;
	/** Nested string-keyed cache used by AI helpers. */
	declare _tempCache?: Record<string, Record<string, unknown>>;
	_args: any[] = [];
	_set: [string, any][] = [];
	set(this: this, entries: GameEventSetEntry<N>[]): this;
	set<K extends keyof GameEventSetFields<N>>(this: this, key: K, value: GameEventSetFields<N>[K]): this & Record<K, GameEventSetFields<N>[K]>;
	set(key: string | GameEventSetEntry<N>[], value?: GameEventSetValue) {
		if (Array.isArray(key)) {
			for (let i = 0; i < key.length; i++) {
				if (Array.isArray(key[i])) {
					this.setRaw(key[i][0], key[i][1]);
				}
			}
		} else {
			if (typeof key != "string") {
				console.log("warning: using non-string object as event key");
				console.log(key, value);
				console.log(_status.event);
			}
			this.setRaw(key, value);
		}
		return this;
	}
	private setRaw(key: string, value: GameEventSetValue) {
		Object.assign(this, { [key]: value });
		this._set.push([key, value]);
	}
	content: EventCompiledContent;
	setContent(this: this, content: PublicEventContentCallback): this;
	setContent(this: this, content: EventCompiledContent): this;
	setContent<const Name extends string>(this: this, content: EventContentNameFor<this, Name>): this;
	setContent<E extends this>(this: E, content: EventContentBinding<E>): E;
	setContent<E extends this>(this: E, content: EventContentBinding<E> | string | EventCompiledContent): E {
		if (this.#inContent) {
			throw new Error("Cannot set content when content is running");
		}
		if (typeof content === "string") {
			this.content = ContentCompiler.compile(content);
		} else if ("compiled" in content && content.compiled) {
			this.content = ContentCompiler.compile(content);
		} else {
			this.content = ContentCompiler.compile(content, this);
		}
		return this;
	}
	/**
	 * 事件的返回值
	 */
	result: GameEventResult;
	declare logSkill?: EventLogSkill;
	cost_data: Result["cost_data"];
	/**
	 * Attaches callbacks for the resolution and/or rejection of the Promise.
	 * @param onfulfilled The callback to execute when the Promise is resolved.
	 * @param onrejected The callback to execute when the Promise is rejected.
	 * @returns A Promise for the completion of which ever callback is executed.
	 */
	then<TResult1, TResult2>(onfulfilled?: (() => TResult1 | Promise<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | null): Promise<TResult1 | TResult2> {
		return (this.parent ? this.parent.waitNext().then(() => undefined) : this.start()).then(onfulfilled, onrejected);
	}
	manager: GameEventManager;
	parent?: GameEvent<GameEventNumberValue>;
	childEvents: GameEvent<GameEventNumberValue>[] = [];
	next: GameEvent<GameEventNumberValue>[] = (() => {
		const event = this;
		return new Proxy<GameEvent<GameEventNumberValue>[]>([], {
			set(target, p, childEvent, receiver) {
				if (childEvent instanceof GameEvent && !target.includes(childEvent)) {
					childEvent.parent = event;
					const type = childEvent.getDefaultNextHandlerType();
					if (type) {
						childEvent.pushHandlersFrom(type, event.getHandler(type));
					}
					if (event.#inContent && event.finished) {
						childEvent.resolve();
					}
				}
				return Reflect.set(target, p, childEvent);
			},
		});
	})();
	after: GameEvent<GameEventNumberValue>[] = [];
	insert(content: Exclude<EventCompileable, string>, map: Record<string, GameEventSetValue>): GameEvent;
	insert<const Name extends string>(content: EventContentNameFor<GameEvent, Name>, map: Record<string, GameEventSetValue>): GameEvent;
	insert(content: EventCompileable, map: Record<string, GameEventSetValue>) {
		const next = new GameEvent(`${this.name}Inserted`, false, this.manager);
		this.next.push(next);
		if (typeof content === "string") {
			next.setContent(content);
		} else if ("compiled" in content && content.compiled) {
			next.setContent(content);
		} else {
			next.setContent(content);
		}
		for (const [key, value] of Object.entries(map)) {
			next.setRaw(key, value);
		}
		return next;
	}
	insertAfter(content: Exclude<EventCompileable, string>, map: Record<string, GameEventSetValue>): GameEvent;
	insertAfter<const Name extends string>(content: EventContentNameFor<GameEvent, Name>, map: Record<string, GameEventSetValue>): GameEvent;
	insertAfter(content: EventCompileable, map: Record<string, GameEventSetValue>) {
		const next = new GameEvent(`${this.name}Inserted`, false, this.manager);
		this.after.push(next);
		if (typeof content === "string") {
			next.setContent(content);
		} else if ("compiled" in content && content.compiled) {
			next.setContent(content);
		} else {
			next.setContent(content);
		}
		for (const [key, value] of Object.entries(map)) {
			next.setRaw(key, value);
		}
		return next;
	}
	_trigger?: GameEvent<GameEventNumberValue>;
	triggername?: string;
	_triggered: number | null | undefined = null;
	#start?: Promise<void>;
	resolve() {
		if (!this.#start) {
			this.#start = Promise.resolve();
		}
	}
	start() {
		if (this.#start) {
			return this.#start;
		}
		this.#start = (async () => {
			if (this.parent) {
				this.parent.childEvents.push(this);
			}
			game.getGlobalHistory("everything").push(this);
			// if (this.manager.eventStack.length === 0) {
			// 	this.manager.rootEvent = this;
			// }
			// this.manager.eventStack.push(this);
			this.manager.setStatusEvent(this, true);
			await this.loop().then(() => {
				// this.manager.eventStack.pop();
				this.manager.popStatusEvent();
			});
		})();
		return this.#start;
	}
	async loop() {
		const trigger = async (trigger: string, to: number) => {
			this._triggered = to;
			if (this.type == "card") {
				await this.trigger("useCardTo" + trigger);
			}
			await this.trigger(this.name + trigger);
		};
		if (await this.checkSkipped()) {
			return;
		}
		while (true) {
			await this.waitNext();
			if (!this.finished) {
				if (this._triggered === 0) {
					await trigger("Before", 1);
				} else if (this._triggered === 1) {
					await trigger("Begin", 2);
				} else {
					this.#inContent = true;
					let next = this.content(this).catch(error => {
						if (lib.config.ignore_error || (_status.connectMode && !lib.config.debug)) {
							game.print("游戏出错：" + this.name);
							game.print(error.toString());
							console.error(error);
						} else {
							throw error;
						}
					});
					await next.finally(() => (this.#inContent = false));
				}
			} else {
				if (this._triggered === 1) {
					await trigger("Omitted", 4);
				} else if (this._triggered === 2) {
					await trigger("End", 3);
				} else if (this._triggered === 3) {
					await trigger("After", 4);
				} else if (this.after.length) {
					this.next.push(this.after.shift()!);
				} else {
					return;
				}
			}
		}
	}
	#waitNext?: Promise<Partial<Result> | void>;
	waitNext(): Promise<Partial<Result> | void> {
		if (this.#waitNext) {
			return this.#waitNext;
		}
		this.#waitNext = (async () => {
			let result;
			while (true) {
				await _status.pauseManager.waitPause();
				if (this.manager.tempEvent) {
					if (this.manager.tempEvent === this) {
						this.manager.tempEvent = void 0;
					} else {
						this.cancel(true, null, "notrigger");
						return result;
					}
				}
				if (!this.next.length) {
					return result;
				}
				const next = this.next[0];
				await next.start();
				if (next.result) {
					result = next.result;
				}
				this.next.shift();
			}
		})().finally(() => (this.#waitNext = undefined));
		return this.#waitNext;
	}
	doingList: triggerPlayerTodo[];
	playerMap?: triggerSkillTodo[];
	/**
	 * 当前执行的arrangeTrigger事件
	 */
	_triggering?: GameEvent<GameEventNumberValue>;
	// This callback is invoked through an event instance.  Its receiver can be
	// any executable event; tying it to this class's numeric value-domain would
	// make otherwise identical GameEvent<N> instances invariant in N.
	filterStop?: (this: GameEvent<GameEventNumberValue>) => unknown;
	notrigger: boolean;
	_notrigger: Player[] = [];
	/**
	 * content执行中的标志，如果inContent && finished则不执行子事件
	 */
	#inContent = false;
	finished = false;
	// @todo
	_neutralized = false;
	#step: number = 0;
	#nextStep: number | null = null;
	/**
	 * 最后一个子事件的result
	 */
	_result: GameEventIntermediateResult = {};
	get step() {
		return this.#step;
	}
	set step(num) {
		this.#nextStep = num;
	}
	updateStep() {
		if (this.#nextStep === null) {
			return;
		}
		this.#step = this.#nextStep;
		this.#nextStep = null;
	}
	custom: GameEventCustomCallbacks = {
		add: {},
		replace: {},
	};
	type: string;
	source: Player | null | undefined;
	player?: Player | null;
	players?: Player[];
	target?: Player | "cardPile" | null;
	targets?: Player[];
	card?: VCard | Card;
	cards?: CardMoveCandidate[];
	skill?: string;
	forced?: boolean;
	/** Every event accepts numeric counts; N adds documented non-numeric count forms. */
	num?: number | N | undefined;
	original_num: number;
	directHit: Player[] | true;
	baseDamage: number;
	extraDamage: number;
	customSource: Player;
	nature: string;
	unreal: boolean;
	responded: boolean;
	judgestr?: string;
	judging: boolean;
	judge2?: (...args: any) => any;
	orderingCards: Card[];
	ai?: (...args: any) => any;
	_aiexclude: (string | Card)[] = [];
	forceDie?: boolean;
	includeOut?: boolean;
	targetprompt2: ((...args: any) => any)[] = [];
	/**
	 * @overload
	 * @param {...((event: GameEvent, option: {
	 * state?: 'begin' | 'end';
	 * }) => void)[]} handlers
	 * @returns {number}
	 */
	/**
	 * @overload
	 * @param {Parameters<typeof this.hasHandler>[0]} type
	 * @param {...((event: GameEvent, option: {
	 * state?: 'begin' | 'end';
	 * }) => void)[]} handlers
	 * @returns {number}
	 */
	pushHandler(...handlers: GameEventHandler[]): number;
	pushHandler(type: GameEventHandlerKey, ...handlers: GameEventHandler[]): number;
	pushHandler(...args: (GameEventHandlerKey | GameEventHandler)[]): number {
		const first = args[0];
		const handlers = this.getHandler(typeof first == "string" ? first : this.getDefaultHandlerType());
		if (!Array.isArray(handlers)) {
			throw new TypeError("Event handler did not normalize to an array");
		}
		return handlers.push(...(typeof first == "string" ? args.slice(1) : args));
	}
	private pushHandlersFrom(type: GameEventHandlerKey, handlers: unknown): number {
		const target = this.getHandler(type);
		if (!Array.isArray(target) || !Array.isArray(handlers)) {
			throw new TypeError("Event handler did not normalize to an array");
		}
		return target.push(...handlers);
	}
	_oncancel?: (...args: any) => any;
	excludeButton: Button[];
}

installEventMethods(GameEvent.prototype, [triggerMethods, selectionMethods, promiseMethods, handlersMethods, stateMethods]);

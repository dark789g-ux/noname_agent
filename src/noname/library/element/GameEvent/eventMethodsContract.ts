import type { GameEvent } from "../gameEvent.js";
import type { Player, Card, Button } from "../index.js";
import type { BroadSelect } from "../Player/type.js";
import type { EventCompiledContent } from "./compilers/IContentCompiler.js";
import type GameEventManager from "./GameEventManager.js";
import type { EventLogSkill } from "./logSkill.js";
import type { CardMoveCandidate } from "../../experimental/cardInput.js";
import type { triggerSkillTodo, triggerPlayerTodo, GameEventNumberValue, GameEventCustomCallbacks, GameEventSetValue, EventSelectionRange, EventButtonFilter, EventCardFilter, EventTargetFilter, LegacySelectionCallback, EventFinalFilter, LegacySelectionChoice, EventSelectionState, EventSelectionBackup, GameEventHandlerKey, GameEventDefaultHandlerKey, GameEventHandler, GameEventSetEntry, GameEventParentFallback, EventExecution, ActiveEventExecution, EventCreationFields, GameEventSetFields, EventCreationFieldInput, GameDrawNumber, GameDrawNumberValue, GameDrawSupportFields, RawGameDrawEvent, GameDrawFields, GameDrawEvent, GameDrawEventDraft, EventContentFieldRequirements, EventContentNameFor } from "./eventContracts.js";
import type { EventSelectionFields } from "./eventContracts.js";

/** Public signatures retain the original type parameters and polymorphic this. */
export interface EventPublicMethods {
	/**
	 * Attaches a callback for only the rejection of the Promise.
	 * @param onrejected The callback to execute when the Promise is rejected.
	 * @returns A Promise for the completion of which ever callback is executed.
	 */
	catch<TResult>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | null): Promise<TResult>;
	/**
	 * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
	 * resolved value cannot be modified from the callback.
	 * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
	 * @returns A Promise for the completion of the callback.
	 */
	finally(onfinally?: (() => void) | null): Promise<void>;
	/**
	 * 获取 Result 对象中的信息。
	 * @example
	 * ```js
	 * const chooseCardResult = await player.chooseCard().forResult();
	 * // 获取整个结果对象，然后访问如 chooseCardResult.cards 等属性
	 * ```
	 */
	forResult(): Promise<GameEventResult>;
	/**
	 * 获取事件的父节点。
	 * 获取事件链上的指定事件。
	 * 默认获取上一个父节点（核心）。
	 * @param level 获取深度（number）/指定名字（string）/指定特征（function）
	 * @param forced 若获取不到节点，默认返回{}，若forced为true则返回undefined
	 * @param includeSelf 若level不是数字，指定搜索时是否包含事件本身
	 */
	getParent(level?: number, forced?: false): GameEvent<GameEventNumberValue> | GameEventParentFallback;
	getParent(level: number | undefined, forced: true): GameEvent<GameEventNumberValue> | undefined;
	getParent(level: number | undefined, forced: boolean): GameEvent<GameEventNumberValue> | GameEventParentFallback | undefined;
	getParent(level: string, forced?: false, includeSelf?: boolean): GameEvent<GameEventNumberValue> | GameEventParentFallback;
	getParent(level: string, forced: true, includeSelf?: boolean): GameEvent<GameEventNumberValue> | undefined;
	getParent(level: string, forced: boolean, includeSelf?: boolean): GameEvent<GameEventNumberValue> | GameEventParentFallback | undefined;
	getParent(level: (evt: GameEvent<GameEventNumberValue>) => boolean, forced?: false, includeSelf?: boolean): GameEvent<GameEventNumberValue> | GameEventParentFallback;
	getParent(level: (evt: GameEvent<GameEventNumberValue>) => boolean, forced: true, includeSelf?: boolean): GameEvent<GameEventNumberValue> | undefined;
	getParent(level: (evt: GameEvent<GameEventNumberValue>) => boolean, forced: boolean, includeSelf?: boolean): GameEvent<GameEventNumberValue> | GameEventParentFallback | undefined;
	getParent(level: number | string | ((evt: GameEvent<GameEventNumberValue>) => boolean) | undefined, forced?: boolean, includeSelf?: boolean): GameEvent<GameEventNumberValue> | GameEventParentFallback | undefined;
	getTrigger(): GameEvent<GameEventNumberValue> | undefined;
	checkSkipped(): Promise<boolean>;
	addTrigger(skills: any, player: any): this;
	removeTrigger(skills: any, player: any): this;
	trigger(name: string): GameEvent | null | undefined;
	/**
	 * @param {boolean | "currentOnly"} all
	 */
	untrigger(all?: boolean | "currentOnly", player?: Player): this;
	finish(): void;
	cancel(all?: any, player?: any, notrigger?: any): any;
	neutralize(event?: GameEvent<never>): Promise<undefined>;
	unneutralize(): void;
	goto(step: number): this;
	redo(): this;
	backup(skill: any): this;
	restore(): this;
	getPlayer(): Player;
	getPlayers(): Player[];
	getTarget(): Player;
	getTargets(): Player[];
	changeToZero(): this;
	setHiddenSkill(skill: string): this;
	getLogv(): string | null;
	send(): this;
	/**
	 * 在可await/异步情况下获取客机执行的结果
	 */
	sendAsync(): Promise<unknown | null>;
	getRand(name?: string): number;
	isMine(): boolean | undefined;
	isOnline(): boolean | undefined;
	notLink(): boolean;
	isPhaseUsing(player: any): boolean;
	/**
	 * @param {Parameters<typeof this.hasHandler>[0]} type
	 * @param {GameEvent} event
	 * @param {{
	 * state?: 'begin' | 'end';
	 * }} option
	 * @returns {this}
	 */
	callHandler(
		type: GameEventHandlerKey,
		event: GameEvent<GameEventNumberValue>,
		option: {
			state?: "begin" | "end";
		}
	): this;
	getDefaultHandlerType(): GameEventDefaultHandlerKey;
	getDefaultNextHandlerType(): GameEventDefaultHandlerKey;
	/**
	 * Returns the raw dynamic handler slot after the legacy normalization write.
	 * Accessors may replace that slot, so callers that need an array must check
	 * the returned value at their own operation boundary.
	 */
	getHandler(type?: GameEventHandlerKey): unknown;
	hasHandler(type?: GameEventHandlerKey): boolean;
	putStepCache(key: string, value: unknown): this;
	getStepCache(key: string): unknown;
	clearStepCache(key?: string | null): this;
	callFuncUseStepCache(prefix: string, func: unknown, params: unknown[]): unknown;
	putTempCache(key1: string, key2: string, value: unknown): unknown;
	getTempCache(key1: string, key2: string): unknown;
	resume(): this;
}

declare module "../gameEvent.js" {
	interface GameEvent<N extends GameEventNumberValue = never> extends EventSelectionFields, EventPublicMethods {}
}

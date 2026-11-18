import type { ActiveEventExecution, GameEvent } from "../../gameEvent.js";

/**
 * Public callbacks run before a dynamic event necessarily has trigger or
 * player fields. Callers must guard either value before using its abilities.
 */
export type EventContentCallback<E = GameEvent> = (event: E, trigger?: GameEvent, player?: Player | null, result?: Partial<Result>) => unknown;
export type PublicEventContentCallback = EventContentCallback;

/**
 * A compiler can be reached through the public dynamic entry point as well as
 * a named content registry.  The latter does not make `trigger` or `player`
 * initialized at the public boundary, so it deliberately shares the guarded
 * callback contract instead of widening that boundary with a registry-only
 * overload.
 */
export type EventContentBinding<E = GameEvent> = EventContentCallback<E> | EventContentCallback<E>[];
export type EventContent = EventContentBinding;

/**
 * Legacy named content is registered with the engine before it reaches the
 * public dynamic compiler entry.  Those callbacks use the historical three
 * required parameters, so keep that producer-only shape separate from
 * EventCompileable: callers of `ContentCompiler.compile` still receive the
 * guarded public callback contract above.
 */
export type RegisteredEventContent = ContentFuncByAll | ContentFuncsByAll;
export type CompilerEventContent = EventContent | RegisteredEventContent;

// 指示标准的事件content应该是只接受event一个参数的异步函数，同时有一个属性指示编译前的content类型
export type EventCompiledContent = ((e: ActiveEventExecution) => Promise<void>) & {
	compiled: true;
	type: string;
	original: EventCompileable;
	/**
	 * array content的原始值
	 */
	originals?: EventContentCallback[];
};
export type EventCompileable = EventContent | string | EventCompiledContent;
export type PublicEventCompileable = EventCompileable;

export interface IContentCompiler {
	/**
	 * ```plain
	 * 当前编译器的事件content类型
	 * ```
	 */
	type: string;

	/**
	 * ```plain
	 * 判断事件content是否被当前编译器支持
	 * ```
	 *
	 * @param content 事件content
	 */
	filter(content: CompilerEventContent): boolean;

	/**
	 * 对content执行编译
	 * 并返回标准的事件content
	 *
	 * @param content 要编译的content
	 */
	/** The compiler plug-in receives content only after named registry entries resolve. */
	compile(content: CompilerEventContent): (e: ActiveEventExecution) => Promise<void>;
}

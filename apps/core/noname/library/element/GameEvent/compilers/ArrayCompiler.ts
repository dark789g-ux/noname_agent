import { GameEvent, type ActiveEventExecution } from "../../gameEvent.js";
import { CompilerEventContent } from "./IContentCompiler.ts";
import ContentCompilerBase from "./ContentCompilerBase.ts";

export default class ArrayCompiler extends ContentCompilerBase {
	type = "array";

	filter(content: CompilerEventContent): boolean {
		return Array.isArray(content) && content.every(item => typeof item === "function");
	}

	compile(content: CompilerEventContent) {
		if (!Array.isArray(content)) {
			throw new ReferenceError("content必须是一个数组");
		}

		const compiler = this;
		return async function (this: GameEvent, event: ActiveEventExecution) {
			if (!Number.isInteger(event.step)) {
				event.step = 0;
			}

			while (!event.finished) {
				if (event.step >= content.length) {
					event.finish();
					break;
				}
				compiler.beforeExecute(event);
				event.step++;
				let result: Result | undefined;
				if (!compiler.isPrevented(event)) {
					const original = content[event.step];
					result = await Reflect.apply(original, this, [event, event._trigger, event.player, event._result]);
				}
				const nextResult = await event.waitNext();
				event._result = result ?? nextResult ?? event._result;
				compiler.afterExecute(event);
			}
		};
	}
}

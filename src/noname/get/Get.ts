import { GeneratorFunction, AsyncFunction, AsyncGeneratorFunction, security, get } from "./dependencies.js";

import { Is } from "./is.js";
import { Promises } from "./promises";
import { Audio } from "./audio.ts";
import { installGetMethods } from "./installGetMethods.js";
import { methodGroups, methodOrder } from "./methodGroups.js";
import "./contracts/cardContract.js";
import "./contracts/eventContract.js";
import "./contracts/characterContract.js";
import "./contracts/platformContract.js";
import "./contracts/textContract.js";
import "./contracts/serializationContract.js";
import "./contracts/utilityContract.js";
import "./contracts/uiContract.js";
import "./contracts/aiContract.js";
import "./contracts/runtimeContract.js";
import "./contracts/eventFields.js";
type FunctionType = "async" | "generator" | "agenerator" | "any" | null;
export class Get {
	is = new Is();

	promises = new Promises();

	Audio = Audio;

	/**
	 * 用于`get.max`和`get.min`的内部函数，感谢Javascript已经有了真正的私有化。
	 *
	 * 考虑到该函数不会暴露出去，干脆不考虑命名规范了，怎么申必怎么来。
	 *
	 * @param { any[] } list
	 * @param { string | ((item: any) => number)} func
	 * @param { "item" | "list" | undefined } type
	 * @param { number } sign - 正为max，负为min
	 */
	static #_extreme(list: any[], func: string | ((item: any) => number), type: "item" | "list" | undefined, sign: number) {
		if (typeof func === "string") {
			const key = func;
			func = item => item[key];
		}

		if (!list.length) {
			if (type === "list") {
				return [];
			}
			if (type === "item") {
				return undefined;
			}
			return func(undefined);
		}

		let result = list[0];
		let extreme = func(result);

		if (type === "list") {
			const resultList = [result];
			for (let i = 1; i < list.length; i++) {
				const item = list[i];
				const value = func(item);
				const compared = sign * (value - extreme);
				if (compared > 0) {
					extreme = value;
					resultList.length = 0;
					resultList.push(item);
				} else if (value == extreme) {
					resultList.push(item);
				}
			}
			return resultList;
		}

		for (let i = 1; i < list.length; i++) {
			const item = list[i];
			const value = func(item);
			if (sign * (value - extreme) > 0) {
				result = item;
				extreme = value;
			}
		}
		return type === "item" ? result : extreme;
	}

	/**
	 * 获取列表中指定数值最大的结果。
	 *
	 * @template T
	 * @overload
	 * @param { T[] } list - 待比较的列表
	 * @param { string | ((item: T) => number) } func - 用于取数值的属性名或函数
	 * @returns { number | undefined }
	 *
	 * @template T
	 * @overload
	 * @param { T[] } list - 待比较的列表
	 * @param { string | ((item: T) => number) } func - 用于取数值的属性名或函数
	 * @param { "item" } type - 返回最大项
	 * @returns { T | undefined }
	 *
	 * @template T
	 * @overload
	 * @param { T[] } list - 待比较的列表
	 * @param { string | ((item: T) => number) } func - 用于取数值的属性名或函数
	 * @param { "list" } type - 返回所有并列最大项
	 * @returns { T[] }
	 */
	max<T>(list: T[], func: string | ((item: T) => number)): number | undefined;
	max<T>(list: T[], func: string | ((item: T) => number), type: "item"): T | undefined;
	max<T>(list: T[], func: string | ((item: T) => number), type: "list"): T[];
	max<T>(list: T[], func: string | ((item: T) => number), type?: "item" | "list"): number | T | T[] | undefined {
		return Get.#_extreme(list, func, type, 1);
	}

	/**
	 * 获取列表中指定数值最小的结果。
	 *
	 * @template T
	 * @overload
	 * @param { T[] } list - 待比较的列表
	 * @param { string | ((item: T) => number) } func - 用于取数值的属性名或函数
	 * @returns { number | undefined }
	 *
	 * @template T
	 * @overload
	 * @param { T[] } list - 待比较的列表
	 * @param { string | ((item: T) => number) } func - 用于取数值的属性名或函数
	 * @param { "item" } type - 返回最小项
	 * @returns { T | undefined }
	 *
	 * @template T
	 * @overload
	 * @param { T[] } list - 待比较的列表
	 * @param { string | ((item: T) => number) } func - 用于取数值的属性名或函数
	 * @param { "list" } type - 返回所有并列最小项
	 * @returns { T[] }
	 */
	min<T>(list: T[], func: string | ((item: T) => number)): number | undefined;
	min<T>(list: T[], func: string | ((item: T) => number), type: "item"): T | undefined;
	min<T>(list: T[], func: string | ((item: T) => number), type: "list"): T[];
	min<T>(list: T[], func: string | ((item: T) => number), type?: "item" | "list"): number | T | T[] | undefined {
		return Get.#_extreme(list, func, type, -1);
	}

	plainTextMap = new Map();

	/** @type {RegExp} */
	#specialHeadPattern = /^(?:async\b)?\s*[\w$]+\s*=>/;

	/** @type {RegExp} */
	#functionHeadPattern = /^(?:async\b\s*)?(?:function\b\s*)?(?:\*\s*)?(?:[\w$]+\b\s*)?\(/;

	/** @type {RegExp} */
	#illegalFunctionHeadPattern = /^(?:async\b\s*)?\*\s*\(/;

	/** @type {RegExp} */
	#functionNeckPattern = /^\)\s*(?:=>\s*\{|=>|\{)/;

	/** @type {RegExp} */
	#identifierPattern = /\b[\w$]+\b/;

	/** @type {RegExp} */
	#asyncHeadPattern = /^async[\s*(]/;

	/**
	 * ```plain
	 * 测试一段代码是否为函数体
	 * ```
	 *
	 * @typedef {"async"|"generator"|"agenerator"|"any"|null} FunctionType
	 *
	 * @param {string} code
	 * @param {FunctionType} type
	 * @returns {boolean}
	 */
	isFunctionBody(code: string, type: FunctionType = /* (function(){return null})() */ null): boolean {
		const canCreateFunction = security.isSandboxRequired() && security.importSandbox().Marshal.canCreateFunction;
		if (canCreateFunction) {
			return canCreateFunction("", code, type);
		}
		if (type == "any") {
			return (
				(["async", "generator", "agenerator", null] as FunctionType[])
					// Supported function kinds are checked by isFunctionBody.
					.some(t => get.isFunctionBody(code, t))
			);
		}
		try {
			switch (type) {
				default:
					new Function(code);
					break;
				case "generator":
					new GeneratorFunction(code);
					break;
				case "async":
					new AsyncFunction(code);
					break;
				case "agenerator":
					new AsyncGeneratorFunction(code);
					break;
			}
		} catch (e) {
			return false;
		}
		return true;
	}

	/**
	 * ```plain
	 * 清洗函数体代码
	 * ```
	 *
	 * @param {string} str
	 * @param {boolean} log
	 * @returns {string}
	 */
	pureFunctionStr(str: string, log: boolean = false): string {
		const emptyFunction = "function () {}";
		str = str.trim();
		// 对于特殊的箭头函数特殊处理: identifier => ...
		const specialMatch = get.#specialHeadPattern.exec(str);
		if (specialMatch) {
			let body = str.slice(specialMatch[0].length).trim();
			if (body.startsWith("{") && body.endsWith("}")) {
				body = body.slice(1, -1);
			} else {
				body = `return ${body}`;
			}
			if (!get.isFunctionBody(body, "any")) {
				if (log) {
					console.warn("发现无法识别的远程代码:", str);
				}
				return emptyFunction;
			}
			return `${specialMatch[0]}{${body}}`;
		}
		// 匹配函数头
		const functionHead = get.#functionHeadPattern.exec(str);
		if (!functionHead) {
			if (log) {
				console.warn("发现无法识别的远程代码:", str);
			}
			return emptyFunction;
		}
		// 检查非法函数头
		if (get.#illegalFunctionHeadPattern.test(functionHead[0])) {
			if (log) {
				console.warn("发现无法识别的远程代码:", str);
			}
			return emptyFunction;
		}
		// 遍历字符串来寻找参数列表的关闭括号
		const headLen = functionHead[0].length;
		let start = headLen;
		let foundClose;
		let verifiedParams: any = null;
		while ((foundClose = str.indexOf(")", start)) >= 0) {
			const tempParams = str.slice(headLen, foundClose);
			// 检查收集到的参数列表是否是有效的
			if (get.isFunctionParam(tempParams)) {
				verifiedParams = tempParams;
				break;
			}
			start = foundClose + 1;
		}
		if (verifiedParams == null) {
			if (log) {
				console.warn("发现无法识别的远程代码:", str);
			}
			return emptyFunction;
		}
		// 检查函数连接
		const neckStart = str.slice(foundClose);
		const neckMatch = get.#functionNeckPattern.exec(neckStart);
		if (!neckMatch) {
			if (log) {
				console.warn("发现无法识别的远程代码:", str);
			}
			return emptyFunction;
		}
		// 箭头函数分流检查
		if (neckMatch[0].includes("=>")) {
			let funcHead = functionHead[0];
			let idMatch;
			while ((idMatch = get.#identifierPattern.exec(funcHead))) {
				if (idMatch[0] != "async") {
					if (log) {
						console.warn("发现无法识别的远程代码:", str);
					}
					return emptyFunction;
				}
				funcHead = funcHead.slice(idMatch.index + idMatch[0].length);
			}
		} else {
			let funcHead = functionHead[0];
			let idMatch;
			while ((idMatch = get.#identifierPattern.exec(funcHead))) {
				if (idMatch[0] != "async") {
					break;
				}
				funcHead = funcHead.slice(idMatch.index + idMatch[0].length);
			}
			if (!idMatch) {
				if (log) {
					console.warn("发现无法识别的远程代码:", str);
				}
				return emptyFunction;
			}
		}
		// 块类型分流
		const isBlock = neckMatch[0].endsWith("{");
		let funcBody;
		if (isBlock) {
			if (!str.endsWith("}")) {
				if (log) {
					console.warn("发现无法识别的远程代码:", str);
				}
				return emptyFunction;
			}
			funcBody = "{" + str.slice(foundClose + neckMatch[0].length);
		} else {
			// 将表达式函数体转换成块函数体
			funcBody = `{ return ${str.slice(foundClose + neckMatch[0].length)}; }`;
		}
		// 收集函数类型
		let funcType = 0;
		if (functionHead[0].includes("*")) {
			funcType |= 1;
		}
		if (get.#asyncHeadPattern.test(functionHead[0])) {
			funcType |= 2;
		}
		// 检查函数体
		const checkType = ([null, "generator", "async", "agenerator"] as FunctionType[])[funcType];
		// Preserve the original runtime protocol.
		if (!get.isFunctionBody(funcBody, checkType)) {
			if (log) {
				console.warn("发现无法识别的远程代码:", str);
			}
			return emptyFunction;
		}
		// 开始构造最终的函数
		let finalStr = ` (${verifiedParams}) ${funcBody}`;
		if (funcType & 1) {
			finalStr = "*" + finalStr;
		}
		finalStr = "function" + finalStr;
		if (funcType & 2) {
			finalStr = "async " + finalStr;
		}
		return finalStr;
	}

	static #cardProperFunctions = new Set(["name", "type", "subtype", "color", "suit", "number"]);

	/**
	 * 将过滤函数或对象条件标准化为过滤函数。
	 *
	 * 传入对象条件时，会检查返回函数调用参数中第 `index` 个对象是否匹配该条件。
	 * 若被检查对象是牌，`name`、`type`、`subtype`、`color`、`suit`、`number` 会通过对应的 get 方法取值。
	 *
	 * @param { ((...args: any[]) => boolean) | Record<string, any> } [filter] 过滤函数或对象条件
	 * @param { number } [index=0] 要检查的参数下标
	 * @returns { (...args: any[]) => boolean } 标准化后的过滤函数
	 */
	filter(filter?: Record<string, any> | ((...args: any[]) => boolean), index?: number): (...args: any[]) => boolean {
		if (typeof filter === "function") {
			// Preserve the original runtime protocol.
			return filter as (...args: any[]) => boolean;
		}
		if (index == null) {
			index = 0;
		}
		const result = (...args: any[]) => {
			const item = args[index];
			if (filter == null) {
				// 旧代码中，判断完是否相等后，便开始执行遍历，而for in null不会进入循环
				// 因此如果传入null，则必然返回true
				// 考虑到传入null的合理情况基本没有，还是兼容为好
				return true;
			}
			if (filter == item) {
				return true;
			}
			const isCard = get.itemtype(item) === "card";
			for (const key in filter) {
				if (!Object.prototype.hasOwnProperty.call(filter, key)) {
					continue;
				}
				const value = filter[key];
				if (isCard) {
					const proper = Get.#cardProperFunctions.has(key);
					const target = proper ? get[key](item) : item[key];
					if (!matches(value, target)) {
						return false;
					}
				} else if (item[key] != value) {
					return false;
				}
			}
			return true;
		};
		result._filter_args = [filter, index];
		return result;

		function matches(value, target) {
			if (Array.isArray(value)) {
				return value.includes(target);
			}
			return target == value;
		}
	}
}
installGetMethods(Get.prototype, methodGroups, methodOrder);

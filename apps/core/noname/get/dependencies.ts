import { rootURL, game, lib, _status, ui } from "noname";
import * as pinyinPro from "pinyin-pro";
import NonameDictionary from "./pinyins/noname-dict.js";
import { GeneratorFunction, AsyncFunction, AsyncGeneratorFunction, userAgentLowerCase } from "@/util/index.js";
import { security, CodeSnippet, ErrorManager } from "@/util/sandbox.js";
import JSZip from "jszip";
import { HTMLPoptipElement } from "@/library/poptip.js";
import { CacheContext } from "@/library/cache/cacheContext.js";
import { getRegisteredSkill, requireRegisteredSkill, type SkillRegistry } from "../library/skillRegistry.js";
import { copyValue } from "./copy.js";
import { get } from "./binding.js";
export { rootURL, game, lib, _status, ui, pinyinPro, NonameDictionary, GeneratorFunction, AsyncFunction, AsyncGeneratorFunction, userAgentLowerCase, security, CodeSnippet, ErrorManager, JSZip, HTMLPoptipElement, CacheContext, getRegisteredSkill, requireRegisteredSkill, copyValue };
export { get } from "./binding.js";
// 用于标识Map、Set等对象在序列化中的类型
// 使用了md5("__noname_type")的值作为键
// 尽可能减少碰撞喵（应该不会碰撞的吧）
export const TYPE_KEY = "a60e024487f63a67c634d782aaaf1127";

/**
 * @typedef {Omit<Row_Item_Option, "itemContainerCss"> & { itemContainerCss?: Partial<CSSStyleDeclaration>, suit?: string, color?: string }} RuntimeRowItemOption
 */

/**
 * @param {number | Player} seat
 * @returns {seat is Player}
 */
export function isPlayerSeat(seat: number | Player): seat is Player {
	return get.itemtype(seat) === "player";
}

/**
 * @param {Player | string} value
 * @returns {value is Player}
 */
export function isCharacterTitlePlayer(value: Player | string): value is Player {
	return get.itemtype(value) == "player";
}

/**
 * @param {import("../library/skillRegistry.js").SkillRegistry} registry
 * @param {string} key
 * @returns {string[] | undefined}
 */
export function getSubfrequent(registry: SkillRegistry, key: string): string[] | undefined {
	return getRegisteredSkill(registry, key)?.subfrequent;
}

import { game } from "noname";
import type { Player } from "@/library/contracts/runtime.js";
import type { NodeRuntimeBase } from "@/library/contracts/runtime.js";
import type { NodePlatformRuntime } from "@/library/contracts/runtime.js";
import type { NodeServerRuntime } from "@/library/contracts/runtime.js";

/**
 * @param {NodePlatformRuntime | NodeServerRuntime | NodeRuntimeReset | undefined} node
 * @returns {node is NodePlatformRuntime}
 */
export function isNodePlatformRuntime(node: NodeRuntimeBase | undefined): node is NodePlatformRuntime {
	return !!node && node.fs != null && node.path != null && typeof node.debug == "function";
}

/**
 * @param {NodePlatformRuntime | NodeServerRuntime | NodeRuntimeReset | undefined} node
 * @returns {node is NodeServerRuntime}
 */
export function isNodeServerRuntime(node: NodeRuntimeBase | undefined): node is NodeServerRuntime {
	return !!node && "clients" in node && Array.isArray(node.clients) && "banned" in node && Array.isArray(node.banned) && "observing" in node && Array.isArray(node.observing) && "torespond" in node && typeof node.torespond == "object" && node.torespond !== null && !Array.isArray(node.torespond) && "torespondtimeout" in node && typeof node.torespondtimeout == "object" && node.torespondtimeout !== null && !Array.isArray(node.torespondtimeout) && "waitForResult" in node && typeof node.waitForResult == "object" && node.waitForResult !== null && !Array.isArray(node.waitForResult);
}

/**
 * @returns {Player[]}
 */
export function requireConnectPlayers(): Player[] {
	const connectPlayers = game.connectPlayers;
	if (!connectPlayers) {
		throw new Error("联机大厅生命周期错误：game.connectPlayers 未初始化");
	}
	return connectPlayers;
}
/**
 * @returns {NodePlatformRuntime}
 */
export function requireNodePlatform(this: import("@/library/index.js").Library): NodePlatformRuntime {
	const node = this.node;
	if (!isNodePlatformRuntime(node)) {
		throw new TypeError("Node 平台生命周期错误：平台能力未初始化");
	}
	return node;
}
/**
 * @returns {NodeServerRuntime | undefined}
 */
export function getNodeServer(this: import("@/library/index.js").Library): NodeServerRuntime | undefined {
	const node = this.node;
	if (!isNodeServerRuntime(node)) {
		return undefined;
	}
	return node;
}
/**
 * @returns {NodeServerRuntime}
 */
export function requireNodeServer(this: import("@/library/index.js").Library): NodeServerRuntime {
	const node = this.getNodeServer();
	if (!node) {
		throw new TypeError("联机服务器生命周期错误：服务器能力未初始化");
	}
	return node;
}
/**
 * 在已初始化的 Node 平台上建立联机服务器状态。保留原对象身份，避免断开外部引用。
 * @returns {NodeServerRuntime}
 */
export function startNodeServer(this: import("@/library/index.js").Library): NodeServerRuntime {
	const node = this.node;
	if (!node) {
		throw new TypeError("联机服务器生命周期错误：服务器容器未初始化");
	}
	node.clients = [];
	node.banned = [];
	node.observing = [];
	node.torespond = {};
	node.torespondtimeout = {};
	node.waitForResult = {};
	return this.requireNodeServer();
}

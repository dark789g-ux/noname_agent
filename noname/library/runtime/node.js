import "../../../noname.js";
import { game } from "../../game/index.js";
function isNodePlatformRuntime(node) {
  return !!node && node.fs != null && node.path != null && typeof node.debug == "function";
}
function isNodeServerRuntime(node) {
  return !!node && "clients" in node && Array.isArray(node.clients) && "banned" in node && Array.isArray(node.banned) && "observing" in node && Array.isArray(node.observing) && "torespond" in node && typeof node.torespond == "object" && node.torespond !== null && !Array.isArray(node.torespond) && "torespondtimeout" in node && typeof node.torespondtimeout == "object" && node.torespondtimeout !== null && !Array.isArray(node.torespondtimeout) && "waitForResult" in node && typeof node.waitForResult == "object" && node.waitForResult !== null && !Array.isArray(node.waitForResult);
}
function requireConnectPlayers() {
  const connectPlayers = game.connectPlayers;
  if (!connectPlayers) {
    throw new Error("联机大厅生命周期错误：game.connectPlayers 未初始化");
  }
  return connectPlayers;
}
function requireNodePlatform() {
  const node = this.node;
  if (!isNodePlatformRuntime(node)) {
    throw new TypeError("Node 平台生命周期错误：平台能力未初始化");
  }
  return node;
}
function getNodeServer() {
  const node = this.node;
  if (!isNodeServerRuntime(node)) {
    return void 0;
  }
  return node;
}
function requireNodeServer() {
  const node = this.getNodeServer();
  if (!node) {
    throw new TypeError("联机服务器生命周期错误：服务器能力未初始化");
  }
  return node;
}
function startNodeServer() {
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
export {
  getNodeServer,
  isNodePlatformRuntime,
  isNodeServerRuntime,
  requireConnectPlayers,
  requireNodePlatform,
  requireNodeServer,
  startNodeServer
};

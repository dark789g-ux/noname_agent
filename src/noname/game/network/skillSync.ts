import { lib, get, ui } from "noname";
import { debounce } from "@/util/utils.js";
import { game } from "../index.js";
import type { Game } from "../index.js";

const skillSyncDebounceByGame = new WeakMap<Game, Record<string, Record<string, Function>>>();
const skillRequestDebounceByGame = new WeakMap<Game, Record<string, Record<string, Function>>>();
const skillSyncTicks = new WeakMap<Player, Record<string, Record<string, number>>>();

function getDebounceBucket(store: WeakMap<Game, Record<string, Record<string, Function>>>, instance: Game, skill: string): Record<string, Function> {
	let map = store.get(instance);
	if (!map) {
		map = {};
		store.set(instance, map);
	}
	return (map[skill] ??= {});
}

export const skillSyncMethods = {
	syncSkillData(this: Game, skill: string, sync: string, ...args: any[]): void {
		if ("observe" in game && game.observe) {
			return;
		}

		const bucket = getDebounceBucket(skillSyncDebounceByGame, game, skill);
		(bucket[sync] ??= debounce((...args: any[]) => {
			game.send("dataSync", { type: "skill", name: skill, key: sync, args }, null);
		}))(...args);
	},
	requestSkillData(this: Game, skill: string, sync: string, timeout: number | null, ...args: any[]): Promise<[boolean, any]> {
		if ("observe" in game && game.observe) {
			return Promise.resolve([false, null]);
		}

		if (!timeout || !Number.isFinite(timeout) || timeout <= 0) {
			timeout = 5000;
		}

		const bucket = getDebounceBucket(skillRequestDebounceByGame, game, skill);
		return (bucket[sync] ??= debounce(
			(timeout: number, ...args: any[]) => {
				const id = (function () {
					while (true) {
						const id = Math.random().toString(36).slice(2);
						if (!(id in game.dataRequestMap)) {
							return id;
						}
					}
				})();
				const { promise, resolve } = Promise.withResolvers<[boolean, any]>();

				game.dataRequestMap[id] = (ok: boolean, result: any) => resolve([ok, result]);
				game.send("dataSync", { type: "skill", name: skill, key: sync, args, timeout }, id);

				const timeoutPromise = new Promise<[boolean, any]>(resolve => {
					setTimeout(() => {
						delete game.dataRequestMap[id];
						resolve([false, game.SKILL_SYNC_RESULTS.REQUEST_TIMEOUT]);
					}, timeout);
				});

				return Promise.any([promise, timeoutPromise]);
			},
			{
				delay: 500,
				failResult: [false, game.SKILL_SYNC_RESULTS.TOO_MANY_CALLS],
			}
		))(timeout, ...args);
	},
	async respondSkillData(this: Game, id: string | null, player: Player, subject: { name: string; key: string; args: any[]; timeout: number }): Promise<[boolean, any] | undefined> {
		const { name: skill, key: sync, args, timeout } = subject;
		if (typeof skill !== "string" || typeof sync !== "string" || !Array.isArray(args) || typeof timeout !== "number") {
			return [false, game.SKILL_SYNC_RESULTS.INVALID_ARGUMENT];
		}

		const info = get.info(skill);
		if (!info) {
			return [false, game.SKILL_SYNC_RESULTS.MISSING_SKILL];
		}

		if (!lib.skill.global.includes(skill) && !player.hasSkill(skill, true, true, false)) {
			return [false, game.SKILL_SYNC_RESULTS.SKILL_NOT_GRANTED];
		}

		const syncList = info.sync;
		const targetFunction = syncList?.[sync];
		if (typeof targetFunction !== "function") {
			return [false, game.SKILL_SYNC_RESULTS.MISSING_SKILL_SYNC];
		}

		const ticksMap = skillSyncTicks.get(player);
		const lastTicks = ticksMap?.[skill]?.[sync] ?? NaN;
		if (!isNaN(lastTicks) && lastTicks > Date.now() - 500) {
			return [false, game.SKILL_SYNC_RESULTS.TOO_MANY_REQUESTS];
		}

		const newTicksMap = ticksMap ?? {};
		const newSkillTicks = newTicksMap[skill] ?? (newTicksMap[skill] = {});
		newSkillTicks[sync] ??= Date.now();
		skillSyncTicks.set(player, newTicksMap);

		return [true, await targetFunction.call(syncList, player, ...args, timeout)];
	},
	sendTo(this: Game, id: string, message: any) {
		return new lib.element.Client(new lib.element.NodeWS(id), true).send(message);
	},
	createServer(this: Game) {
		lib.startNodeServer();
		lib.playerOL = {};
		lib.cardOL = {};
		lib.vcardOL = {};
		lib.wsOL = {};
		ui.create.roomInfo();
		ui.create.chat();
		if (game.onlineroom) {
			void 0;
		} else {
			const WebSocketServer = require("ws").Server;
			const wss = new WebSocketServer({ port: 8080 });
			game.ip = get.ip();
			wss.on("connection", lib.init.connection);
		}
	},
};

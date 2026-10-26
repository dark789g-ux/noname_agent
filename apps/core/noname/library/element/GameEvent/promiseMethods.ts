import { _status, game, get, lib, ui } from "noname";
import { Player, Card, Button } from "../index.js";
import type { GameEvent } from "../gameEvent.js";
import { requireRegisteredSkill } from "../../skillRegistry.js";
import type { triggerSkillTodo, triggerPlayerTodo, GameEventNumberValue, GameEventCustomCallbacks, GameEventSetValue, EventSelectionRange, EventButtonFilter, EventCardFilter, EventTargetFilter, LegacySelectionCallback, EventFinalFilter, LegacySelectionChoice, EventSelectionState, EventSelectionBackup, GameEventHandlerKey, GameEventDefaultHandlerKey, GameEventHandler, GameEventSetEntry, GameEventParentFallback, EventExecution, EventCreationFields, GameEventSetFields, EventCreationFieldInput, GameDrawNumber, GameDrawNumberValue, GameDrawSupportFields, RawGameDrawEvent, GameDrawFields, GameDrawEvent, GameDrawEventDraft, EventContentFieldRequirements, EventContentNameFor } from "./eventContracts.js";

export const promiseMethods = {
	/**
	 * Attaches a callback for only the rejection of the Promise.
	 * @param onrejected The callback to execute when the Promise is rejected.
	 * @returns A Promise for the completion of which ever callback is executed.
	 */
	catch<E extends GameEvent<GameEventNumberValue>, TResult>(this: E, onrejected?: ((reason: any) => TResult | Promise<TResult>) | null): Promise<TResult> {
		return this.then(void 0, onrejected);
	},
	/**
	 * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
	 * resolved value cannot be modified from the callback.
	 * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
	 * @returns A Promise for the completion of the callback.
	 */
	finally<E extends GameEvent<GameEventNumberValue>>(this: E, onfinally?: (() => void) | null): Promise<void> {
		return this.then(
			() => {
				if (onfinally) {
					onfinally();
				}
			},
			err => {
				if (onfinally) {
					onfinally();
				}
				throw err;
			}
		);
	},
	/**
	 * 获取 Result 对象中的信息。
	 * @example
	 * ```js
	 * const chooseCardResult = await player.chooseCard().forResult();
	 * // 获取整个结果对象，然后访问如 chooseCardResult.cards 等属性
	 * ```
	 */
	async forResult<E extends GameEvent<GameEventNumberValue>>(this: E): Promise<GameEventResult> {
		await this;
		return this.result;
	},
	getTrigger<E extends GameEvent<GameEventNumberValue>>(this: E): GameEvent<GameEventNumberValue> | undefined {
		return this.getParent(e => !!e._trigger, true, true)?._trigger;
	},
	send<E extends GameEvent<GameEventNumberValue>>(this: E) {
		this.getPlayer().send(
			function (name, args, set, event, skills) {
				const player = game.getMe();
				player.applySkills(skills);
				const next = player[name].apply(player, args);
				for (let i = 0; i < set.length; i++) {
					next.set(set[i][0], set[i][1]);
				}
				if (next._backupevent) {
					next.backup(next._backupevent);
				}
				next._modparent = event;
				game.resume();
			},
			this.name,
			this._args || [],
			this._set,
			get.stringifiedResult(this.parent),
			get.skillState(this.getPlayer())
		);
		this.getPlayer().wait();
		game.pause();
		return this;
	},
	/**
	 * 在可await/异步情况下获取客机执行的结果
	 */
	sendAsync<E extends GameEvent<GameEventNumberValue>>(this: E): Promise<unknown | null> {
		return new Promise<unknown | null>(resolve => {
			this.send();
			const node = lib.getNodeServer();
			const playerid = this.getPlayer().playerid;
			if (!node || !playerid) {
				resolve(null);
				return;
			}

			if (!Array.isArray(node.waitForResult[playerid])) {
				node.waitForResult[playerid] = [resolve];
			} else {
				node.waitForResult[playerid].push(resolve);
			}
		});
	},
};

export type PromiseMethods = typeof promiseMethods;

import type { Card, GameEvent, Player, VCard } from "../../index.js";
import type { EventDamageParams, EventGainMaxHpParams, EventLoseMaxHpParams, EventRecoverParams, EventRecoverToParams } from "../type.js";
import type { TempSkillExpire } from "./instanceFieldsContract.js";

export type LegacyDamageToken = number | string | Card | Card[] | VCard | CardBaseUIData | Player | undefined | null;
export type LegacyRecoverToken = number | string | Card | Card[] | VCard | CardBaseUIData | Player | undefined | null;
export type LegacyMaxHpToken = EventLoseMaxHpParams | EventGainMaxHpParams | number | boolean | undefined;

export interface RestMap {
	type?: string;
	count?: number;
	[key: string]: any;
}

export interface RestEndMap {
	hp?: number | null;
	[key: string]: any;
}

export interface RestStateRecord {
	type: string;
	count: number;
	[key: string]: any;
}

declare module "../../player.js" {
	interface Player {
		/**
		 * 获取角色的体力值（默认不小于0，设置 `raw` 为 `true` 获取原始体力值）。
		 */
		getHp(raw: true): number | undefined;
		getHp(raw?: false): number;
		getHp(raw?: boolean): number | undefined;

		/**
		 * 获取角色已损失的体力值（设置 `raw` 为 `true` 基于原始体力值计算）。
		 */
		getDamagedHp(raw?: boolean): number;

		/**
		 * 令玩家受到伤害。
		 */
		damage(params?: EventDamageParams): GameEvent;
		damage(...args: LegacyDamageToken[]): GameEvent;

		/**
		 * 令玩家回复体力。
		 */
		recover(params?: EventRecoverParams): GameEvent;
		recover(...args: LegacyRecoverToken[]): GameEvent;

		/**
		 * 令玩家回复体力至指定值。
		 */
		recoverTo(num?: number, args?: EventRecoverToParams | any[]): GameEvent;

		/**
		 * 令玩家流失体力。
		 */
		loseHp(num?: number): GameEvent;

		/**
		 * 扣减玩家的体力上限。
		 */
		loseMaxHp(params?: EventLoseMaxHpParams): GameEvent;
		loseMaxHp(...args: LegacyMaxHpToken[]): GameEvent;

		/**
		 * 令玩家获得体力上限。
		 */
		gainMaxHp(params?: EventGainMaxHpParams): GameEvent;
		gainMaxHp(...args: LegacyMaxHpToken[]): GameEvent;

		/**
		 * 调整玩家的体力。
		 */
		changeHp(num: number, popup?: boolean): GameEvent;

		/**
		 * 调整玩家的护甲值。
		 */
		changeHujia(num?: number, type?: "gain" | "lose" | "damage" | "null" | string, limit?: number | boolean): GameEvent;

		getBuff(...args: (number | boolean)[]): this;
		getDebuff(...args: (number | boolean)[]): this;

		/**
		 * 令玩家进入濒死状态。
		 */
		dying(reason?: GameEvent): GameEvent | undefined;

		/**
		 * 令玩家死亡。
		 */
		die(reason?: GameEvent | "nosource"): GameEvent;

		/**
		 * 令玩家进入休整状态。
		 */
		rest(restMap?: RestMap): GameEvent;

		/**
		 * 令玩家结束休整状态。
		 */
		restEnd(restEndMap?: RestEndMap): GameEvent;

		/**
		 * 令玩家复活。
		 */
		revive(hp?: number, log?: boolean): void;

		/**
		 * 令玩家复活（事件化）。
		 */
		reviveEvent(hp?: number, log?: boolean): GameEvent;

		isMad(): boolean;
		goMad(end?: TempSkillExpire): void;
		unMad(): void;
		tempHide(): void;

		/**
		 * 令角色翻面。
		 */
		turnOver(bool?: boolean): GameEvent;
		out(skill?: number | string): void;
		in(skill?: number | string | boolean): void;

		/**
		 * 令一名角色横置或重置。
		 */
		link(bool?: boolean): GameEvent;
		addLink(): void;
		removeLink(): void;

		isAlive(): boolean;
		isDead(): boolean;

		/**
		 * 判断角色是否处于休整状态。
		 */
		isRest(): false | RestStateRecord | undefined;
		isDying(): boolean;
		isDamaged(): boolean;
		isHealthy(): boolean;

		isMaxMaxHp(only?: boolean, filter?: (player: Player) => boolean): boolean;
		isMinMaxHp(only?: boolean, filter?: (player: Player) => boolean): boolean;
		isMaxHp(only?: boolean, raw?: boolean, filter?: (player: Player) => boolean): boolean;
		isMinHp(only?: boolean, raw?: boolean, filter?: (player: Player) => boolean): boolean;
		isMaxCard(only?: boolean, filter?: (player: Player) => boolean): boolean;
		isMinCard(only?: boolean, filter?: (player: Player) => boolean): boolean;
		isMaxHandcard(only?: boolean, filter?: (player: Player) => boolean): boolean;
		isMinHandcard(only?: boolean, filter?: (player: Player) => boolean): boolean;
		isMaxEquip(only?: boolean, filter?: (player: Player) => boolean): boolean;
		isMinEquip(only?: boolean, filter?: (player: Player) => boolean): boolean;

		isLinked(): boolean;
		isTurnedOver(): boolean;
		isOut(): boolean;
		isMin(distance?: boolean): boolean;
		isIn(): boolean;
		isUnseen(num?: number): boolean;
		isUnderControl(self?: boolean, me?: Player | null): boolean;
		isMine(): boolean;
		isOnline(): boolean;
		isOnline2(): boolean;
		isOffline(): boolean;

		/**
		 * 获取一名角色的名字翻译。
		 */
		getName(forDialog?: boolean): string;
		getClans(unseen?: boolean): string[];
		hasClan(clan: string, unseen?: boolean): boolean;
		hasSex(sex: string): boolean;
		sameSexAs(target: Player): boolean;
		differentSexFrom(target: Player): boolean;

		/**
		 * 将玩家切换至某个势力。
		 */
		changeGroup(group: string, log?: boolean, broadcast?: "nobroadcast" | boolean): GameEvent;
		setIdentity(identity?: string, nature?: string): this;
		isZhu2(): boolean;
		isInitFilter(tag: string): boolean;

		getEnemies(func?: ((target: Player) => boolean) | null, includeDie?: boolean): Player[];
		getFriends(func?: ((target: Player) => boolean) | boolean | null, includeDie?: boolean): Player[];
		isEnemyOf(player?: Player, ...rest: any[]): boolean;
		isFriendOf(player: Player): boolean;
		isFriendsOf(player: Player, includeDie?: boolean): boolean;
		isEnemiesOf(player: Player, includeDie?: boolean): boolean;

		isMajor(): boolean;
		isNotMajor(): boolean;
		isMinor(nomajor?: boolean): boolean;
		siege(player?: Player): boolean;
		sieged(player?: Player): boolean;
		inline(...args: Player[]): boolean;

		/**
		 * 设置玩家的座位号。
		 */
		setSeatNum(num: number): void;

		/**
		 * 返回玩家的座位号。
		 */
		getSeatNum(): number;
		inRange(to: Player): boolean;
		inRangeOf(source: Player): boolean;

		/**
		 * 返回玩家的下家。
		 */
		getNext(): Player | null;

		/**
		 * 返回玩家的上家。
		 */
		getPrevious(): Player | null;

		/**
		 * 返回玩家的攻击距离。
		 */
		getAttackRange(raw?: boolean): number;

		/**
		 * 返回一些牌的攻击距离。
		 */
		getEquipRange(cards?: (Card | VCard)[]): number;
		getGlobalFrom(): number;
		getGlobalTo(): number;
		distanceTo(target: Player, method?: string): number;
		distanceFrom(target: Player, method?: string): number;
	}
}

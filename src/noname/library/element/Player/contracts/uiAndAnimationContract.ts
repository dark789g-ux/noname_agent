import type { Card, Player, VCard } from "../../index.js";
import type { PlayerPopupInput } from "./instanceFieldsContract.js";

export type DrawAnimationConfig = {
	total: number;
	current: number;
};

export type PlayerLineConfig = boolean | string | { color?: number[]; [key: string]: any } | null;

export type SkillAnimationAvatar = "main" | "vice" | boolean | HTMLDivElement;

declare module "../../player.js" {
	interface Player {
		// renderAndAvatar.ts (11)
		getLeft(): number;
		getTop(): number;
		smoothAvatar(vice?: boolean, video?: boolean): void;
		changeSeat(position: number | string, video?: boolean): void;
		setAvatar(name?: string, name2?: string, video?: boolean, fakeme?: boolean): void;
		setAvatarQueue(name: string | undefined, list: string[]): void;
		flashAvatar(skill: string, name: string): void;
		update(...args: any[]): void;
		$update(numh?: number): this;
		$update(...args: any[]): this;
		playerfocus(time?: number): this;
		queue(time?: number | false): void;

		// chatAndPrompt.ts (13)
		$throwEmotion(target: Player, name: string, rotate?: unknown): void;
		throwEmotion(target: Player, emotion: string, rotate?: unknown): void;
		emotion(pack: string, id: string): void;
		chat(str: string): void;
		say(str: string): void;
		line(target: Player | Player[], config?: PlayerLineConfig): void;
		line2(targets: Player[], config?: PlayerLineConfig): void;
		unprompt(): void;
		prompt(str: string, nature?: string): void;
		prompt_old(name2: string | number, className?: string): void;
		popup(name?: PlayerPopupInput | null, className?: string, nobroadcast?: boolean): void;
		popup_old(name?: PlayerPopupInput | null, className?: string): HTMLDivElement;
		_popup(): void;

		// drawAndGain.ts (4)
		$drawAuto(cards: Card[], target?: Player): void;
		$draw(num?: number | Card | Card[], init?: boolean | "nobroadcast", config?: DrawAnimationConfig | null, cardsetion?: string | false | null): void;
		$gain(card?: number | string | Card | Card[], log?: boolean | null, init?: boolean, cardsetion?: string | false | null): void;
		$gain2(cards: Card | Card[], log?: boolean | null, cardsetion?: string | false | null): true | undefined;

		// compare.ts (2)
		$compareMultiple(card1: Card, targets: Player[], cards: Card[], cardsetions?: Record<string, string | undefined>): void;
		$compare(card1: Card, target: Player, card2: Card, cardsetions?: Record<string, string | undefined>): void;

		// throw.ts (1)
		$throw(card?: number | Card | Card[], time?: number, init?: boolean | "nobroadcast", nosource?: boolean | null, cardsetion?: string | false | null, id?: number | string): Card | HTMLDivElement | undefined;

		// throwOrdered.ts (5)
		$throwordered<T extends HTMLDivElement>(node: T, nosource?: boolean | null, cardsetion?: string | false | null): T;
		$throwordered1<T extends HTMLDivElement>(node: T, nosource?: boolean | null): T;
		$throwordered2<T extends HTMLDivElement>(node: T, nosource?: boolean | null): T;
		$throwxy(card: Card, left: string, top: string): Card;
		$throwxy2(card: Card, left: string, top: string, trans?: string, flipx?: boolean, flipy?: boolean): Card;

		// giveAndDice.ts (3)
		throwDice(num?: number): void;
		$giveAuto(card: Card | Card[] | number, player: Player, log?: boolean): void;
		$give(card: Card | Card[] | number | string, player: Player, log?: boolean, init?: boolean, cardsetion?: string | false | null): void;

		// skillAndFlame.ts (15)
		tryJudgeAnimate(bool: boolean): void;
		trySkillAnimate(name: string, popname?: string, checkShow?: "main" | "vice" | boolean): void;
		tryCardAnimate(card: Card | VCard, name: string, nature?: string, popname?: string | boolean): void;
		$skill(name?: string, type?: string | boolean, color?: string, avatar?: SkillAnimationAvatar): void;
		$fire(time?: number): void;
		$thunder(time?: number): void;
		$rare2(time?: number): void;
		$epic2(time?: number): void;
		$legend2(time?: number): void;
		$rare(time?: number): void;
		$epic(time?: number): void;
		$legend(time?: number): void;
		$coin(time?: number): void;
		$dust(time?: number): void;
		$recover(time?: number): void;

		// popupsAndDeath.ts (6)
		$fullscreenpop(str: string, nature?: string, avatar?: SkillAnimationAvatar, broadcast?: boolean): void;
		$damagepop(num?: number | string, nature?: string, font?: boolean, nobroadcast?: boolean): void;
		$damage(source?: Player | string | boolean | null, phase?: string): void;
		$die(): void;
		$dieflip(type?: string): void;
		$phaseJudge(card: Card | VCard): void;
	}
}

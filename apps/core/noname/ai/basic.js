import { _status, lib, game, get, ui } from "noname";
import { CacheContext } from "@/library/cache/cacheContext.js";
export class Basic {
	/**
	 * @param { (
	 * 	button: HTMLDivElement,
	 * 	buttons?: HTMLDivElement[]
	 * ) => number } [check]
	 */
	chooseButton(check) {
		/**
		 * @param {[button: HTMLDivElement, buttons?: HTMLDivElement[]]} args
		 */
		const score = (...args) => {
			if (typeof check !== "function") {
				throw new TypeError("button selection requires a check callback");
			}
			return check(...args);
		};
		const event = _status.event;
		let i, j, range, buttons, buttons2;
		let ok = false,
			forced = event.forced;
		let iwhile = 100;
		while (iwhile--) {
			range = get.select(event.selectButton);
			if (ui.selected.buttons.length >= range[0]) {
				ok = true;
			}
			CacheContext.setCacheContext(new CacheContext({ lib, game, get }));
			CacheContext.setInCacheEnvironment(true);
			if (range[1] <= -1) {
				j = 0;
				for (i = 0; i < ui.selected.buttons.length; i++) {
				j += score(ui.selected.buttons[i]);
				}
				CacheContext.setInCacheEnvironment(false);
				CacheContext.removeCacheContext();
				return j > 0;
			}
			buttons = get.selectableButtons();
			if (buttons.length == 0) {
				CacheContext.setInCacheEnvironment(false);
				CacheContext.removeCacheContext();
				return ok;
			}
			buttons2 = buttons.slice(0);
			let ix = 0;
			let checkix = score(buttons[0], buttons2);
			for (i = 1; i < buttons.length; i++) {
				let checkixtmp = score(buttons[i], buttons2);
				if (checkixtmp > checkix) {
					ix = i;
					checkix = checkixtmp;
				}
			}
			// buttons.sort(function(a,b){
			// 	return check(b,buttons2)-check(a,buttons2);
			// });
			if (score(buttons[ix]) <= 0) {
				if (!forced || ok) {
					CacheContext.setInCacheEnvironment(false);
					CacheContext.removeCacheContext();
					return ok;
				}
			}
			CacheContext.setInCacheEnvironment(false);
			CacheContext.removeCacheContext();
			buttons[ix].classList.add("selected");
			ui.selected.buttons.add(buttons[ix]);
			game.check();
			if (ui.selected.buttons.length >= range[0]) {
				ok = true;
			}
			if (ui.selected.buttons.length == range[1]) {
				return true;
			}
		}
	}
	/**
	 * @param { (
	 * card?: Card,
	 * cards?: Card[]
	 * ) => number | void } [check]
	 * @returns { boolean | undefined }
	 */
	chooseCard(check) {
		/**
		 * @param {[card?: Card, cards?: Card[]]} args
		 */
		const score = (...args) => {
			if (typeof check !== "function") {
				throw new TypeError("card selection requires a check callback");
			}
			return Number(check(...args));
		};
		const event = _status.event;
		if (event.filterCard == undefined) {
			return score() > 0;
		}
		let i, j, range, cards, cards2, skills, effect;
		let ok = false,
			forced = event.forced;
		let iwhile = 100;
		while (iwhile--) {
			range = get.select(event.selectCard);
			if (ui.selected.cards.length >= range[0]) {
				ok = true;
			}
			if (range[1] <= -1) {
				if (ui.selected.cards.length == 0) {
					return true;
				}
				j = 0;
				CacheContext.setCacheContext(new CacheContext({ lib, game, get }));
				CacheContext.setInCacheEnvironment(true);
				for (i = 0; i < ui.selected.cards.length; i++) {
					effect = score(ui.selected.cards[i]);
					if (effect < 0) {
						j -= Math.sqrt(-effect);
					} else {
						j += Math.sqrt(effect);
					}
				}
				CacheContext.setInCacheEnvironment(false);
				CacheContext.removeCacheContext();
				return j > 0;
			}
			cards = get.selectableCards();
			const player = _status.event.player;
			if (!player) {
				throw new TypeError("card selection requires an event player");
			}
			if (!player._noSkill) {
				// @ts-expect-error ignore
				cards = cards.concat(get.skills());
			}
			if (cards.length == 0) {
				return ok;
			}
			cards2 = cards.slice(0);
			// cards.sort(function(a,b){
			// 	return (check(b,cards2)-check(a,cards2));
			// });
			var ix = 0;
			CacheContext.setCacheContext(new CacheContext({ lib, game, get }));
			CacheContext.setInCacheEnvironment(true);
			var checkix = score(cards[0], cards2);
			for (i = 1; i < cards.length; i++) {
				var checkixtmp = score(cards[i], cards2);
				if (checkixtmp > checkix) {
					ix = i;
					checkix = checkixtmp;
				}
			}
			if (score(cards[ix]) <= 0) {
				if (!forced || ok) {
					CacheContext.setInCacheEnvironment(false);
					CacheContext.removeCacheContext();
					return ok;
				}
			}
			CacheContext.setInCacheEnvironment(false);
			CacheContext.removeCacheContext();
			if (typeof cards[ix] == "string") {
				ui.click.skill(cards[ix]);
				if (!event.skill) {
					throw new TypeError("skill selection requires an event skill");
				}
				var info = get.info(event.skill);
				if (info.filterCard) {
					check = info.check || get.unuseful2;
					return this.chooseCard(check);
				} else {
					return true;
				}
			} else {
				cards[ix].classList.add("selected");
				ui.selected.cards.add(cards[ix]);
				game.check();
				if (ui.selected.cards.length >= range[0]) {
					ok = true;
				}
				if (ui.selected.cards.length == range[1]) {
					return true;
				}
			}
		}
	}
	/**
	 * @param { (
	 * target?: Player,
	 * targets?: Player[]
	 * ) => number } [check]
	 */
	chooseTarget(check) {
		/**
		 * @param {[target?: Player, targets?: Player[]]} args
		 */
		const score = (...args) => {
			if (typeof check !== "function") {
				throw new TypeError("target selection requires a check callback");
			}
			return check(...args);
		};
		const event = _status.event;
		if (event.filterTarget == undefined) {
			return score() > 0;
		}
		let i, j, range, targets, targets2, effect;
		let ok = false,
			forced = event.forced;
		let iwhile = 100;
		while (iwhile--) {
			range = get.select(event.selectTarget);
			if (ui.selected.targets.length >= range[0]) {
				ok = true;
			}
			if (range[1] <= -1) {
				j = 0;
				CacheContext.setCacheContext(new CacheContext({ lib, game, get }));
				CacheContext.setInCacheEnvironment(true);
				for (i = 0; i < ui.selected.targets.length; i++) {
				effect = score(ui.selected.targets[i]);
					if (effect < 0) {
						j -= Math.sqrt(-effect);
					} else {
						j += Math.sqrt(effect);
					}
				}
				CacheContext.setInCacheEnvironment(false);
				CacheContext.removeCacheContext();
				return j > 0;
			} else if (range[1] == 0) {
			return score() > 0;
			}
			targets = get.selectableTargets();
			if (targets.length == 0) {
				return range[0] == 0 || ok;
			}
			targets2 = targets.slice(0);
			// targets.sort(function(a,b){
			// 	return check(b)-check(a);
			// });
			let ix = 0;
			CacheContext.setCacheContext(new CacheContext({ lib, game, get }));
			CacheContext.setInCacheEnvironment(true);
			let checkix = score(targets[0], targets2);
			for (i = 1; i < targets.length; i++) {
				let checkixtmp = score(targets[i], targets2);
				if (checkixtmp > checkix) {
					ix = i;
					checkix = checkixtmp;
				}
			}
			if (score(targets[ix]) <= 0) {
				if (!forced || ok) {
					CacheContext.setInCacheEnvironment(false);
					CacheContext.removeCacheContext();
					return ok;
				}
			}
			CacheContext.setInCacheEnvironment(false);
			CacheContext.removeCacheContext();
			targets[ix].classList.add("selected");
			ui.selected.targets.add(targets[ix]);
			game.check();
			if (ui.selected.targets.length >= range[0]) {
				ok = true;
			}
			if (ui.selected.targets.length == range[1]) {
				return true;
			}
		}
	}
}

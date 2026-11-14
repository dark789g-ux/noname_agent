import { _status, game, get, lib, ui } from "noname";
import dedent from "dedent";
import type { Player } from "../../index.js";
import "../contracts/instanceFieldsContract.js";
import "../contracts/storageHistoryContract.js";

export const storageAndResourceMethods = {
	addTip(this: Player, index: string, message: string, isTemp: SkillTrigger | SAAType<Signal> | boolean = false, css: Parameters<HTMLElement["css"]>[0] = {}): void {
		const player = this;
		if (player.getHiddenSkills(true, true).includes(index)) {
			return;
		}
		game.broadcastAll(
			(player, index, message, css) => {
				player.node.tipContainer ??= ui.create.div(".tipContainer", player);
				player.tips ??= new Map();
				if (!player.tips.has(index)) {
					player.tips.set(index, ui.create.div(".tip", player.node.tipContainer));
				}
				const tip = player.tips.get(index);
				if (tip) {
					tip.innerHTML = message
						.replace(/ /g, "&nbsp;")
						.replace(/(?:♥︎|♦︎)/g, '<span style="color: red; ">$&</span>')
						.replace(/\n/g, "<br>");
					tip.css(css);
				}

				let double = player.classList.contains("fullskin2") && lib.config.layout !== "long2";

				const width = player.node.avatar.clientWidth;
				let w = width * (double ? 2 : 1);
				player.style.setProperty("--w", `${w}px`);

				//检查tip的高度，使其不覆盖装备
				game.callHook("checkTipBottom", [player]);
			},
			player,
			index,
			message,
			css
		);
		if (isTemp && !player.storage[`temp_tip_${index}`]) {
			player.storage[`temp_tip_${index}`] = true;
			const expire = isTemp === true ? { global: ["phaseAfter", "phaseBeforeStart"] } : typeof isTemp == "string" || Array.isArray(isTemp) ? { global: isTemp } : isTemp;
			player
				.when(expire, false)
				.assign({
					firstDo: true,
					priority: Infinity,
				})
				.step(async (event, trigger, player) => {
					delete player.storage[`temp_tip_${index}`];
					player.removeTip(index);
				})
				.finish();
		}
	},

	removeTip(this: Player, index?: string): void {
		game.broadcastAll(
			(player, index) => {
				if (index == undefined) {
					player.tips?.clear();
				} else {
					if (player.tips?.has(index)) {
						player.tips.get(index)?.remove();
						player.tips.delete(index);
					}
				}
				if (!player.tips?.size) {
					player.node.tipContainer?.remove();
					delete player.node.tipContainer;
				}
			},
			this,
			index
		);
	},

	changeFury(this: Player, amount: number, limit?: boolean): void {
		if (typeof this.storage.stratagem_fury != "number") {
			this.storage.stratagem_fury = 0;
		}
		if (!amount) {
			return;
		}
		const furyBefore = this.storage.stratagem_fury;
		if (limit === true && typeof _status.stratagemFuryMax == "number") {
			this.storage.stratagem_fury = Math.min(Math.max(furyBefore + amount, 0), _status.stratagemFuryMax);
		} else {
			this.storage.stratagem_fury = Math.max(furyBefore + amount, 0);
		}
		const difference = this.storage.stratagem_fury - furyBefore;
		if (!difference) {
			return;
		}
		game.log(this, difference > 0 ? "获得了" : "失去了", get.cnNumber(Math.abs(difference)), "点", "#r怒气");
		this.markSkill("stratagem_fury");
	},

	addCharge(this: Player, num?: number, log?: boolean): void {
		if (typeof num != "number" || !num) {
			num = 1;
		}
		let maxCharge = this.getMaxCharge();
		if (maxCharge == Infinity) {
			this.addMark("charge", num, log);
		} else {
			num = Math.min(num, maxCharge - this.countMark("charge"));
			if (num > 0) {
				this.addMark("charge", num, log);
			}
		}
	},

	removeCharge(this: Player, num?: number, log?: boolean): void {
		if (typeof num != "number" || !num) {
			num = 1;
		}
		num = Math.min(num, this.countMark("charge"));
		if (num > 0) {
			this.removeMark("charge", num, log);
		}
	},

	countCharge(this: Player, max?: boolean): number {
		if (max) {
			if (this.getMaxCharge() == Infinity) {
				return Infinity;
			}
			return this.getMaxCharge() - this.countMark("charge");
		}
		return this.countMark("charge");
	},

	getMaxCharge(this: Player): number {
		let skills = game.expandSkills(this.getSkills(null, null, false).concat(lib.skill.global));
		let max = 0;
		for (let skill of skills) {
			const info: (Skill & { chargeSkill?: unknown }) | undefined = get.info(skill);
			if (!info || typeof info.chargeSkill != "number") {
				continue;
			}
			if (info.chargeSkill == Infinity) {
				return Infinity;
			}
			max += info.chargeSkill;
		}
		max = game.checkMod(this, max, "maxCharge", this);
		return typeof max == "number" ? Math.max(0, max) : Infinity;
	},

	getCacheKey(this: Player, similar?: boolean): string {
		let prefix = "[object:";
		if (similar !== false) {
			prefix = "[player:";
		}
		if (this.playerid) {
			return prefix + this.playerid + "]";
		}
		return (
			prefix +
			dedent`
			${this.name}+${this.sex}+${this.group}+${this.hp}+${this.maxHp}+${this.hujia}+${"[" + this.skills.join(",") + "]"}+${this.name1}+${this.name2}]
		`
		);
	},

	syncStorage(this: Player, skill: string): void {
		switch (get.itemtype(this.storage[skill])) {
			case "cards":
				game.addVideo("storage", this, [skill, get.cardsInfo(this.storage[skill]), "cards"]);
				break;
			case "card":
				game.addVideo("storage", this, [skill, get.cardInfo(this.storage[skill]), "card"]);
				break;
			default:
				try {
					game.addVideo("storage", this, [skill, JSON.parse(JSON.stringify(this.storage[skill]))]);
				} catch (e) {
					console.log(this.storage[skill]);
				}
		}
	},

	setStorage<T = any>(this: Player, name: string, value: T, mark?: boolean): T {
		this.storage[name] = value;
		if (mark) {
			this.markAuto(name);
		}
		return value;
	},

	getStorage<T = any>(this: Player, name: string, defaultValue: any = []): T {
		return this.storage[name] || defaultValue;
	},

	hasStorage(this: Player, name: string, value?: any): boolean {
		if (!(name in this.storage)) {
			return false;
		}
		if (typeof value == "undefined") {
			return true;
		}
		const storage = this.storage[name];
		if (storage === value) {
			return true;
		}
		return Array.isArray(storage) && storage.includes(value);
	},

	hasStorageAny(this: Player, name: string, values?: any): boolean {
		const storage = this.storage[name];
		if (!Array.isArray(values)) {
			// eslint-disable-next-line prefer-rest-params
			values = Array.from(arguments).slice(1);
		}
		if (!storage) {
			return false;
		}
		if (!Array.isArray(storage)) {
			return values.includes(storage);
		}
		return values.some((item: any) => storage.includes(item));
	},

	hasStorageAll(this: Player, name: string, values?: any): boolean {
		const storage = this.storage[name];
		if (!Array.isArray(values)) {
			// eslint-disable-next-line prefer-rest-params
			values = Array.from(arguments).slice(1);
		}
		if (!storage) {
			return false;
		}
		if (!Array.isArray(storage)) {
			return false;
		}
		return values.every((item: any) => storage.includes(item));
	},

	initStorage<T = any>(this: Player, name: string, value?: T, mark?: boolean): any {
		return this.hasStorage(name) ? this.getStorage(name) : this.setStorage(name, value, mark);
	},

	updateStorage<T = any>(this: Player, name: string, operation: (value: any) => T, mark?: boolean): T {
		return this.setStorage(name, operation(this.getStorage(name)), mark);
	},

	updateStorageAsync<T = any>(this: Player, name: string, operation: (value: any) => T | PromiseLike<T>, mark?: boolean): Promise<T> {
		return Promise.resolve(this.getStorage(name))
			.then(value => operation(value))
			.then(value => this.setStorage(name, value, mark));
	},

	removeStorage(this: Player, name: string, mark?: boolean): boolean {
		if (!this.hasStorage(name)) {
			return false;
		}
		delete this.storage[name];
		if (mark) {
			this.unmarkSkill(name);
		}
		return true;
	},
};

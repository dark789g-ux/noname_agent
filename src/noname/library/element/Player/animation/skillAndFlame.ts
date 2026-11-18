import { game, get, lib, ui } from "noname";
import { getRegisteredSkill } from "../../../skillRegistry.js";
import type { Card, Player, VCard } from "../../index.js";
import type { SkillAnimationAvatar } from "../contracts/uiAndAnimationContract.js";

export const skillAndFlameMethods = {
	tryJudgeAnimate(this: Player, bool: boolean): void {
		game.broadcast(
			function (player, bool) {
				player.tryJudgeAnimate(bool);
			},
			this,
			bool
		);
		if (bool) {
			this.popup("判定生效", "wood", false);
		} else {
			this.popup("判定失效", "fire", false);
		}
	},
	trySkillAnimate(this: Player, name: string, popname?: string, checkShow?: "main" | "vice" | boolean): void {
		game.callHook("checkSkillAnimate", [this, name, popname]);
		const info = getRegisteredSkill(lib.skill, name);
		if (!game.online && lib.config.skill_animation_type != "off" && info?.skillAnimation) {
			if (lib.config.skill_animation_type == "default") {
				checkShow = checkShow || "main";
			} else {
				checkShow = false;
			}
			if (info.textAnimation) {
				checkShow = false;
			}
			this.$skill(info.animationStr || lib.translate[name], info.skillAnimation, info.animationColor, checkShow);
			return;
		}
		let player = this;
		game.broadcast(
			function (player, name, popname, checkShow) {
				player.trySkillAnimate(name, popname, checkShow);
			},
			player,
			name,
			popname,
			checkShow
		);
		if (lib.animate.skill[name]) {
			// eslint-disable-next-line prefer-rest-params
			lib.animate.skill[name].apply(this, arguments as unknown as any[]);
		} else {
			if (popname != name) {
				this.popup(popname, "water", false);
			} else {
				this.popup(get.skillTranslation(name, this), "water", false);
			}
		}
	},
	tryCardAnimate(this: Player, card: Card | VCard, name: string, nature?: string, popname?: string | boolean): void {
		game.broadcast(
			function (player, card, name, nature, popname) {
				player.tryCardAnimate(card, name, nature, popname);
			},
			this,
			card,
			name,
			nature,
			popname
		);
		if (lib.animate.card[card.name]) {
			// eslint-disable-next-line prefer-rest-params
			lib.animate.card[card.name].apply(this, arguments as unknown as any[]);
		} else {
			if (!lib.config.show_card_prompt) {
				return;
			}
			if (get.type(card) == "equip" && lib.config.hide_card_prompt_equip) {
				return;
			}
			if (get.type(card) == "basic" && lib.config.hide_card_prompt_basic) {
				return;
			}
			if (popname) {
				this.popup({ name: card.name, nature: card.nature }, nature, false);
			} else {
				this.popup(name, nature, false);
			}
		}
	},
	$skill(this: Player, name?: string, type?: string | boolean, color?: string, avatar?: SkillAnimationAvatar): void {
		if (typeof type != "string") {
			type = "legend";
		}
		if (!avatar) {
			this.playerfocus(1500);
			game.delay(2);
		} else {
			game.addVideo("playerfocus2");
			game.broadcastAll(function () {
				ui.arena.classList.add("playerfocus");
				setTimeout(function () {
					ui.arena.classList.remove("playerfocus");
				}, 1800);
			});
			game.delay(3);
		}
		let that = this;
		setTimeout(
			function () {
				game.broadcastAll(
					function (that, type, name, color, avatar) {
						if (lib.config.animation && !lib.config.low_performance) {
							if (game.chess) {
								that["$" + type + "2"](1200);
							} else {
								that["$" + type](1200);
							}
						}
						if (name) {
							that.$fullscreenpop(name, color, avatar);
						}
					},
					that,
					type,
					name,
					color,
					avatar
				);
			},
			avatar ? 0 : 300
		);
	},
	$fire(this: Player): void {
		game.addVideo("flame", this, "fire");
		let left: number, top: number;
		if (game.chess) {
			let rect = this.getBoundingClientRect();
			left = rect.left;
			top = rect.top;
		} else {
			left = this.getLeft();
			top = this.getTop();
		}
		game.animate.flame(left + this.offsetWidth / 2, top + this.offsetHeight - 20, 700, "fire");
	},
	$thunder(this: Player): void {
		game.addVideo("flame", this, "thunder");
		let left: number, top: number;
		if (game.chess) {
			let rect = this.getBoundingClientRect();
			left = rect.left;
			top = rect.top;
		} else {
			left = this.getLeft();
			top = this.getTop();
		}
		game.animate.flame(left + this.offsetWidth / 2, top + this.offsetHeight - 30, 700, "thunder");
	},
	$rare2(this: Player): void {
		game.addVideo("flame", this, "rare2");
		let rect = this.getBoundingClientRect();
		let left = rect.left;
		let top = rect.top + 15;
		game.animate.flame(left + this.offsetWidth / 2, top + this.offsetHeight - 30, 700, "rare");
	},
	$epic2(this: Player): void {
		game.addVideo("flame", this, "epic2");
		let rect = this.getBoundingClientRect();
		let left = rect.left;
		let top = rect.top + 15;
		game.animate.flame(left + this.offsetWidth / 2, top + this.offsetHeight - 30, 700, "epic");
	},
	$legend2(this: Player): void {
		game.addVideo("flame", this, "legend2");
		let rect = this.getBoundingClientRect();
		let left = rect.left;
		let top = rect.top + 15;
		game.animate.flame(left + this.offsetWidth / 2, top + this.offsetHeight - 30, 700, "legend");
	},
	$rare(this: Player, time?: number): void {
		time = time || 700;
		game.addVideo("flame", this, "rare");
		let left: number, top: number;
		if (game.chess) {
			left = this.getLeft() - ui.arena.offsetLeft;
			top = this.getTop() - ui.arena.offsetTop;
		} else {
			left = this.getLeft();
			top = this.getTop();
		}
		if (this.classList.contains("minskin")) {
			top += 15;
		}
		game.animate.flame(left + this.offsetWidth / 2, top + this.offsetHeight - 30, time, "rare");
	},
	$epic(this: Player, time?: number): void {
		time = time || 700;
		game.addVideo("flame", this, "epic");
		let left: number, top: number;
		if (game.chess) {
			left = this.getLeft() - ui.arena.offsetLeft;
			top = this.getTop() - ui.arena.offsetTop;
		} else {
			left = this.getLeft();
			top = this.getTop();
		}
		if (this.classList.contains("minskin")) {
			top += 15;
		}
		game.animate.flame(left + this.offsetWidth / 2, top + this.offsetHeight - 30, time, "epic");
	},
	$legend(this: Player, time?: number): void {
		time = time || 700;
		game.addVideo("flame", this, "legend");
		let left: number, top: number;
		if (game.chess) {
			left = this.getLeft() - ui.arena.offsetLeft;
			top = this.getTop() - ui.arena.offsetTop;
		} else {
			left = this.getLeft();
			top = this.getTop();
		}
		if (this.classList.contains("minskin")) {
			top += 15;
		}
		game.animate.flame(left + this.offsetWidth / 2, top + this.offsetHeight - 30, time, "legend");
	},
	$coin(this: Player): void {
		game.broadcast(function (player) {
			if (!lib.config.low_performance) {
				player.$coin();
			}
		}, this);
		game.addVideo("flame", this, "coin");
		let left = this.getLeft() - ui.arena.offsetLeft;
		let top = this.getTop() - ui.arena.offsetTop;
		if (this.classList.contains("minskin")) {
			top += 15;
		}
		top -= 25;
		game.animate.flame(left + this.offsetWidth / 2, top + this.offsetHeight - 30, 700, "coin");
	},
	$dust(this: Player): void {
		game.broadcast(function (player) {
			if (!lib.config.low_performance) {
				player.$dust();
			}
		}, this);
		game.addVideo("flame", this, "dust");
		let left = this.getLeft() - ui.arena.offsetLeft;
		let top = this.getTop() - ui.arena.offsetTop;
		if (this.classList.contains("minskin")) {
			top += 15;
		}
		top -= 25;
		game.animate.flame(left + this.offsetWidth / 2, top + this.offsetHeight - 30, 700, "dust");
	},
	$recover(this: Player): void {
		game.addVideo("flame", this, "recover");
		let left: number, top: number;
		if (game.chess) {
			let rect = this.getBoundingClientRect();
			left = rect.left;
			top = rect.top;
		} else {
			left = this.getLeft();
			top = this.getTop();
		}
		game.animate.flame(left + this.offsetWidth / 2, top + this.offsetHeight - 30, 700, "recover");
	},
};

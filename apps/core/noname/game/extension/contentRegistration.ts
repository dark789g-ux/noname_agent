import { _status, lib, get } from "noname";
import { game } from "../index.js";
import type { Game } from "../index.js";
import type { CardData } from "../contracts/gameContract.js";

export const contentRegistrationMethods = {
	createTrigger(this: Game, name: string, skill: string, player: Player, event: GameEvent, indexedData?: any): GameEvent | false | undefined {
		const info = get.info(skill);
		if (!info) {
			return false;
		}
		if ((player.isOut() || player.removed) && !info.forceOut) {
			return;
		}
		if (player.isDead() && !info.forceDie) {
			return;
		}
		const next = game.createEvent("trigger", false);
		next.skill = skill;
		next.player = player;
		next.triggername = name;
		next.forceDie = true;
		next.includeOut = true;
		next._trigger = event;
		next.indexedData = indexedData;
		next.setContent("createTrigger");
		return next;
	},
	createEvent(this: Game, name: string, trigger?: false, triggerEvent?: RuntimeGameEvent): GameEvent {
		const next = new lib.element.GameEvent(name, trigger, _status.eventManager);
		const parent = triggerEvent || _status.eventManager.getStartedEvent();
		if (parent) {
			parent.next.push(next);
		} else {
			_status.event = next;
		}
		return next;
	},
	addCharacter(this: Game, name: string, information: { extension: string; sex: Sex; group: string; hp: string | number; skills?: string[]; tags?: string[]; translate: string }) {
		const extensionName = _status.extension || information.extension;
		const createCharacter = (): [Sex, string, string | number, string[], string[]] => [
			information.sex,
			information.group,
			information.hp,
			information.skills || [],
			[_status.evaluatingExtension ? `db:extension-${extensionName}:${name}.jpg` : `ext:${extensionName}/${name}.jpg`, `die:ext:${extensionName}/${name}.mp3`],
		];
		const character = createCharacter();
		if (information.tags && character[4]) {
			character[4] = character[4].concat(information.tags);
		}
		lib.character[name] = get.convertedCharacter(character);
		const packName = extensionName;
		if (!lib.characterPack[packName]) {
			lib.characterPack[packName] = {};
		}
		lib.translate[name] = information.translate;
		lib.characterPack[packName][name] = character;
		lib.translate[`${packName}_character_config`] = extensionName;
	},
	addCharacterPack(this: Game, pack: { mode?: string; forbid?: any; character: { [key: string]: Character }; skill: { [key: string]: object }; [key: string]: any }, packagename?: string) {
		const extname = _status.extension || "扩展";
		let gzFlag = false;
		packagename = packagename || extname;

		for (const name in pack) {
			const content = pack[name];

			switch (name) {
				case "mode":
					if (content == "guozhan") {
						gzFlag = true;
					}
				// [falls through]
				case "forbid":
					break;
				case "character":
					processCharacter(content);
					break;
				case "skill":
					processSkill(content);
					break;
				default:
					for (const key in content) {
						lib[name][key] ??= content[key];
					}
			}
		}

		const packname = packagename;
		lib.characterPack[packname] = pack.character;
		lib.translate[packname + "_character_config"] = packagename;
		if (gzFlag) {
			lib.characterGuozhanFilter.add(packname);
		}
		return;

		function processCharacter(content: Record<string, Character>) {
			for (const name in content) {
				const character = (content[name] = get.convertedCharacter(content[name]));

				if (character.dieAudios.length === 0) {
					character.dieAudios.push(`ext:${extname}/audio/die:true`);
				}
				character.img ??= `extension/${extname}/${name}.jpg`;

				if (character.isBoss || character.isHiddenBoss || lib.config.forbidai_user?.includes(name)) {
					lib.config.forbidai.add(name);
				}

				for (const skill of character.skills) {
					lib.skilllist.add(skill);
				}

				if (lib.character[name] != null) {
					continue;
				}

				if (lib.config[`extension_${extname}_characters_enable`] === undefined) {
					game.saveExtensionConfig(extname, "characters_enable", true);
				}
				if (lib.config[`extension_${extname}_characters_enable`] === true) {
					lib.character[name] = character;
				}
			}
		}

		function processSkill(content: Record<string, Skill>) {
			for (const name in content) {
				const skill = content[name];

				if (typeof skill.audio == "number" || typeof skill.audio == "boolean") {
					skill.audio = `ext:${extname}:${skill.audio}`;
				}

				lib.skill[name] ??= skill;
			}
		}
	},
	addCard(this: Game, name: string, info: CardData, info2: { extension: string; translate: string; description: string; number?: number; color?: string }) {
		const extname = _status.extension || info2.extension;
		if (info.audio == true) {
			info.audio = "ext:" + extname;
		}
		if (!info.image || typeof info.image !== "string") {
			if (info.fullskin) {
				info.image = _status.evaluatingExtension ? "db:extension-" + extname + ":" + name + ".png" : "ext:" + extname + "/" + name + ".png";
			} else if (info.fullimage) {
				info.image = _status.evaluatingExtension ? "db:extension-" + extname + ":" + name + ".jpg" : "ext:" + extname + "/" + name + ".jpg";
			}
		}
		lib.card[name] = info;
		lib.translate[name] = info2.translate;
		lib.translate[name + "_info"] = info2.description;
		if (typeof info2.number == "number") {
			let suits = ["heart", "spade", "diamond", "club"];
			if (info2.color == "red") {
				suits = ["heart", "diamond"];
			} else if (info2.color == "black") {
				suits = ["club", "spade"];
			}
			for (let i = 0; i < info2.number; i++) {
				lib.card.list.push([suits[Math.floor(Math.random() * suits.length)], Math.ceil(Math.random() * 13), name]);
			}
		}
		const packname = extname;
		if (!lib.cardPack[packname]) {
			lib.cardPack[packname] = [];
			lib.translate[packname + "_card_config"] = extname;
		}
		lib.cardPack[packname].push(name);
	},
	addCardPack(this: Game, pack: { extension?: string; mode?: string[]; forbid?: string[]; list: any[]; card: { [key: string]: CardData }; skill: { [key: string]: object }; [key: string]: any }, packagename?: string) {
		const extname = _status.extension || "扩展";
		packagename = packagename || extname;
		const packname = packagename;
		lib.cardPack[packname] = [];
		lib.cardPackInfo[packname] = pack;
		lib.translate[packname + "_card_config"] = packagename;
		for (const i in pack) {
			if (i == "mode" || i == "forbid") {
				continue;
			}
			if (i == "list") {
				for (let j = 0; j < pack[i].length; j++) {
					lib.card.list.push(pack[i][j]);
				}
				continue;
			}
			for (const j in pack[i]) {
				if (i == "card") {
					if (pack[i][j].audio == true) {
						pack[i][j].audio = "ext:" + extname;
					}
					if (!pack[i][j].image) {
						if (pack[i][j].fullskin) {
							pack[i][j].image = _status.evaluatingExtension ? "db:extension-" + extname + ":" + j + ".png" : "ext:" + extname + "/" + j + ".png";
						} else if (pack[i][j].fullimage) {
							pack[i][j].image = _status.evaluatingExtension ? "db:extension-" + extname + ":" + j + ".jpg" : "ext:" + extname + "/" + j + ".jpg";
						}
					}
					lib.cardPack[packname].push(j);
				} else if (i == "skill") {
					if (typeof pack[i][j].audio == "number" || typeof pack[i][j].audio == "boolean") {
						pack[i][j].audio = "ext:" + extname + ":" + pack[i][j].audio;
					}
				}
				if (lib[i][j] == undefined) {
					if (i == "card") {
						if (lib.config[`extension_${extname}_cards_enable`] === undefined) {
							game.saveExtensionConfig(extname, "cards_enable", true);
						}
						if (lib.config[`extension_${extname}_cards_enable`] === true) {
							lib[i][j] = pack[i][j];
						}
					} else {
						lib[i][j] = pack[i][j];
					}
				}
			}
		}
	},
	addSkill(this: Game, name: string, info: { [key: string]: any }, translate?: string, description?: string, appendInfo?: string, abInfo?: string) {
		if (lib.skill[name]) {
			return false;
		}
		if (typeof info.audio == "number" || typeof info.audio == "boolean") {
			info.audio = "ext:" + _status.extension + ":" + info.audio;
		}
		lib.skill[name] = info;
		lib.translate[name] = translate;
		lib.translate[name + "_info"] = description;
		lib.translate[name + "_append"] = appendInfo;
		lib.translate[`${name}_ab`] = abInfo;
		return true;
	},
};

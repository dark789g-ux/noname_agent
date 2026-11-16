import { lib, game, get, _status, ui } from "noname";
import { isCharacterSkillButton, type CharacterAvatarNode, type CharacterSkillClick } from "../contracts/domTargetsContract.js";
import { createSubstituteSkinRefresher, initDirectorySkinSelector } from "./skinSelector.js";
import { isClassicCharacterCardStyle, renderClassicCharacterCard } from "./classicPanel.js";
import { renderDefaultCharacterIntro } from "./defaultIntro.js";
import { createDefaultSkillClickHandler } from "./defaultSkillClick.js";

function setupCharacterCardBanAndFav(opts: {
	name: string;
	uiintro: HTMLDivElement;
	sourcenode?: any;
	noedit?: boolean | string;
}): void {
	const { name, uiintro, sourcenode, noedit } = opts;
	const ban = Object.assign(
		ui.create.div(".menubutton.large.ban.character", uiintro, "禁用", function (this: HTMLDivElement, e: Event) {
			if (this.classList.contains("unselectable")) {
				return;
			}
			if (typeof noedit == "string") {
				this.classList.toggle("active");
				const bannedname = noedit + "_banned";
				if (!lib.config[bannedname]) {
					lib.config[bannedname] = [];
				}
				if (this.classList.contains("active")) {
					lib.config[bannedname].add(name);
				} else {
					lib.config[bannedname].remove(name);
				}
				game.saveConfig(bannedname, lib.config[bannedname]);
				ban.updateBanned();
			} else {
				ui.click.touchpop();
				ui.click.intro.call(this, e);
				_status.clicked = true;
			}
		}),
		{ link: name, _banning: "offline", updateBanned: () => {} }
	);
	ban.updateBanned = function () {
		if (noedit === true) {
			return;
		}
		if (lib.config[get.mode() + "_banned"] && lib.config[get.mode() + "_banned"].includes(name)) {
			ban.classList.add("active");
		} else {
			ban.classList.remove("active");
		}
		if (sourcenode && sourcenode.updateBanned) {
			sourcenode.updateBanned();
		}
	};
	ban.updateBanned();

	const fav = ui.create.div(".menubutton.large.fav", uiintro, "收藏", function (this: HTMLDivElement) {
		if (this.classList.contains("unselectable")) {
			return;
		}
		this.classList.toggle("active");
		if (this.classList.contains("active")) {
			lib.config.favouriteCharacter.add(name);
		} else {
			lib.config.favouriteCharacter.remove(name);
		}
		game.saveConfig("favouriteCharacter", lib.config.favouriteCharacter);
	});
	if (noedit === true) {
		fav.classList.add("unselectable");
		ban.classList.add("unselectable");
	} else if (lib.config.favouriteCharacter.includes(name)) {
		fav.classList.add("active");
	}
}

export const characterCardMethods = {
	charactercard(name: string, sourcenode?: any, noedit?: boolean | string, resume?: boolean, avatar?: HTMLElement, audioName?: string) {
		if (!audioName) {
			audioName = name;
		}
		if (_status.dragged) {
			return;
		}
		if (lib.config.theme != "simple") {
			ui.window.classList.add("shortcutpaused");
			ui.menuContainer.classList.add("forceopaque");
		} else {
			ui.window.classList.add("systempaused");
			ui.menuContainer.classList.add("transparent2");
		}
		if (lib.config.blur_ui) {
			ui.arena.classList.add("blur");
			ui.system.classList.add("blur");
			ui.menuContainer.classList.add("blur");
		}
		const layer = ui.create.div(".popup-container");
		const clicklayer = function (this: HTMLDivElement & { delete(): void }, e: Event) {
			if (_status.touchpopping || _status.dragged) {
				return;
			}
			ui.window.classList.remove("shortcutpaused");
			ui.window.classList.remove("systempaused");
			ui.menuContainer.classList.remove("forceopaque");
			ui.menuContainer.classList.remove("transparent2");
			ui.arena.classList.remove("blur");
			ui.system.classList.remove("blur");
			ui.menuContainer.classList.remove("blur");
			this.delete();
			e.stopPropagation();
			if (resume) {
				game.resume2();
			}
			return false;
		};
		const uiintro = ui.create.div(".menubg.charactercard", layer);
		const playerbg = ui.create.div(".menubutton.large.ava", uiintro);
		let isTempCharacter = false;
		if (!lib.character[audioName] && lib.characterSubstitute[name]?.some(skin => skin[0] == audioName)) {
			isTempCharacter = true;
			const substitute = lib.characterSubstitute[name].find(i => i[0] == audioName);
			lib.character[audioName] = new lib.element.Character(["", "", 0, [], substitute ? substitute[1] : []]);
		}
		const bg: CharacterAvatarNode = ui.create
			.div(".avatar", playerbg, function () {
				getChangeSkinHandler()?.();
			})
			.setBackground(audioName || name, "character");
		if (isTempCharacter) {
			delete lib.character[audioName];
		}

		let nameskin = name;
		const nameskin2 = name;
		let gzbool = false;
		if (nameskin.startsWith("gz_shibing")) {
			nameskin = nameskin.slice(3, 11);
		} else if (nameskin.startsWith("gz_")) {
			nameskin = nameskin.slice(3);
			gzbool = true;
		}
		let refreshSkin: (() => void) | null = null;
		const { getChangeSkinHandler } = initDirectorySkinSelector({
			name,
			audioName,
			nameskin,
			nameskin2,
			gzbool,
			bg,
			playerbg,
			sourcenode,
			avatar,
			onSkinChanged() {
				refreshSkin?.();
				applyViewMode("intro");
			},
		});

		setupCharacterCardBanAndFav({ name, uiintro, sourcenode, noedit });

		let intro: HTMLDivElement | undefined;
		const list: string[] = [];
		let clickSkill: CharacterSkillClick | undefined;
		const skills = ui.create.div(".characterskill", uiintro);
		const btnIntro = ui.create.div(".menubutton.large.introButton", uiintro, "简介", () => applyViewMode("intro"));
		const btnSkill = ui.create.div(".menubutton.large.skillButton", uiintro, "技能", () => applyViewMode("skill"));

		const applyViewMode = function (viewMode = "intro") {
			if (viewMode !== "skill") {
				viewMode = "intro";
			}
			const intro2Node = uiintro.querySelector(".intro2");
			if (viewMode === "intro") {
				if (intro) intro.style.display = "";
				if (intro2Node instanceof HTMLElement) intro2Node.style.display = "none";
				skills.style.display = "none";
			} else {
				if (intro) intro.style.display = "none";
				if (intro2Node instanceof HTMLElement) intro2Node.style.display = "";
				skills.style.display = "";
				const first = skills.firstChild;
				if (isCharacterSkillButton(first) && !skills.querySelector(".active") && typeof clickSkill === "function") {
					clickSkill.call(first, "init");
					first.classList.add("active");
				}
			}
			btnIntro.classList.toggle("active", viewMode === "intro");
			btnSkill.classList.toggle("active", viewMode === "skill");
		};

		const refreshIntro = function () {
			if (intro?.firstChild) {
				while (intro.firstChild) {
					intro.removeChild(intro.lastChild!);
				}
			}
			if (isClassicCharacterCardStyle()) {
				const rendered = renderClassicCharacterCard({ name, uiintro, skills, bg, list, existingIntro: intro });
				intro = rendered.intro;
				clickSkill = rendered.clickSkill;
			} else {
				const rendered = renderDefaultCharacterIntro({ name, uiintro, existingIntro: intro });
				intro = rendered.intro;
				const introduction2 = (uiintro.querySelector(".intro2") as HTMLDivElement | null) || ui.create.div(".characterintro.intro2", uiintro);
				clickSkill = createDefaultSkillClickHandler({
					name,
					intro,
					introduction2,
					skills,
					bg,
					list,
					htmlParser: rendered.htmlParser,
				});
			}
		};

		refreshIntro();
		const characterSkillClick = clickSkill;
		if (typeof characterSkillClick != "function") {
			return;
		}
		applyViewMode("intro");
		if (lib.characterSubstitute[name]) {
			refreshSkin = createSubstituteSkinRefresher({
				name,
				uiintro,
				getIntro: () => intro,
				bg,
				sourcenode,
				avatar,
				refreshIntro,
			});
			refreshSkin();
		}
		applyViewMode(lib.config.show_charactercardMode);

		let initskill = false;
		const deri: string[] = [];
		for (let i = 0; i < list.length; i++) {
			if (get.info(list[i])?.nopop || !lib.translate[list[i]] || !lib.translate[list[i] + "_info"]) {
				continue;
			}
			let skilltrans = get.translation(list[i]);
			if (skilltrans.startsWith("&nbsp;")) {
				skilltrans = skilltrans.slice(6);
			}
			const current = Object.assign(ui.create.div(".menubutton.large", skills, characterSkillClick, skilltrans), {
				link: list[i],
				linkname: name,
				linkAudioName: audioName,
			});
			if (!initskill) {
				initskill = true;
				characterSkillClick.call(current, "init");
			}
			const derivations = get.info(list[i]).derivation;
			if (derivations) {
				deri.addArray(Array.isArray(derivations) ? derivations : [derivations]);
			}
		}
		const border = get.groupnature(get.bordergroup(name), "raw");
		for (const skill of deri) {
			if (list.includes(skill) || get.info(skill)?.nopop || !lib.translate[skill] || !lib.translate[skill + "_info"] || skill.indexOf("_faq") != -1) {
				continue;
			}
			let tran = get.translation(skill);
			if (tran.startsWith("&nbsp;")) {
				tran = tran.slice(6);
			}
			tran = `<span data-nature="${border}">${tran}</span>`;
			const currentx = Object.assign(ui.create.div(".menubutton.large", skills, characterSkillClick, tran), {
				link: skill,
				linkname: name,
				linkAudioName: audioName,
			});
			if (!initskill) {
				initskill = true;
				characterSkillClick.call(currentx, "init");
			}
		}
		const dieAudios = get.Audio.die({ player: { name, name2: name, tempname: [name], skin: { name: bg.tempSkin || audioName, name2: audioName } } })
			.audioList.map((i: { text?: string }) => i.text)
			.filter(Boolean);
		if (dieAudios.length) {
			const dieaudio = Object.assign(ui.create.div(".menubutton.large", skills, characterSkillClick, "阵亡"), {
				link: "dieAudios",
				linkname: audioName,
				playername: name,
				dieAudios,
			});
			dieaudio.style.backgroundColor = "rgb(0, 0, 0, 1)";
		}

		uiintro.addEventListener(lib.config.touchscreen ? "touchend" : "click", ui.click.touchpop);
		layer.addEventListener(lib.config.touchscreen ? "touchend" : "click", clicklayer);
		ui.window.appendChild(layer);
	},
};

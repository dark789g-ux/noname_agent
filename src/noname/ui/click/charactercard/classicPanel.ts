import { lib, game, get, ui } from "noname";
import type { CharacterAvatarNode, CharacterSkillButton, CharacterSkillClick } from "../contracts/domTargetsContract.js";

export function isClassicCharacterCardStyle(): boolean {
	return (
		lib.config.show_characternamepinyin == "showPinyin2" ||
		lib.config.show_skillnamepinyin == "showPinyin2" ||
		lib.config.show_characternamepinyin == "showCodeIdentifier2" ||
		lib.config.show_skillnamepinyin == "showCodeIdentifier2"
	);
}

export function playSkillOrDieAudio(button: CharacterSkillButton, name: string, e: Event | "init", audioList: string[]): void {
	if (!lib.config.background_speak || e === "init") {
		return;
	}
	if (typeof button.playAudio != "function" || name != button.audioName) {
		const playAudio = game.tryAudio({
			audioList,
			addVideo: false,
			random: false,
			autoplay: false,
		});
		if (typeof playAudio == "function") {
			button.playAudio = playAudio;
		}
		button.audioName = name;
	}
	if (typeof button.playAudio == "function") {
		button.playAudio();
	}
}

export function renderClassicCharacterCard(opts: {
	name: string;
	uiintro: HTMLDivElement;
	skills: HTMLDivElement;
	bg: CharacterAvatarNode;
	list: string[];
	existingIntro?: HTMLDivElement;
}): { intro: HTMLDivElement; clickSkill: CharacterSkillClick } {
	const { name, uiintro, skills, bg, list } = opts;
	const nameinfo = get.character(name);
	const intro = opts.existingIntro || (uiintro.querySelector(".characterintro") as HTMLDivElement | null) || ui.create.div(".characterintro", get.characterIntro(name), uiintro);
	if (lib.config.show_characternamepinyin == "showPinyin2" || lib.config.show_characternamepinyin == "showCodeIdentifier2") {
		const charactername = get.rawName2(name);
		const characterpinyin = lib.config.show_characternamepinyin == "showCodeIdentifier2" ? name : get.pinyin(charactername, undefined);
		const charactersex = get.translation(nameinfo[0]);
		const charactergroups = get.is.double(name, []);
		const charactergroup = Array.isArray(charactergroups) ? charactergroups.map(i => get.translation(i)).join("/") : get.translation(nameinfo[1]);
		const characterhp = nameinfo[2];
		const characterintroinfo = get.characterIntro(name);
		const spacemark = charactername.length > 3 ? '<span style="font-size:7px"> </span>|<span style="font-size:7px"> </span>' : " | ";
		const charactertitle = get.characterTitle(name, false, false);
		let titleHtml = charactertitle.length ? '<div class="character-title">' + get.colorspan(charactertitle) + "</div>" : "";
		for (const packname in lib.characterPack) {
			if (name in lib.characterPack[packname]) {
				const pack = lib.translate[packname + "_character_config"];
				let sort: string | undefined;
				if (lib.characterSort[packname]) {
					const sorted = lib.characterSort[packname];
					for (const sortname in sorted) {
						if (sorted[sortname].includes(name)) {
							sort = `<span style = "font-size:small">[${lib.translate[sortname]}]</span>`;
							break;
						}
					}
				}
				const packName = `${pack}${sort ? `${sort}` : ""}`;
				titleHtml = `${titleHtml}<div class="character-title">${packName}</div>`;
				break;
			}
		}
		intro.innerHTML = titleHtml + '<span style="font-weight:bold;margin-right:5px">' + charactername + "</span>" + '<span style="font-size:14px;font-family:SimHei,STHeiti,sans-serif">' + "[" + characterpinyin + "]" + "</span>" + spacemark + charactersex + spacemark + charactergroup + spacemark + characterhp + '<span style="line-height:2"></span>' + "<br>" + characterintroinfo;

		if (lib.characterAppend[name]) {
			intro.innerHTML += '<br><br><span style="font-weight:bold;color:#ff6b6b;">引文</span><br>' + lib.characterAppend[name];
		}
	}

	const intro2 = (uiintro.querySelector(".intro2") as HTMLDivElement | null) || ui.create.div(".characterintro.intro2", uiintro);
	list.addArray(get.character(name, 3) || []);
	if (lib.config.touchscreen) {
		lib.setScroll(intro);
		lib.setScroll(intro2);
		lib.setScroll(skills);
	}
	if (lib.config.mousewheel) {
		Object.assign(skills, { onmousewheel: ui.click.mousewheel });
	}

	const clickSkill: CharacterSkillClick = function (e) {
		while (intro2.firstChild) {
			const lastChild = intro2.lastChild;
			if (!lastChild) {
				break;
			}
			intro2.removeChild(lastChild);
		}
		const current = this.parentElement?.querySelector(".active");
		if (current) {
			current.classList.remove("active");
		}
		this.classList.add("active");
		if (this.link != "dieAudios") {
			const linkAudioName = this.linkAudioName;
			if (typeof linkAudioName != "string") {
				return;
			}
			const skillname = get.translation(this.link);
			const skilltranslationinfo = get.skillInfoTranslation(this.link, null, false);
			if ((lib.config.show_skillnamepinyin == "showPinyin2" || lib.config.show_skillnamepinyin == "showCodeIdentifier2") && skillname != "阵亡") {
				const skillpinyin = lib.config.show_skillnamepinyin == "showCodeIdentifier2" ? this.link : get.pinyin(skillname);
				intro2.innerHTML = '<span style="font-weight:bold;margin-right:5px">' + skillname + "</span>" + '<span style="font-size:14px;font-family:SimHei,STHeiti,sans-serif">' + "[" + skillpinyin + "]" + "</span>" + "  " + skilltranslationinfo;
			} else {
				intro2.innerHTML = '<span style="font-weight:bold;margin-right:5px">' + skillname + "</span>" + skilltranslationinfo;
			}
			const info = get.info(this.link);
			const playername = this.linkname;
			const skinName = bg.tempSkin || linkAudioName;
			if (info.derivation) {
				const derivationList = typeof info.derivation == "string" ? [info.derivation] : info.derivation;
				for (let i = 0; i < derivationList.length; i++) {
					const deriv = derivationList[i];
					if (deriv.indexOf("_faq") == -1 && !get.info(deriv).nopop) {
						continue;
					}
					const derivationname = get.translation(deriv);
					const derivationtranslationinfo = get.skillInfoTranslation(deriv, null, false);
					if ((lib.config.show_skillnamepinyin == "showPinyin2" || lib.config.show_skillnamepinyin == "showCodeIdentifier2") && derivationname.length <= 5 && deriv.indexOf("_faq") == -1) {
						const derivationpinyin = lib.config.show_skillnamepinyin == "showCodeIdentifier2" ? deriv : get.pinyin(derivationname);
						intro2.innerHTML += '<br><br><span style="font-weight:bold;margin-right:5px">' + derivationname + "</span>" + '<span style="font-size:14px;font-family:SimHei,STHeiti,sans-serif">' + "[" + derivationpinyin + "]" + "</span>" + "  " + derivationtranslationinfo;
					} else {
						intro2.innerHTML += '<br><br><span style="font-weight:bold;margin-right:5px">' + derivationname + "</span>" + derivationtranslationinfo;
					}
				}
			}

			if (lib.translate[this.link + "_append"]) {
				intro2.innerHTML += '<br><br><span style="font-weight:bold;color:#ff6b6b;">引文</span><br>';
				const appendDiv = document.createElement("div");
				appendDiv.style.fontSize = "15.2px";
				appendDiv.innerHTML = String(lib.translate[this.link + "_append"]);
				intro2.appendChild(appendDiv);
			}

			const skillVoiceMap = get.Audio.skill({ skill: this.link, player: { name: playername, skin: { name: skinName }, tempname: [skinName] } }).textList;
			if (skillVoiceMap.length > 0) {
				intro2.innerHTML += '<br><br><span style="font-weight:bold;color:#ff6b6b;">技能台词</span>';
				skillVoiceMap.forEach((text: string, index: number) => {
					const skillTextSpan = document.createElement("span");
					skillTextSpan.style.fontSize = "15.2px";
					skillTextSpan.innerHTML = `<br>${skillVoiceMap.length > 1 ? `${index + 1}. ` : ""}${text}`;
					intro2.appendChild(skillTextSpan);
				});
			}

			if (info.derivation) {
				const derivationList = typeof info.derivation == "string" ? [info.derivation] : info.derivation;
				for (let i = 0; i < derivationList.length; i++) {
					const deriv = derivationList[i];
					if (!get.info(deriv).nopop || deriv.indexOf("_faq") != -1 || nameinfo.skills.includes(deriv)) {
						continue;
					}
					const derivationVoiceMap = get.Audio.skill({ skill: deriv, player: { name: playername, skin: { name: skinName }, tempname: [skinName] } }).textList;
					if (derivationVoiceMap.length > 0) {
						intro2.innerHTML += '<br><br><span style="font-weight:bold;color:#ff6b6b;">' + get.translation(deriv) + "台词</span>";
						derivationVoiceMap.forEach((text: string, index: number) => {
							const derivationTextSpan = document.createElement("span");
							derivationTextSpan.style.fontSize = "15.2px";
							derivationTextSpan.innerHTML = `<br>${derivationVoiceMap.length > 1 ? `${index + 1}. ` : ""}${text}`;
							intro2.appendChild(derivationTextSpan);
						});
					}
				}
			}

			const audioList = get.Audio.skill({ skill: this.link, player: { name: playername, skin: { name: skinName }, tempname: [skinName] } }).fileList;
			playSkillOrDieAudio(this, name, e, audioList);
		} else {
			const playername = this.playername;
			if (typeof playername != "string") {
				return;
			}
			const skinName2 = bg.tempSkin || this.linkname;
			const dieResult = get.Audio.die({ player: { name: playername, skin: { name: skinName2 }, tempname: [skinName2] } });
			const dieAudios3 = dieResult.audioList.map((item: { text?: string }) => item.text).filter((text): text is string => Boolean(text));
			intro2.innerHTML = '<span style="font-weight:bold;margin-right:5px">阵亡台词</span>';
			dieAudios3.forEach((text: string, index: number) => {
				const dieTextSpan = document.createElement("span");
				dieTextSpan.style.fontSize = "15.2px";
				dieTextSpan.innerHTML = `<br>${dieAudios3.length > 1 ? `${index + 1}. ` : ""}${text}`;
				intro2.appendChild(dieTextSpan);
			});
			playSkillOrDieAudio(this, name, e, dieResult.fileList);
		}
	};

	return { intro, clickSkill };
}

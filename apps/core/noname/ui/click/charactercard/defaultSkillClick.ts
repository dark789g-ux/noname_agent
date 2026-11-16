import { lib, get, ui } from "noname";
import { playSkillOrDieAudio } from "./classicPanel.js";
import type { CharacterAvatarNode, CharacterSkillClick } from "../contracts/domTargetsContract.js";

function appendRubyTitle(container: HTMLDivElement, text: string, reading: string, useRuby: boolean): void {
	const nameSpan = document.createElement("span");
	nameSpan.style.fontWeight = "bold";
	nameSpan.innerHTML = text;
	if (useRuby) {
		const ruby = document.createElement("ruby");
		ruby.appendChild(nameSpan);
		const leftParenthesisRP = document.createElement("rp");
		leftParenthesisRP.textContent = "（";
		ruby.appendChild(leftParenthesisRP);
		const rt = document.createElement("rt");
		rt.innerHTML = reading;
		ruby.appendChild(rt);
		const rightParenthesisRP = document.createElement("rp");
		rightParenthesisRP.textContent = "）";
		ruby.appendChild(rightParenthesisRP);
		const div = ui.create.div(container);
		div.style.marginRight = "5px";
		div.appendChild(ruby);
	} else {
		nameSpan.style.marginRight = "5px";
		container.appendChild(nameSpan);
	}
}

export function createDefaultSkillClickHandler(opts: {
	name: string;
	intro: HTMLDivElement;
	introduction2: HTMLDivElement;
	skills: HTMLDivElement;
	bg: CharacterAvatarNode;
	list: string[];
	htmlParser: HTMLElement;
}): CharacterSkillClick {
	const { name, intro, introduction2, skills, bg, list, htmlParser } = opts;
	list.addArray(get.character(name).skills || []);
	if (lib.config.touchscreen) {
		lib.setScroll(intro);
		lib.setScroll(introduction2);
		lib.setScroll(skills);
	}
	if (lib.config.mousewheel) {
		Object.assign(skills, { onmousewheel: ui.click.mousewheel });
	}

	return function characterSkillClick(e) {
		while (introduction2.firstChild) {
			const lastChild = introduction2.lastChild;
			if (!lastChild) {
				break;
			}
			introduction2.removeChild(lastChild);
		}
		const current2 = this.parentElement?.querySelector(".active");
		if (current2) {
			current2.classList.remove("active");
		}
		this.classList.add("active");
		if (this.link != "dieAudios") {
			const linkAudioName = this.linkAudioName;
			if (typeof linkAudioName != "string") {
				return;
			}
			const link = this.link;
			const skillName = get.translation(link);
			const showSkillNamePinyin = lib.config.show_skillnamepinyin;
			const reading = showSkillNamePinyin == "showCodeIdentifier" ? link : lib.translate[`${link}_rt`] || get.pinyin(skillName).join(" ");
			appendRubyTitle(introduction2, skillName, reading, showSkillNamePinyin != "doNotShow" && skillName != "阵亡");

			htmlParser.innerHTML = get.skillInfoTranslation(this.link, null, false);
			Array.from(htmlParser.childNodes).forEach(childNode => introduction2.appendChild(childNode));

			const info = get.info(this.link);
			const playername = this.linkname;
			const skinName2 = bg.tempSkin || linkAudioName;
			const derivations = info.derivation;
			if (derivations) {
				const derivationList = typeof derivations == "string" ? [derivations] : derivations;
				derivationList.forEach((derivation: string) => {
					if (derivation.indexOf("_faq") == -1 && !get.info(derivation).nopop) {
						return false;
					}
					introduction2.appendChild(document.createElement("br"));
					introduction2.appendChild(document.createElement("br"));
					const derivationName = get.translation(derivation);
					const derivReading = showSkillNamePinyin == "showCodeIdentifier" ? derivation : lib.translate[`${derivation}_rt`] || get.pinyin(derivationName).join(" ");
					appendRubyTitle(introduction2, derivationName, derivReading, showSkillNamePinyin != "doNotShow" && derivationName.length <= 5 && derivation.indexOf("_faq") == -1);
					htmlParser.innerHTML = get.skillInfoTranslation(derivation, null, false);
					Array.from(htmlParser.childNodes).forEach(childNode => introduction2.appendChild(childNode));
				});
			}

			if (lib.translate[this.link + "_append"]) {
				introduction2.innerHTML += '<br><br><span style="font-weight:bold;color:#ff6b6b;">引文</span><br>';
				const appendDiv = document.createElement("div");
				appendDiv.style.fontSize = "15.2px";
				appendDiv.innerHTML = String(lib.translate[this.link + "_append"]);
				introduction2.appendChild(appendDiv);
			}

			const skillVoiceMap = get.Audio.skill({ skill: this.link, player: { name: playername, skin: { name: skinName2 }, tempname: [skinName2] } }).textList;
			if (skillVoiceMap.length > 0) {
				introduction2.innerHTML += '<br><br><span style="font-weight:bold;color:#ff6b6b;">技能台词</span>';
				skillVoiceMap.forEach((text: string, index: number) => {
					const skillTextSpan = document.createElement("span");
					skillTextSpan.style.fontSize = "15.2px";
					skillTextSpan.innerHTML = `<br>${skillVoiceMap.length > 1 ? `${index + 1}. ` : ""}${text}`;
					introduction2.appendChild(skillTextSpan);
				});
			}

			const audioList = get.Audio.skill({ skill: this.link, player: { name: playername, skin: { name: skinName2 }, tempname: [skinName2] } }).fileList;
			playSkillOrDieAudio(this, name, e, audioList);
		} else {
			const playername = this.playername;
			if (typeof playername != "string") {
				return;
			}
			const skinName2 = bg.tempSkin || this.linkname;
			const dieResult = get.Audio.die({ player: { name: playername, skin: { name: skinName2 }, tempname: [skinName2] } });
			const dieAudios3 = dieResult.audioList.map((item: { text?: string }) => item.text).filter((text): text is string => Boolean(text));
			introduction2.innerHTML = '<span style="font-weight:bold;margin-right:5px">阵亡台词</span>';
			dieAudios3.forEach((text: string, index: number) => {
				const dieTextSpan = document.createElement("span");
				dieTextSpan.style.fontSize = "15.2px";
				dieTextSpan.innerHTML = `<br>${dieAudios3.length > 1 ? `${index + 1}. ` : ""}${text}`;
				introduction2.appendChild(dieTextSpan);
			});
			playSkillOrDieAudio(this, name, e, dieResult.fileList);
		}
	};
}

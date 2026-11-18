import { game, lib, _status, ui } from "noname";
import { getRegisteredSkill, get, getSubfrequent } from "../dependencies.js";

export function playerProfile(node, simple, evt, uiintro) {
	// Function-scoped bindings intentionally remain shared across legacy branches.
	let underlinenode, j;

	let i, translation, intro, str;
	let capt = get.translation(node.name);
	const characterInfo = get.character(node.name),
		sex = node.sex || characterInfo[0];
	if (sex && sex != "unknown" && lib.config.show_sex) {
		capt += `&nbsp;&nbsp;${sex == "none" ? "无" : get.translation(sex)}`;
	}
	const group = node.group;
	if (group && group != "unknown" && lib.config.show_group) {
		capt += `&nbsp;&nbsp;${get.translation(group)}`;
	}
	uiintro.add(capt);

	if (lib.characterTitle[node.name]) {
		uiintro.addText(get.colorspan(lib.characterTitle[node.name]));
	}

	if (lib.characterAppend[node.name]) {
		uiintro.addText(get.colorspan(lib.characterAppend[node.name]));
	}

	if (lib.config.show_sortPack) {
		for (let packname in lib.characterPack) {
			if (node.name in lib.characterPack[packname]) {
				let pack = lib.translate[packname + "_character_config"],
					sort;
				if (lib.characterSort[packname]) {
					let sorted = lib.characterSort[packname];
					for (let sortname in sorted) {
						if (sorted[sortname].includes(node.name)) {
							sort = `<span style = "font-size:small">${lib.translate[sortname]}</span>`;
							break;
						}
					}
				}
				const sortPack = document.createElement("div");
				sortPack.innerHTML = `${pack}${sort ? `<br>[${sort}]` : ""}`;
				sortPack.appendChild(document.createElement("hr"));
				sortPack.insertBefore(document.createElement("hr"), sortPack.firstChild);
				uiintro.add(sortPack);
				break;
			}
		}
	}

	if (get.characterInitFilter(node.name)) {
		const initFilters = get.characterInitFilter(node.name).filter((tag: string) => {
			if (!lib.characterInitFilter[node.name]) {
				return true;
			}
			return lib.characterInitFilter[node.name](tag) !== false;
		});
		if (initFilters.length) {
			const str = initFilters.reduce((strx: string, stry: string) => strx + lib.InitFilter[stry] + "<br>", "").slice(0, -4);
			uiintro.addText(str);
		}
	}

	//旧的查看手牌的写法，manba out！
	/*if (!node.noclick) {
				const allShown = node.isUnderControl() || (!game.observe && game.me && game.me.hasSkillTag("viewHandcard", null, node, true));
				const shownHs = node.getShownCards();
				if (shownHs.length) {
					uiintro.add('<div class="text center">明置的手牌</div>');
					uiintro.addSmall(shownHs);
					if (allShown) {
						var hs = node.getCards("h");
						hs.removeArray(shownHs);
						if (hs.length) {
							uiintro.add('<div class="text center">其他手牌</div>');
							uiintro.addSmall(hs);
						}
					}
				} else if (allShown) {
					var hs = node.getCards("h");
					if (hs.length) {
						uiintro.add('<div class="text center">手牌</div>');
						uiintro.addSmall(hs);
					}
				}
			}*/

	let skills = node.getSkills(null, false, false).slice(0);
	let skills2 = game.filterSkills(skills, node);
	if (node == game.me && node.hiddenSkills.length) {
		skills.addArray(node.hiddenSkills);
	}
	for (let i in node.disabledSkills) {
		if (node.disabledSkills[i].length == 1 && node.disabledSkills[i][0] == i + "_awake" && !node.hiddenSkills.includes(i)) {
			skills.add(i);
		}
	}
	for (i = 0; i < skills.length; i++) {
		const skillInfo = getRegisteredSkill(lib.skill, skills[i]);
		if (!skillInfo || skillInfo.nopop || skillInfo.equipSkill) {
			continue;
		}
		if (lib.translate[skills[i] + "_info"]) {
			if (lib.translate[skills[i] + "_ab"]) {
				translation = lib.translate[skills[i] + "_ab"];
			} else {
				translation = get.translation(skills[i]);
				if (!skillInfo.nobracket) {
					translation = `【${translation.slice(0, 2)}】`;
				}
			}

			if (node.forbiddenSkills[skills[i]]) {
				let forbidstr = '<div style="opacity:0.5"><div class="skill">' + translation + "</div><div>";
				if (node.forbiddenSkills[skills[i]].length) {
					forbidstr += "（与" + get.translation(node.forbiddenSkills[skills[i]]) + "冲突）<br>";
				} else {
					forbidstr += "（双将禁用）<br>";
				}
				forbidstr += get.skillInfoTranslation(skills[i], node, false) + "</div></div>";
				uiintro.add(forbidstr);
			} else if (!skills2.includes(skills[i])) {
				if (skillInfo.preHidden && get.mode() == "guozhan") {
					uiintro.add('<div><div class="skill" style="opacity:0.5">' + translation + '</div><div><span style="opacity:0.5">' + get.skillInfoTranslation(skills[i], node, false) + '</span><br><div class="underlinenode on gray" style="position:relative;padding-left:0;padding-top:7px">预亮技能</div></div></div>');
					underlinenode = uiintro.content.lastChild.querySelector(".underlinenode");
					if (_status.prehidden_skills.includes(skills[i])) {
						underlinenode.classList.remove("on");
					}
					underlinenode.link = skills[i];
					underlinenode.listen(ui.click.hiddenskill);
				} else {
					uiintro.add('<div style="opacity:0.5"><div class="skill">' + translation + "</div><div>" + get.skillInfoTranslation(skills[i], node, false) + "</div></div>");
				}
			} else if (skillInfo.temp || !node.skills.includes(skills[i]) || skillInfo.thundertext) {
				if (skillInfo.frequent || getSubfrequent(lib.skill, skills[i])) {
					uiintro.add('<div><div class="skill thundertext thunderauto">' + translation + '</div><div class="thundertext thunderauto">' + get.skillInfoTranslation(skills[i], node, false) + '<br><div class="underlinenode on gray" style="position:relative;padding-left:0;padding-top:7px">自动发动</div></div></div>');
					underlinenode = uiintro.content.lastChild.querySelector(".underlinenode");
					if (skillInfo.frequent) {
						if (lib.config.autoskilllist.includes(skills[i])) {
							underlinenode.classList.remove("on");
						}
					}
					const subfrequent = getSubfrequent(lib.skill, skills[i]);
					if (subfrequent) {
						for (j = 0; j < subfrequent.length; j++) {
							if (lib.config.autoskilllist.includes(skills[i] + "_" + subfrequent[j])) {
								underlinenode.classList.remove("on");
							}
						}
					}
					if (lib.config.autoskilllist.includes(skills[i])) {
						underlinenode.classList.remove("on");
					}
					underlinenode.link = skills[i];
					underlinenode.listen(ui.click.autoskill2);
				} else {
					uiintro.add('<div><div class="skill thundertext thunderauto">' + translation + '</div><div class="thundertext thunderauto">' + get.skillInfoTranslation(skills[i], node, false) + "</div></div>");
				}
			} else if (skillInfo.frequent || getSubfrequent(lib.skill, skills[i])) {
				uiintro.add('<div><div class="skill">' + translation + "</div><div>" + get.skillInfoTranslation(skills[i], node, false) + '<br><div class="underlinenode on gray" style="position:relative;padding-left:0;padding-top:7px">自动发动</div></div></div>');
				underlinenode = uiintro.content.lastChild.querySelector(".underlinenode");
				if (skillInfo.frequent) {
					if (lib.config.autoskilllist.includes(skills[i])) {
						underlinenode.classList.remove("on");
					}
				}
				const subfrequent = getSubfrequent(lib.skill, skills[i]);
				if (subfrequent) {
					for (j = 0; j < subfrequent.length; j++) {
						if (lib.config.autoskilllist.includes(skills[i] + "_" + subfrequent[j])) {
							underlinenode.classList.remove("on");
						}
					}
				}
				if (lib.config.autoskilllist.includes(skills[i])) {
					underlinenode.classList.remove("on");
				}
				underlinenode.link = skills[i];
				underlinenode.listen(ui.click.autoskill2);
			} else if (skillInfo.clickable && node.isIn() && node.isUnderControl(true)) {
				let intronode = uiintro.add('<div><div class="skill">' + translation + "</div><div>" + get.skillInfoTranslation(skills[i], node, false) + '<br><div class="menubutton skillbutton" style="position:relative;margin-top:5px">点击发动</div></div></div>').querySelector(".skillbutton");
				const clickableFilter = skillInfo.clickableFilter;
				if (!_status.gameStarted || (clickableFilter && !clickableFilter(node))) {
					intronode.classList.add("disabled");
					intronode.style.opacity = 0.5;
				} else {
					intronode.link = node;
					intronode.func = skillInfo.clickable;
					intronode.classList.add("pointerdiv");
					intronode.listen(() => uiintro.close());
					intronode.listen(ui.click.skillbutton);
				}
			} else {
				uiintro.add('<div><div class="skill">' + translation + "</div><div>" + get.skillInfoTranslation(skills[i], node, false) + "</div></div>");
			}
			if (lib.translate[skills[i] + "_append"]) {
				uiintro._place_text = uiintro.add('<div class="text">' + lib.translate[skills[i] + "_append"] + "</div>");
			}
		}
	}
	// if(get.is.phoneLayout()){
	// 	var storage=node.storage;
	// 	for(i in storage){
	// 		if(get.info(i)&&get.info(i).intro){
	// 			intro=get.info(i).intro;
	// 			if(node.getSkills().concat(lib.skill.global).includes(i)==false&&!intro.show) continue;
	// 			var name=intro.name?intro.name:get.translation(i);
	// 			if(typeof name=='function'){
	// 				name=name(storage[i],node);
	// 			}
	// 			translation='<div><div class="skill">『'+name.slice(0,2)+'』</div><div>';
	// 			var stint=get.storageintro(intro.content,storage[i],node,null,i);
	// 			if(stint){
	// 				translation+=stint+'</div></div>';
	// 				uiintro.add(translation);
	// 			}
	// 		}
	// 	}
	// }
}

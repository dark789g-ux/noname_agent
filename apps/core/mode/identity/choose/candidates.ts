import html from "dedent";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";
import type { SelectionContext } from "../contracts.js";

export function freezeCandidates(context: SelectionContext) {
	const { event, chosen, stratagemMode, list2, list3, list4 } = context;

	for (const name in lib.characterReplace) {
		const replacements = lib.characterReplace[name];
		for (let index = replacements.length - 1; index >= 0; index--) {
			const replacement = replacements[index];
			if (chosen.includes(replacement) || lib.filter.characterDisabled(replacement)) {
				replacements.splice(index, 1);
			}
		}
		if (!replacements.length) {
			continue;
		}
		event.list.push(name);
		list4.addArray(replacements);
		if (stratagemMode) {
			list3.push(name);
			continue;
		}
		let hasZhugong = false;
		for (const replacement of replacements) {
			if (lib.character[replacement].isZhugong) {
				hasZhugong = true;
				break;
			}
		}
		(hasZhugong ? list2 : list3).push(name);
	}
	for (const name in lib.character) {
		if (list4.includes(name)) {
			continue;
		}
		if (chosen.includes(name)) {
			continue;
		}
		if (lib.filter.characterDisabled(name)) {
			continue;
		}
		event.list.push(name);
		list4.push(name);
		if (!stratagemMode && lib.character[name].isZhugong) {
			list2.push(name);
		} else {
			list3.push(name);
		}
	}
	const getZhuList = () => {
		if (stratagemMode) {
			list2.sort(lib.sort.character);
			return list2;
		}
		const limitZhu = get.config("limit_zhu", undefined);
		if (!limitZhu || limitZhu === "off") {
			return list2.slice(0).sort(lib.sort.character);
		}
		if (limitZhu !== "group") {
			const zhuCount = parseInt(limitZhu) || 6;
			return list2.randomGets(zhuCount).sort(lib.sort.character);
		}
		const getGroup = name => {
			const characterReplace = lib.characterReplace[name];
			if (characterReplace && characterReplace[0] && lib.character[characterReplace[0]]) {
				return lib.character[characterReplace[0]][1];
			}
			return lib.character[name][1];
		};
		const list2Random = list2.slice(0);
		const list2x: any[] = [];
		const selectedGroups = new Set();
		list2Random.randomSort();
		for (const name of list2Random) {
			const group = getGroup(name);
			if (selectedGroups.has(group)) {
				continue;
			}
			selectedGroups.add(group);
			list2x.push(name);
		}
		list2x.sort(lib.sort.character);
		return list2x;
	};
	event.list.randomSort();
	_status.characterlist = list4.slice(0).randomSort();
	list3.randomSort();
	if (_status.brawl && _status.brawl.chooseCharacterFilter) {
		_status.brawl.chooseCharacterFilter(event.list, getZhuList(), list3);
	}
	context.getZhuList = getZhuList;
}

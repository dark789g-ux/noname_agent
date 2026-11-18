import { game, get } from "noname";

export interface CharacterFormSnapshot {
	charName: string;
	charDes: string;
	charHp: string;
	charSex: string;
	charGroup: string;
	isZhu: boolean;
	isBoss: boolean;
	isForbidAi: boolean;
	isHiddenSkill: boolean;
	skills: string[];
	dieAudios: string[];
}

/** 从新旧两种扩展武将格式读取统一表单快照。 */
export function extractCharacterSnapshot(id: string, info: any, translate?: string): CharacterFormSnapshot {
	const charName = translate && translate !== id ? `${id}|${translate}` : id;
	if (Array.isArray(info)) {
		const tags: string[] = Array.isArray(info[4]) ? info[4] : [];
		let charDes = "";
		const dieAudios: string[] = [];
		for (const tag of tags) {
			if (tag.startsWith("des:")) charDes = tag.slice(4);
			if (tag.startsWith("die:")) dieAudios.push(tag.slice(4));
		}
		return {
			charName,
			charDes,
			charHp: String(info[2]),
			charSex: info[0],
			charGroup: info[1],
			isZhu: tags.includes("zhu"),
			isBoss: tags.includes("boss"),
			isForbidAi: tags.includes("forbidai"),
			isHiddenSkill: tags.includes("hiddenSkill"),
			skills: [...(info[3] || [])],
			dieAudios,
		};
	}

	const charHp = info.hujia
		? `${info.hp}/${info.maxHp}/${info.hujia}`
		: info.maxHp != null && info.maxHp !== info.hp
			? `${info.hp}/${info.maxHp}`
			: String(info.hp ?? "");
	const des = (info.trashBin || []).find((tag: string) => tag.startsWith("des:"));

	return {
		charName,
		charDes: des ? des.slice(4) : "",
		charHp,
		charSex: info.sex || "male",
		charGroup: info.group || "wei",
		isZhu: !!info.isZhugong,
		isBoss: !!info.isBoss,
		isForbidAi: !!info.isAiForbidden,
		isHiddenSkill: !!info.hasHiddenSkill,
		skills: [...(info.skills || [])],
		dieAudios: [...(info.dieAudios || [])],
	};
}

/** 从内存音频池或 `ext:` / `db:` 存储读取武将阵亡配音。 */
export async function resolveDieAudioBuffer(
	dieAudio: string,
	audioData: Record<string, ArrayBuffer>
): Promise<{ fileName: string; buffer: ArrayBuffer } | null> {
	const fileName = dieAudio.slice(dieAudio.lastIndexOf("/") + 1);
	if (audioData[fileName]) {
		return { fileName, buffer: audioData[fileName] };
	}
	if (dieAudio.startsWith("ext:") && typeof game.readFile === "function") {
		try {
			const buffer = await game.promises.readFile(dieAudio.replace("ext:", "extension/"));
			return { fileName, buffer };
		} catch {
			console.warn(`未找到${dieAudio.replace("ext:", "extension/")}阵亡配音`);
			return null;
		}
	}
	if (dieAudio.startsWith("db:")) {
		try {
			const stored = await game.getDB("image", dieAudio.slice(3));
			if (!(stored instanceof ArrayBuffer)) {
				throw new TypeError("The stored die audio must be an ArrayBuffer");
			}
			return { fileName, buffer: stored };
		} catch {
			console.warn(`未找到${dieAudio}阵亡配音`);
			return null;
		}
	}
	return null;
}

export function parseHpInput(raw: string): string | number {
	if (["Infinity", "\u221e", "无限"].includes(raw)) {
		return Infinity;
	}
	if (!raw.includes("/")) {
		return parseInt(raw, 10) || 1;
	}
	return raw;
}

export interface SaveCharacterPayload {
	id: string;
	sex: string;
	group: string;
	hp: string | number;
	des: string;
	isZhu: boolean;
	isBoss: boolean;
	isForbidAi: boolean;
	isHiddenSkill: boolean;
	skills: string[];
	dieAudioTag?: string;
}

/** 将表单字段写回旧数组格式或新对象格式，清理已取消标记。 */
export function writeCharacterRecord(packCharacterMap: Record<string, any>, payload: SaveCharacterPayload): void {
	const { id, sex, group, hp, des, isZhu, isBoss, isForbidAi, isHiddenSkill, skills, dieAudioTag } = payload;
	const tags: string[] = [];
	if (isZhu) tags.push("zhu");
	if (isBoss) tags.push("boss", "bossallowed");
	if (isForbidAi) tags.push("forbidai");
	if (isHiddenSkill) tags.push("hiddenSkill");
	if (des) tags.push(`des:${des}`);
	if (dieAudioTag) tags.push(`die:${dieAudioTag}`);

	const oldCharacter = packCharacterMap[id];
	if (Array.isArray(oldCharacter)) {
		packCharacterMap[id] = [sex, group, hp, [...skills], tags];
		return;
	}

	const nextObj: any = {
		sex,
		group,
		hp: get.infoHp(hp),
		maxHp: get.infoMaxHp(hp),
		hujia: get.infoHujia(hp),
		skills: [...skills],
	};
	if (isZhu) nextObj.isZhugong = true;
	if (isBoss) {
		nextObj.isBoss = true;
		nextObj.isBossAllowed = true;
	}
	if (isForbidAi) nextObj.isAiForbidden = true;
	if (isHiddenSkill) nextObj.hasHiddenSkill = true;
	if (dieAudioTag) nextObj.dieAudios = [dieAudioTag];

	if (!oldCharacter) {
		packCharacterMap[id] = nextObj;
		return;
	}

	if (!isZhu) delete oldCharacter.isZhugong;
	if (!isBoss) {
		delete oldCharacter.isBoss;
		delete oldCharacter.isBossAllowed;
	}
	if (!isForbidAi) delete oldCharacter.isAiForbidden;
	if (!isHiddenSkill) delete oldCharacter.hasHiddenSkill;
	if (des) {
		oldCharacter.trashBin = (Array.isArray(oldCharacter.trashBin) ? oldCharacter.trashBin : []).filter(
			(tag: string) => !tag.startsWith("des:")
		);
		oldCharacter.trashBin.push(`des:${des}`);
	} else if (Array.isArray(oldCharacter.trashBin)) {
		oldCharacter.trashBin = oldCharacter.trashBin.filter((tag: string) => !tag.startsWith("des:"));
		if (!oldCharacter.trashBin.length) delete oldCharacter.trashBin;
	}
	if (!dieAudioTag) delete oldCharacter.dieAudios;
	Object.assign(oldCharacter, nextObj);
}

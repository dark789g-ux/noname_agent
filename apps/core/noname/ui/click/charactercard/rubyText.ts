export interface CharacterRubyResult {
	characterName: string;
	characterReading: string;
}

/**
 * 保证未注册翻译的武将仍可生成安全的 ruby 文本。
 */
export function getCharacterRubyText(name: string, rawName: string | undefined, rawReading: string | undefined, displayMode: string | undefined, pinyin: (value: string) => string[]): CharacterRubyResult {
	const hasCharacterName = rawName !== undefined;
	const characterName = hasCharacterName ? rawName : name;
	if (displayMode == "showCodeIdentifier") {
		return { characterName, characterReading: name };
	}
	if (typeof rawReading == "string" && rawReading.length > 0) {
		return { characterName, characterReading: rawReading };
	}
	return { characterName, characterReading: hasCharacterName ? pinyin(characterName).join(" ") : name };
}

/**
 * 解析武将简介顶部的实际名称与读音注音。
 * 保持在翻译缺失时不把 `rawName2` 的空串当作已定义名称。
 */
export function resolveCharacterRubyDisplay(
	nameInfo: { trashBin?: string[] },
	name: string,
	runtimeLib: { translate: Record<string, string | undefined> },
	runtimeGet: { rawName2(id: string): string; pinyin(value: string): string[] },
	showCharacterNamePinyin: string | undefined,
	rubyResolver: typeof getCharacterRubyText = getCharacterRubyText
): CharacterRubyResult & { rawCharacterName: string | undefined } {
	const exInfo = nameInfo.trashBin;
	const translatedCharacterName = runtimeLib.translate[name];
	const rawCharacterName = translatedCharacterName === undefined ? undefined : exInfo && exInfo.includes("ruby") ? translatedCharacterName : runtimeGet.rawName2(name);
	const { characterName, characterReading } = rubyResolver(name, rawCharacterName, runtimeLib.translate[`${name}_rt`], showCharacterNamePinyin, value => runtimeGet.pinyin(value));
	return { rawCharacterName, characterName, characterReading };
}

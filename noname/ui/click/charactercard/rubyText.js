function getCharacterRubyText(name, rawName, rawReading, displayMode, pinyin) {
  const hasCharacterName = rawName !== void 0;
  const characterName = hasCharacterName ? rawName : name;
  if (displayMode == "showCodeIdentifier") {
    return { characterName, characterReading: name };
  }
  if (typeof rawReading == "string" && rawReading.length > 0) {
    return { characterName, characterReading: rawReading };
  }
  return { characterName, characterReading: hasCharacterName ? pinyin(characterName).join(" ") : name };
}
function resolveCharacterRubyDisplay(nameInfo, name, runtimeLib, runtimeGet, showCharacterNamePinyin, rubyResolver = getCharacterRubyText) {
  const exInfo = nameInfo.trashBin;
  const translatedCharacterName = runtimeLib.translate[name];
  const rawCharacterName = translatedCharacterName === void 0 ? void 0 : exInfo && exInfo.includes("ruby") ? translatedCharacterName : runtimeGet.rawName2(name);
  const { characterName, characterReading } = rubyResolver(name, rawCharacterName, runtimeLib.translate[`${name}_rt`], showCharacterNamePinyin, (value) => runtimeGet.pinyin(value));
  return { rawCharacterName, characterName, characterReading };
}
export {
  getCharacterRubyText,
  resolveCharacterRubyDisplay
};

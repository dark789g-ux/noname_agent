function importBossCharacters(mode, storage, loadversus) {
  for (var i in mode.translate) {
    storage.translate[i] = mode.translate[i];
  }
  const characterPack = mode.characterPack;
  if (!characterPack) {
    throw new TypeError("Boss mode must provide characterPack");
  }
  for (var i in characterPack.mode_boss) {
    const character = characterPack.mode_boss[i];
    if ("isBossAllowed" in character && character.isBossAllowed) {
      storage.boss[i] = character;
    }
  }
  loadversus();
}
export {
  importBossCharacters
};

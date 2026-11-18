function renderCommonCardPileDialog(runtimeLib, runtimeStatus, runtimeUi, runtimeGet) {
  const uiintro = runtimeUi.create.dialog("hidden");
  uiintro.listen(function(e) {
    e.stopPropagation();
  });
  for (const [key, value] of runtimeLib.commonArea) {
    const cards = runtimeStatus[value.areaStatusName];
    uiintro.add(`<div class="text center">${value.translate || runtimeGet.translation?.(key)} (${runtimeGet.cnNumber(cards?.length ?? 0)}张)</div>`);
    if (runtimeGet.itemtype(cards) == "cards") {
      if (!value.isUnseen) {
        uiintro.addSmall([cards, "card"]);
      }
    }
    uiintro.add(runtimeUi.create.div(".placeholder"));
  }
  return uiintro;
}
export {
  renderCommonCardPileDialog
};

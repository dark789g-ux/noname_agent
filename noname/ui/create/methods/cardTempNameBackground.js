function applyFullImageFallbackBackground(cardPack, cardName, bg, runtimeGet) {
  if (Array.isArray(cardPack) && cardName !== void 0 && cardPack.includes(cardName)) {
    bg.setBackground("mode/" + runtimeGet.mode() + "/card/" + cardName);
  } else {
    bg.setBackground("card/" + cardName);
  }
}
export {
  applyFullImageFallbackBackground
};

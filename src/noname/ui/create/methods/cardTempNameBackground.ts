/**
 * 解析临时卡牌在 `fullimage` 模式下的默认卡包贴图路径，未命中当前模式牌包时回退通用卡牌目录。
 */
export function applyFullImageFallbackBackground(
	cardPack: string[] | undefined,
	cardName: string | undefined,
	bg: { setBackground(path: string): any },
	runtimeGet: { mode(): string }
): void {
	if (Array.isArray(cardPack) && cardName !== undefined && cardPack.includes(cardName)) {
		bg.setBackground("mode/" + runtimeGet.mode() + "/card/" + cardName);
	} else {
		bg.setBackground("card/" + cardName);
	}
}

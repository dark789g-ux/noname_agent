/**
 * 构建公共区域对话框内容；对标记为 `isUnseen` 的隐藏牌堆仅展示数量不展示卡牌明牌。
 */
export function renderCommonCardPileDialog(runtimeLib: { commonArea: Map<string, any> }, runtimeStatus: Record<string, any>, runtimeUi: { create: { dialog(arg: string): any; div(arg: string): any } }, runtimeGet: { cnNumber(n: number): string | number; itemtype(v: any): string | undefined; translation?: (key: string) => string }) {
	const uiintro = runtimeUi.create.dialog("hidden");
	uiintro.listen(function (e: Event) {
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

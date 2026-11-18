import { game } from "noname";
import { _status } from "noname";

export function createCommonArea() {
	return new Map([
		[
			"renku",
			{
				/**翻译名 */
				translate: "仁库",
				/** 存牌的区域名，_status.renku即是仁库这一区域 */
				areaStatusName: "renku",
				/** #player.lose和game.cardsGotoSpecial中的参数名，用于指向区域 */
				toName: "toRenku",
				/** #player.gain/.addToExpansion中的参数名，表示来源区域 */
				fromName: "fromRenku",
				/** 处理添加到相应区域中的卡牌，由于仁库需要处理溢出，所以采用事件的content*/
				async addHandeler(event, trigger, player) {
					const { cards } = event;
					_status.renku.addArray(
						cards.filter(function (card) {
							return !card.willBeDestroyed("renku", null, event.relatedEvent);
						})
					);
					if (_status.renku.length > 6) {
						const cards2 = _status.renku.splice(0, _status.renku.length - 6);
						game.log(cards2, "从仁库进入了弃牌堆");
						await game.cardsDiscard(cards2).set("outRange", true).set("fromRenku", true);
					}
					game.updateRenku();
				},
				/** 处理从相应区域中移出的卡牌*/
				async removeHandeler(event, trigger, player) {
					_status.renku.removeArray(event.cards);
					game.updateRenku();
				},
			},
		],
	]);
}

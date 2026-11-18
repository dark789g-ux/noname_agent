export interface DeckMonitorResult {
	drawPile: ArrayLike<any>;
	discardPile: ArrayLike<any>;
}

/**
 * 获取记牌器展示所需的牌堆与弃牌堆数据。
 * 联机模式下通过 WebSocket 请求实时牌堆；单机模式直接读取 DOM 容器子节点。
 */
export function fetchDeckMonitorResult(runtimeGame: { online?: boolean; ws?: WebSocket | null }, runtimeUi: { cardPile?: { children: ArrayLike<any> }; discardPile?: { children: ArrayLike<any> } }): Promise<DeckMonitorResult | false> {
	return new Promise(resolve => {
		if (runtimeGame.online) {
			try {
				const socket = runtimeGame.ws;
				if (!socket) {
					throw new TypeError("Online deck monitoring requires a WebSocket");
				}
				socket.send(JSON.stringify(["cardPile"]));
				socket.addEventListener(
					"message",
					function (e) {
						const data = JSON.parse(JSON.parse(e.data)[0]);
						if (data.type == "cardPile") {
							resolve(data.data);
						}
					},
					{ once: true }
				);
			} catch {
				resolve(false);
			}
		} else {
			resolve({
				drawPile: runtimeUi.cardPile?.children || [],
				discardPile: runtimeUi.discardPile?.children || [],
			});
		}
	});
}

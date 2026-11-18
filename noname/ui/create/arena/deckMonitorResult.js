function fetchDeckMonitorResult(runtimeGame, runtimeUi) {
  return new Promise((resolve) => {
    if (runtimeGame.online) {
      try {
        const socket = runtimeGame.ws;
        if (!socket) {
          throw new TypeError("Online deck monitoring requires a WebSocket");
        }
        socket.send(JSON.stringify(["cardPile"]));
        socket.addEventListener(
          "message",
          function(e) {
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
        discardPile: runtimeUi.discardPile?.children || []
      });
    }
  });
}
export {
  fetchDeckMonitorResult
};

export function listenEnd(node) {
	if (!node._listeningEnd) {
		node._listeningEnd = true;
		node.listenTransition(function () {
			delete node._listeningEnd;
			if (node._onEndMoveDelete) {
				node.moveDelete(node._onEndMoveDelete);
			} else if (node._onEndDelete) {
				node.delete();
			}
			node._transitionEnded = true;
		});
	}
}

interface SelectionSpec {
	finalPredicate?: (context: import("../noname/library/selection/context.js").SelectionContext, event: GameEvent, player: Player) => boolean;
}

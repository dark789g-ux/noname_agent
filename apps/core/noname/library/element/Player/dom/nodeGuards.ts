import { lib, ui } from "noname";
import type { GameEvent, GameEventNumberValue, GameEventParentFallback } from "../../gameEvent.js";
import type { GainAnimationNode, MarkDomNode, MarkNode, ThrownDomNode } from "../contracts/instanceFieldsContract.js";

export function requireParentEvent<N extends GameEventNumberValue = GameEventNumberValue>(event: GameEvent<N> | GameEventParentFallback | undefined): GameEvent<N> {
	if (!(event instanceof lib.element.GameEvent)) {
		throw new TypeError("This operation requires an existing parent event");
	}
	return event;
}

export function hasHtmlDivParent(node: MarkNode): node is MarkNode & { parentNode: HTMLDivElement } {
	return node.parentNode instanceof HTMLDivElement;
}

export function isThrownNode(node: Node | null | undefined): node is ThrownDomNode {
	return node instanceof HTMLDivElement;
}

export function isThrownNodeMap(value: unknown): value is { cardsetion?: unknown; name2?: unknown; range?: unknown; throw_id?: unknown } {
	return value !== null && (typeof value === "object" || typeof value === "function");
}

export function getThrownCardId(node: ThrownDomNode): unknown {
	return node._cardid;
}

export function isThrownCardSelected(node: ThrownDomNode): boolean {
	return Boolean(node.selectedt);
}

export function selectThrownCard(node: ThrownDomNode, id: unknown): boolean {
	if (getThrownCardId(node) != id || isThrownCardSelected(node)) return false;
	node.selectedt = true;
	return true;
}

export function getThrownNodeMap(node: ThrownDomNode): { cardsetion?: unknown; name2?: unknown; range?: unknown; throw_id?: unknown } | undefined {
	const nodeMap = node.node;
	if (!nodeMap) return;
	if (!isThrownNodeMap(nodeMap)) {
		throw new TypeError("thrown node map must be an object");
	}
	return nodeMap;
}

export function getThrownCardsetion(node: ThrownDomNode): Node | undefined {
	const nodeMap = getThrownNodeMap(node);
	const cardsetion = nodeMap?.cardsetion;
	if (cardsetion === undefined) return;
	if (!(cardsetion instanceof Node)) {
		throw new TypeError("thrown card section must be a Node");
	}
	return cardsetion;
}

export function isRemovableThrownCardsetion(value: unknown): value is { remove: () => void } {
	return value !== null && (typeof value === "object" || typeof value === "function") && "remove" in value && typeof value.remove === "function";
}

export function replaceThrownCardsetion(node: HTMLDivElement & { node?: unknown }, cardsetion: HTMLDivElement): void {
	const nodeMap = node.node;
	if (!nodeMap) {
		return;
	}
	if (!isThrownNodeMap(nodeMap)) {
		throw new TypeError("thrown node map must be an object");
	}
	const previous = nodeMap.cardsetion;
	if (previous) {
		if (!isRemovableThrownCardsetion(previous)) {
			throw new TypeError("thrown card section must be removable");
		}
		previous.remove();
		delete nodeMap.cardsetion;
	}
	nodeMap.cardsetion = cardsetion;
}

export function createGainAnimationNode(): GainAnimationNode {
	return Object.assign(ui.create.div(".card.thrown"), {
		moveTo: lib.element.Card.prototype.moveTo,
		moveDelete: lib.element.Card.prototype.moveDelete,
	});
}

export function isMarkNode(node: Node | null): node is MarkDomNode {
	return node instanceof HTMLDivElement;
}

export function hasMarkName(node: MarkDomNode, name: unknown): boolean {
	return node.name == name;
}

export function hasMarkIdentifier(node: MarkDomNode, identifier: unknown): boolean {
	return node.markidentifer == identifier;
}

export function hasFixedMarkInfo(node: MarkDomNode): boolean {
	const info = node.info;
	return info !== null && (typeof info === "object" || typeof info === "function") && "fixed" in info && Boolean(info.fixed);
}

export function getMarkCount(node: MarkDomNode): HTMLDivElement | undefined {
	const markcount = node.markcount;
	if (!markcount) return;
	if (!(markcount instanceof HTMLDivElement)) {
		throw new TypeError("mark count must be an HTMLDivElement");
	}
	return markcount;
}

export function deleteMarkNode(node: MarkDomNode): void {
	const deleteMark = node.delete;
	if (typeof deleteMark !== "function") {
		throw new TypeError("mark node delete method must be callable");
	}
	deleteMark.call(node);
}

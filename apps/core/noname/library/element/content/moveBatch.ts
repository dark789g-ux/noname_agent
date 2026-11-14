import { type GuanxingContainer } from "./moveDrag.js";

export function createBatchMove(event) {
	const filterMove = event.filterMove;
	const filterBatchMove = (buttonList: Button[], buttonsDiv: GuanxingContainer, position: "first" | "last"): Button[] => {
		const parent = buttonList[0]?.parentElement;

		if (!parent) {
			return [];
		}

		const original: Element[] = Array.from(parent.children);
		const filtered: Button[] = [];
		const movedButtons = new Set<Element>();
		const eventMoved = Object.assign({}, event.moved);
		const addChildren = position === "first" ? b => buttonsDiv.insertBefore(b, buttonsDiv.firstChild) : b => buttonsDiv.appendChild(b);
		const addMovedList = position === "first" ? l => event.moved[buttonsDiv._link].unshift(l) : l => event.moved[buttonsDiv._link].push(l);

		for (const button of buttonList) {
			if (button.parentElement !== parent) {
				continue;
			}

			if (!filterMove(button, buttonsDiv._link, event.moved)) {
				continue;
			}

			filtered.push(button);
			movedButtons.add(button);
			addChildren(button);
			addMovedList(button.link);
		}

		let previous: Element | null = null;

		for (const button of original) {
			if (!movedButtons.has(button)) {
				previous = button;
				continue;
			}

			if (!previous) {
				parent.insertBefore(button, parent.firstChild);
			} else {
				parent.insertBefore(button, previous.nextSibling);
			}

			previous = button;
		}

		Object.assign(event.moved, eventMoved);
		return filtered;
	};

	return filterBatchMove;
}

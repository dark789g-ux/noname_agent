import { materializeDirectShape } from "./protocol.js";
function materializeDirectResult(options) {
  const { kind, event, cards, targets, buttons, control, targetCard, numbers, stageCount, assertCard, assertTarget, fail } = options;
  switch (kind) {
    case "chooseCard":
      cards.forEach(assertCard);
      return materializeDirectShape(kind, { cards });
    case "chooseTarget":
      targets.forEach((target) => assertTarget(target, targetCard));
      return materializeDirectShape(kind, { targets });
    case "chooseCardTarget":
      cards.forEach(assertCard);
      targets.forEach((target) => assertTarget(target, cards[0]));
      return materializeDirectShape(kind, { cards, targets });
    case "chooseToGive":
      cards.forEach(assertCard);
      return materializeDirectShape(kind, { cards });
    case "chooseButton":
      return materializeDirectShape(kind, { buttons });
    case "choosePlayerCard":
    case "gainPlayerCard":
    case "discardPlayerCard":
      return { ...materializeDirectShape("chooseButton", { buttons }), cards: buttons.map((button) => button.link) };
    case "chooseButtonTarget":
      targets.forEach((target) => assertTarget(target, buttons[0]?.link));
      return materializeDirectShape(kind, { buttons, targets });
    case "chooseControl": {
      if (control === void 0) fail("chooseControl: no control selected");
      return materializeDirectShape(kind, { control, controls: event.controls });
    }
    case "chooseNumbers":
      if (numbers.length !== stageCount) fail("chooseNumbers: invalid selection");
      return materializeDirectShape(kind, { numbers });
    default:
      fail(`unsupported direct result: ${kind}`);
  }
}
export {
  materializeDirectResult
};

import "../../../../../noname.js";
import "../contracts/choiceAndPhaseContract.js";
import { requireParentEvent } from "../dom/nodeGuards.js";
import { game } from "../../../../game/index.js";
import { get } from "../../../../get/binding.js";
import { _status } from "../../../../status/index.js";
const phaseMethods = {
  isPhaseUsing(notmeisok) {
    if (!notmeisok && _status.currentPhase != this) {
      return false;
    }
    return _status.event.name == "phaseUse" || _status.event.getParent("phaseUse").name == "phaseUse";
  },
  insertPhase(skill, insert) {
    let evt = _status.event.getParent("phase");
    let next;
    if (evt && evt.parent && evt.parent.next) {
      evt = evt.parent;
      next = game.createEvent("phase", false, requireParentEvent(evt));
    } else if (_status.event.parent && _status.event.parent.next) {
      evt = _status.event.parent;
      next = game.createEvent("phase", false, requireParentEvent(evt));
    } else {
      evt = null;
      next = game.createEvent("phase", false);
    }
    if (evt && insert && requireParentEvent(evt).next.includes(next)) {
      requireParentEvent(evt).next.remove(next);
      requireParentEvent(evt).next.unshift(next);
    }
    next.player = this;
    next.forceDie = true;
    next.includeOut = true;
    next.skill = skill || _status.event.name;
    next.setContent("phase");
    return next;
  },
  phase(skill) {
    const next = game.createEvent("phase", false);
    next.player = this;
    next.setContent("phase");
    if (!_status.roundStart) {
      _status.roundStart = this;
    }
    if (skill) {
      next.skill = skill;
    }
    next.forceDie = true;
    next.includeOut = true;
    return next;
  },
  phaseZhunbei() {
    const next = game.createEvent("phaseZhunbei");
    next.player = this;
    next.setContent("phaseZhunbei");
    return next;
  },
  phaseJudge() {
    const next = game.createEvent("phaseJudge");
    next.player = this;
    next.setContent("phaseJudge");
    return next;
  },
  phaseDraw() {
    const next = game.createEvent("phaseDraw");
    next.player = this;
    next.num = 2;
    if ((get.config("first_less") || _status.connectMode || _status.first_less_forced) && game.phaseNumber == 1 && _status.first_less) {
      next.num--;
    }
    next.setContent("phaseDraw");
    return next;
  },
  phaseUse() {
    const next = game.createEvent("phaseUse", false);
    next.player = this;
    next.setContent("phaseUse");
    return next;
  },
  phaseDiscard() {
    const next = game.createEvent("phaseDiscard");
    next.player = this;
    next.setContent("phaseDiscard");
    return next;
  },
  phaseJieshu() {
    const next = game.createEvent("phaseJieshu");
    next.player = this;
    next.setContent("phaseJieshu");
    return next;
  },
  skip(name) {
    this.skipList.add(name);
  }
};
export {
  phaseMethods
};

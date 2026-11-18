import "../../../../noname.js";
import { get } from "../../../get/binding.js";
import { _status } from "../../../status/index.js";
import { game } from "../../../game/index.js";
const selectionMethods = {
  backup(skill) {
    this._backup = {
      filterButton: this.filterButton,
      selectButton: this.selectButton,
      filterTarget: this.filterTarget,
      selectTarget: this.selectTarget,
      deadTarget: this.deadTarget,
      chessForceAll: this.chessForceAll,
      filterCard: this.filterCard,
      selectCard: this.selectCard,
      position: this.position,
      forced: this.forced,
      fakeforce: this.fakeforce,
      _aiexclude: this._aiexclude,
      allowChooseAll: this.allowChooseAll,
      complexSelect: this.complexSelect,
      complexCard: this.complexCard,
      complexTarget: this.complexTarget,
      _buttonChoice: this._buttonChoice,
      _cardChoice: this._cardChoice,
      _targetChoice: this._targetChoice,
      _skillChoice: this._skillChoice,
      ai1: this.ai1,
      ai2: this.ai2,
      filterOk: this.filterOk,
      selectionSpec: this.selectionSpec,
      selectionSpecExists: Object.hasOwn(this, "selectionSpec")
    };
    if (skill) {
      const info = get.info(skill);
      this.skill = skill;
      this._aiexclude = [];
      if (info.viewAs) {
        if (info.filterButton != void 0) {
          this.filterButton = get.filter(info.filterButton);
        }
        if (info.selectButton != void 0) {
          this.selectButton = info.selectButton;
        }
        if (info.filterTarget != void 0) {
          this.filterTarget = get.filter(typeof info.filterTarget === "boolean" ? {} : info.filterTarget);
        }
        if (info.selectTarget != void 0) {
          this.selectTarget = info.selectTarget;
        }
        if (info.deadTarget != void 0) {
          this.deadTarget = info.deadTarget;
        }
        if (info.chessForceAll != void 0) {
          this.chessForceAll = info.chessForceAll;
        }
        if (info.filterCard != void 0) {
          if (info.ignoreMod) {
            this.ignoreMod = true;
          }
          this.filterCard2 = get.filter(typeof info.filterCard === "boolean" ? {} : info.filterCard);
          this.filterCard = function(card, player, event) {
            const evt = event || _status.event;
            if (!evt.ignoreMod && player) {
              const mod = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
              if (mod != "unchanged") {
                return mod;
              }
            }
            return get.filter(evt.filterCard2).apply(this, [card, player, event]);
          };
        }
        this.filterOk = function() {
          const evt = _status.event;
          const card = get.card(), player = get.player();
          const savedState = evt._backup;
          if (!savedState) {
            throw new TypeError("choose event backup state is missing");
          }
          const filter = savedState.filterCard;
          if (info.viewAs && filter) {
            if (!player) {
              throw new Error("choose event filter requires a player");
            }
            if (!filter(card, player, evt)) {
              return false;
            }
          }
          if (info.filterOk != void 0) {
            return info.filterOk();
          }
          const currentBackup = evt._backup;
          if (!currentBackup) {
            throw new TypeError("choose event backup state is missing");
          }
          if (currentBackup.filterOk) {
            return currentBackup.filterOk();
          }
          return true;
        };
        if (info.selectCard != void 0) {
          this.selectCard = info.selectCard;
        }
        if (info.position != void 0) {
          this.position = info.position;
        }
        if (info.allowChooseAll != void 0) {
          this.allowChooseAll = info.allowChooseAll;
        }
        if (info.complexSelect != void 0) {
          this.complexSelect = info.complexSelect;
        }
        if (info.complexCard != void 0) {
          this.complexCard = info.complexCard;
        }
        if (info.complexTarget != void 0) {
          this.complexTarget = info.complexTarget;
        }
        if (info.ai1 != void 0) {
          this.ai1 = info.ai1;
        }
        if (info.ai2 != void 0) {
          this.ai2 = info.ai2;
        }
      } else {
        this.filterButton = info.filterButton ? get.filter(info.filterButton) : void 0;
        this.selectButton = info.selectButton;
        this.filterTarget = info.filterTarget ? get.filter(typeof info.filterTarget === "boolean" ? {} : info.filterTarget) : void 0;
        this.selectTarget = info.selectTarget;
        this.deadTarget = info.deadTarget;
        this.chessForceAll = info.chessForceAll;
        this.filterCard = info.filterCard ? get.filter(typeof info.filterCard === "boolean" ? {} : info.filterCard) : void 0;
        this.selectCard = info.selectCard;
        this.position = info.position;
        this.allowChooseAll = info.allowChooseAll;
        this.complexSelect = info.complexSelect;
        this.complexCard = info.complexCard;
        this.complexTarget = info.complexTarget;
        if (info.ai1 != void 0) {
          this.ai1 = info.ai1;
        }
        if (info.ai2 != void 0) {
          this.ai2 = info.ai2;
        }
        this.filterOk = info.filterOk;
      }
      if (info.selectionSpec !== void 0) {
        this.selectionSpec = info.selectionSpec;
      } else {
        delete this.selectionSpec;
      }
      delete this.fakeforce;
    }
    delete this._buttonChoice;
    delete this._cardChoice;
    delete this._targetChoice;
    delete this._skillChoice;
    return this;
  },
  restore() {
    if (this._backup) {
      this.filterButton = this._backup.filterButton;
      this.selectButton = this._backup.selectButton;
      this.filterTarget = this._backup.filterTarget;
      this.selectTarget = this._backup.selectTarget;
      this.deadTarget = this._backup.deadTarget;
      this.chessForceAll = this._backup.chessForceAll;
      this.filterCard = this._backup.filterCard;
      this.selectCard = this._backup.selectCard;
      this.position = this._backup.position;
      this.forced = this._backup.forced;
      this.fakeforce = this._backup.fakeforce;
      this._aiexclude = this._backup._aiexclude;
      this.allowChooseAll = this._backup.allowChooseAll;
      this.complexSelect = this._backup.complexSelect;
      this.complexCard = this._backup.complexCard;
      this.complexTarget = this._backup.complexTarget;
      this.ai1 = this._backup.ai1;
      this.ai2 = this._backup.ai2;
      this._buttonChoice = this._backup._buttonChoice;
      this._cardChoice = this._backup._cardChoice;
      this._targetChoice = this._backup._targetChoice;
      this._skillChoice = this._backup._skillChoice;
      this.filterOk = this._backup.filterOk;
      if (this._backup.selectionSpecExists) {
        this.selectionSpec = this._backup.selectionSpec;
      } else {
        delete this.selectionSpec;
      }
    }
    delete this.skill;
    delete this.ignoreMod;
    delete this.filterCard2;
    return this;
  },
  resume() {
    delete this._buttonChoice;
    delete this._cardChoice;
    delete this._targetChoice;
    delete this._skillChoice;
    return this;
  }
};
export {
  selectionMethods
};

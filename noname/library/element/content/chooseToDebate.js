import "../../../../noname.js";
import { normalizeSelectionResult } from "./selectionResults.js";
import { get } from "../../../get/binding.js";
import { game } from "../../../game/index.js";
import { lib } from "../../index.js";
import { ui } from "../../../ui/index.js";
const chooseToDebateContent = {
  async chooseToDebate(event, trigger, player) {
    const { list } = event;
    let targets = list.filter((target) => target.hasCards("h"));
    let result;
    if (targets.length) {
      if (event.fixedResult) {
        targets = targets.removeArray(event.fixedResult.map((i) => i[0]));
      }
      if (targets.length) {
        const next = player.chooseCardOL({
          list: targets,
          prompt: `${get.translation(player)}发起了议事，请选择展示的手牌`,
          forced: true,
          glow_result: false,
          ai: event.ai ?? (() => Math.random())
        }).set("type", "debate").set("source", player).set(
          "aiCard",
          event.aiCard ?? ((target) => {
            const getAi = get.event().ai || (() => Math.random());
            const hs = target.getCards("h").sort((a, b) => getAi(b) - getAi(a));
            return { bool: true, cards: [hs[0]] };
          })
        );
        const debateResult = await next.forResult();
        if (Array.isArray(debateResult) && debateResult.every((item) => typeof item === "object" && item !== null && !Array.isArray(item))) {
          result = debateResult;
        } else {
          result = normalizeSelectionResult(debateResult);
        }
      } else {
        event.noselected = true;
        result = { bool: false };
      }
    } else {
      result = { bool: false };
    }
    const resultList = [];
    if (Array.isArray(result)) {
      resultList.push(...result);
    } else if (typeof result == "object" && result !== null) {
      resultList.push(result);
    }
    const red = [];
    const black = [];
    const others = [];
    const otherColors = /* @__PURE__ */ new Map();
    event.opinions = ["red", "black"];
    event.videoId = lib.status.videoId++;
    if (!event.noselected) {
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        const debateResult = resultList[i];
        if (!target || !debateResult || !Array.isArray(debateResult.cards) || !debateResult.cards.length) {
          continue;
        }
        const card = debateResult.cards[0];
        const color = get.color(card, target);
        if (color == "red") {
          red.push([target, card]);
        } else if (color == "black") {
          black.push([target, card]);
        } else {
          others.push([target, card]);
        }
      }
    }
    if (event.fixedResult) {
      for (const list2 of event.fixedResult) {
        const color = typeof list2[1] == "string" ? list2[1] : get.color(list2[1], list2[0]);
        if (color == "red") {
          red.push(list2);
        } else if (color == "black") {
          black.push(list2);
        } else {
          others.push(list2);
        }
        targets.push(list2[0]);
      }
    }
    if (event.debateIgnore !== false) {
      event.opinions.add("others");
    } else {
      const colors2 = /* @__PURE__ */ new Map();
      for (const list2 of others) {
        const cardColor = typeof list2[1] == "string" ? list2[1] : get.color(list2[1], list2[0]);
        const color = cardColor ?? "unknown";
        if (!colors2.has(color)) {
          colors2.set(color, [list2]);
        } else {
          const colorPairs = colors2.get(color);
          if (colorPairs) {
            colorPairs.push(list2);
          }
        }
      }
      for (const [color, pairs] of colors2) {
        event.opinions.add(color);
        otherColors.set(color, pairs);
      }
    }
    event.targets = targets;
    const colors = {
      red,
      black,
      others
    };
    for (const [color, list2] of otherColors) {
      colors[color] = list2;
    }
    Object.assign(event, colors);
    await event.trigger("debateShowOpinion");
    const getPairs = (color) => {
      switch (color) {
        case "red":
          return red;
        case "black":
          return black;
        case "others":
          return others;
        default:
          return otherColors.get(color) ?? [];
      }
    };
    for (const color of event.opinions) {
      const pairs = getPairs(color);
      if (pairs.length) {
        game.log(
          [...new Set(pairs.map((pair) => pair[0]))],
          color == "other" ? "没有意见" : `意见为<span class="firetext">${get.translation(color)}</span>`,
          pairs.length ? "，展示了" : "",
          pairs.map((pair) => pair[1])
        );
        for (const [target, card] of pairs) {
          if (typeof card != "string") {
            await target.showCards(card).set("triggeronly", true);
          }
        }
      }
    }
    game.broadcastAll(showDebateResult, get.translation(player), event.videoId, event, colors);
    await game.delay(4);
    game.broadcastAll(lib.message.client.closeDialog, event.videoId);
    const opinions = event.opinions.filter((i) => i != "others").toSorted((a, b) => getPairs(b).length - getPairs(a).length);
    const opinion = getPairs(opinions[0]).length > getPairs(opinions[1]).length ? opinions[0] : null;
    if (opinion) {
      game.log(player, "本次发起的议事结果为", opinion == "red" ? '<span class="firetext">红色</span>' : `#g${get.translation(opinion)}`);
    } else {
      game.log(player, "本次发起的议事无结果");
    }
    event.result = {
      bool: true,
      opinion,
      opinions: event.opinions,
      targets
    };
    for (const color of event.opinions) {
      event.result[color] = getPairs(color);
    }
    if (event.callback) {
      const next = game.createEvent("debateCallback", false);
      next.player = player;
      next.debateResult = get.copy(event.result);
      next.setContent(event.callback);
      await next;
    }
    return;
    function showDebateResult(name, id, event2, colors2) {
      const dialog = ui.create.dialog(`${name}发起了议事`, "hidden", "forcebutton");
      dialog.videoId = id;
      dialog.classList.add("scroll1");
      dialog.classList.add("scroll2");
      dialog.classList.add("fullwidth");
      if (event2.opinions.includes("others")) {
        if (colors2.other?.length > 2) {
          dialog.classList.add("fullheight");
        }
        for (const color of event2.opinions) {
          if (color == "others" && !colors2.other?.length) {
            continue;
          }
          dialog.addNewRow(
            { item: get.translation(color), ratio: 1 },
            {
              item: colors2[color].slice().map((list2) => {
                let element = get.copy(list2[1]);
                if (typeof element == "string") {
                  if (!lib.card[`debate_${element}`]) {
                    lib.card[`debate_${element}`] = {};
                    lib.translate[`debate_${element}`] = get.translation(element);
                  }
                  element = new lib.element.VCard(game.createCard(`debate_${element}`, " ", " "));
                }
                element._custom = (button) => {
                  game.createButtonCardsetion(list2[0].getName(true), button);
                };
                return element;
              }),
              ratio: 8,
              overflow: "scroll"
            }
          );
        }
      } else {
        dialog.buttonss = [];
        dialog.add('<div class="text center">意见</div>');
        const buttons = ui.create.div(".buttons", dialog.content);
        dialog.buttonss.push(buttons);
        buttons.classList.add("popup");
        buttons.classList.add("guanxing");
        for (const color of event2.opinions) {
          for (const list2 of colors2[color]) {
            let button;
            if (typeof list2[1] == "string") {
              button = ui.create.button(["", "", list2[1]], "vcard", dialog.buttonss[0]);
            } else {
              button = ui.create.button(list2[1], "card", dialog.buttonss[0]);
            }
            game.createButtonCardsetion(list2[0].getName(true), button);
          }
        }
      }
      dialog.open();
    }
  },
  async delay(event) {
    await game[event.name].apply(game, event._args);
  },
  async chooseCooperationFor(event, trigger, player) {
    const target = event.getTarget();
    const next = player.chooseButton({
      createDialog: [`选择和${get.translation(target)}的协力方式`, [event.cardlist, "vcard"]],
      forced: true
    });
    next.set("ai", event.ai ?? (() => Math.random()));
    const result = await next.forResult();
    if (typeof result !== "string" && result.bool && Array.isArray(result.links) && result.links[0]) {
      player.cooperationWith(target, result.links[0][2].slice(12), event.reason);
    }
  }
};
export {
  chooseToDebateContent
};

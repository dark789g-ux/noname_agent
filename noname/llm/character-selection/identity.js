import "../../../noname.js";
import { getLLMConfig, discardLLMOpeningPreparation, prepareLLMGame } from "../index.js";
import { runSelectionBatches } from "./batch.js";
import { CharacterOpeningController } from "./controller.js";
import { lib } from "../../library/index.js";
import { _status } from "../../status/index.js";
import { game } from "../../game/index.js";
import { get } from "../../get/binding.js";
let active;
function createIdentityOpening(event, retainOpeningResults = false) {
  const skipped = !!event.llmOpening?.state.skipped;
  active?.close(true);
  active = void 0;
  const enabled = event.llmOpening ? getLLMConfig().enabled : !!lib.config.llm_enabled;
  if (_status.connectMode || _status.mode !== "normal" || _status.brawl || !enabled || event.chosen?.length || event.modchosen || typeof lib.config.test_game === "string" && lib.config.test_game !== "_") {
    discardLLMOpeningPreparation();
    return;
  }
  if (!retainOpeningResults) delete event.llmRemainingChoices;
  prepareLLMGame(!!event.llmOpening, retainOpeningResults);
  const controller = new CharacterOpeningController(event);
  if (skipped) controller.state.skip();
  if (!game.players.some((player) => controller.eligible(player))) {
    controller.close();
    return;
  }
  active = controller;
  return controller;
}
async function selectOpeningMonarch(event, monarchCandidates, commonCandidates) {
  const opening = event.llmOpening;
  if (!opening?.eligible(game.zhu)) return false;
  const count = get.config("choice_zhu");
  const sources = [.../* @__PURE__ */ new Set([...monarchCandidates, ...commonCandidates.slice(0, count)])];
  const selected = await opening.decide(opening.prepare(game.zhu, sources, monarchCandidates));
  opening.apply(selected);
  return true;
}
function identityCandidateCount(player) {
  return Number(get.config(`choice_${player.identity}`));
}
function releaseUnusedSources(event, sources, usedSources) {
  const used = new Set(usedSources);
  event.list.push(...sources.filter((source) => !used.has(get.sourceCharacter(source))));
}
async function selectOpeningSelf(event, sources) {
  const opening = event.llmOpening;
  if (!opening?.eligible(game.me) || event.chosen.length || event.modchosen) return false;
  delete event.llmRemainingChoices;
  if (game.me === game.zhu) {
    const monarchPreferred = sources.filter((name) => {
      const versions = lib.characterReplace[name] || [name];
      return versions.some((version) => lib.character[version]?.isZhugong);
    });
    event.llmChoice = await opening.decide(opening.prepare(game.me, sources, monarchPreferred));
    return true;
  }
  for (const source of sources) event.list.remove(source);
  const others = game.players.filter((player) => player !== game.me && player !== game.zhu && opening.eligible(player));
  const remainingChoices = /* @__PURE__ */ new Map();
  const sourcesByJob = /* @__PURE__ */ new Map();
  const selectedByJob = /* @__PURE__ */ new Map();
  const need = (player) => player === game.me ? 0 : identityCandidateCount(player);
  await runSelectionBatches([game.me, ...others], {
    eligible: () => true,
    local: () => {
    },
    canBatch: (batch, next) => event.list.length >= batch.reduce((sum, player) => sum + need(player), need(next)),
    prepare: (player) => {
      if (player === game.me) {
        const job2 = opening.prepare(game.me, sources);
        sourcesByJob.set(job2, sources);
        return job2;
      }
      event.list.randomSort();
      const playerSources = event.list.splice(0, identityCandidateCount(player));
      const job = opening.prepare(player, playerSources);
      sourcesByJob.set(job, playerSources);
      return job;
    },
    decide: (job) => opening.decide(job),
    commit: (job, selected) => {
      selectedByJob.set(job, selected);
      if (job.player === game.me) {
        event.llmChoice = selected;
      } else {
        remainingChoices.set(job.player, selected);
      }
    },
    release: (job) => {
      releaseUnusedSources(event, sourcesByJob.get(job), selectedByJob.get(job).result.sources);
    }
  });
  event.llmRemainingChoices = remainingChoices;
  return true;
}
async function selectRemainingOpening(event) {
  let prepared = event.llmOpening;
  if (!prepared) return false;
  if (!prepared.current() && !event.llmChoice) {
    prepared = createIdentityOpening(event, true);
    event.llmOpening = prepared;
    if (!prepared) return false;
  }
  const opening = prepared;
  const remainingChoices = event.llmRemainingChoices;
  delete event.llmRemainingChoices;
  const players = game.players.filter((player) => player !== game.me && player !== game.zhu);
  const sourcesByJob = /* @__PURE__ */ new Map();
  const selectedByJob = /* @__PURE__ */ new Map();
  try {
    if (remainingChoices?.size) {
      for (const player of players) {
        const preDecided = remainingChoices.get(player);
        if (preDecided) opening.apply(preDecided);
      }
    }
    const pending = players.filter((player) => !remainingChoices?.has(player));
    await runSelectionBatches(pending, {
      eligible: (player) => opening.eligible(player),
      local: (player) => {
        opening.assertCurrent();
        event.list.randomSort();
        event.ai(player, event.list.splice(0, identityCandidateCount(player)), null, event.list);
      },
      canBatch: (batch, next) => event.list.length >= batch.reduce((sum, player) => sum + identityCandidateCount(player), identityCandidateCount(next)),
      prepare: (player) => {
        event.list.randomSort();
        const sources = event.list.splice(0, identityCandidateCount(player));
        const job = opening.prepare(player, sources);
        sourcesByJob.set(job, sources);
        return job;
      },
      decide: (job) => opening.decide(job),
      commit: (job, selected) => {
        selectedByJob.set(job, selected);
        opening.apply(selected);
      },
      release: (job) => {
        releaseUnusedSources(event, sourcesByJob.get(job), selectedByJob.get(job).result.sources);
      }
    });
  } finally {
    opening.close();
  }
  return true;
}
export {
  createIdentityOpening,
  selectOpeningMonarch,
  selectOpeningSelf,
  selectRemainingOpening
};

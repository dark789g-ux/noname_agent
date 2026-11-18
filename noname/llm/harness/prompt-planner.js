import { LLM_USER_CHINESE_REMINDER, renderStatelessContextMessages, LLM_SYSTEM_PROMPT_PREFIX } from "../prompt-facts.js";
import { formatPlayerProfiles, formatPlayerStates } from "../prompt-format.js";
import { formatIncrementalEvents, formatPileOverview } from "../prompt-history.js";
import { formatAllowedToolsLine } from "../tools.js";
function hashPlayerProfile(profile) {
  const text = JSON.stringify({
    seat: profile.seat,
    name: profile.name,
    identity: profile.identity,
    group: profile.group,
    sex: profile.sex,
    skills: profile.skills
  });
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
function buildProfileHashes(profiles) {
  const result = {};
  for (const profile of profiles) {
    result[profile.seat] = hashPlayerProfile(profile);
  }
  return result;
}
function appendExtrasBeforeReminder(userBase, extras) {
  const filtered = extras.filter(Boolean);
  if (!filtered.length) return userBase;
  const suffix = `

${LLM_USER_CHINESE_REMINDER}`;
  if (userBase.endsWith(suffix)) {
    const head = userBase.slice(0, -suffix.length);
    return `${head}

${filtered.join("\n\n")}${suffix}`;
  }
  return `${userBase}

${filtered.join("\n\n")}`;
}
function planPrompt(facts, state, options) {
  const nextHashes = buildProfileHashes(facts.profiles);
  const mustFull = !state.initialized || Boolean(options.rebuildReason) || options.eventWindow.truncated;
  const allowedToolsLine = options.allowedToolNames?.length ? formatAllowedToolsLine(options.allowedToolNames) : "";
  if (mustFull) {
    const [systemMsg, userMsg] = renderStatelessContextMessages(facts);
    const rebuildReason = options.rebuildReason || (options.eventWindow.truncated ? "event_window_truncated" : void 0);
    const rebuilt = state.initialized;
    const userBase = String(userMsg.content || "");
    const userMessage = appendExtrasBeforeReminder(userBase, [options.stageInstruction || "", allowedToolsLine]);
    return {
      mode: "full",
      rebuilt,
      ...rebuilt && rebuildReason ? { rebuildReason } : {},
      systemMessage: String(systemMsg.content || `${LLM_SYSTEM_PROMPT_PREFIX}

${formatPlayerProfiles(facts.profiles)}`),
      userMessage,
      addedEventsCount: facts.roundHistory.entries.length,
      nextEventSeq: options.eventWindow.latestSeq,
      profileHashes: nextHashes,
      changedProfileSeats: facts.profiles.map((p) => p.seat)
    };
  }
  const changedProfiles = facts.profiles.filter((profile) => state.profileHashes[profile.seat] !== nextHashes[profile.seat]);
  const sections = [];
  if (changedProfiles.length > 0) {
    const profileLines = ["## 武将技能变更更新："];
    for (const profile of changedProfiles) {
      const seatLabel = profile.seat > 0 ? `${profile.seat}号位` : "未分配";
      profileLines.push(`
[${seatLabel}] ${profile.name}（${profile.identity} / ${profile.group} / ${profile.sex}）`);
      if (!profile.skills.length) {
        profileLines.push("- 无");
      } else {
        for (const skill of profile.skills) {
          profileLines.push(`- ${skill.name}：${skill.description}`);
        }
      }
    }
    sections.push(profileLines.join("\n"));
  }
  sections.push(formatIncrementalEvents(options.eventWindow.entries));
  sections.push(facts.decisionHeaderText);
  const pileOverviewText = formatPileOverview(facts.pileOverview);
  if (pileOverviewText) sections.push(pileOverviewText);
  sections.push(formatPlayerStates(facts.states));
  if (facts.decisionChoicesText) {
    sections.push(facts.decisionChoicesText.replace(/^\n+/, ""));
  }
  if (options.stageInstruction) {
    sections.push(options.stageInstruction);
  }
  if (allowedToolsLine) {
    sections.push(allowedToolsLine);
  }
  sections.push(LLM_USER_CHINESE_REMINDER);
  return {
    mode: "incremental",
    rebuilt: false,
    userMessage: sections.filter(Boolean).join("\n\n"),
    addedEventsCount: options.eventWindow.entries.length,
    nextEventSeq: options.eventWindow.latestSeq,
    profileHashes: nextHashes,
    changedProfileSeats: changedProfiles.map((p) => p.seat)
  };
}
export {
  buildProfileHashes,
  hashPlayerProfile,
  planPrompt
};

import { defineComponent, computed, ref, watch, onBeforeUnmount, openBlock, createElementBlock, normalizeClass, createElementVNode, toDisplayString, unref, withModifiers, createCommentVNode, Fragment, createTextVNode, createVNode, renderList, createBlock } from "vue";
import { getLLMLogStatusPresentation } from "../llmLogStatus.js";
import { copyToClipboard, formatUsageSummary, formatClockTime, formatShortLogId, formatDurationSec, formatCharacterSelectionResult } from "../timelineTypes.js";
import LLMThinkingBlock from "./LLMThinkingBlock.vue.js";
import LLMToolCallLine from "./LLMToolCallLine.vue.js";
const _hoisted_1 = { class: "decision-header" };
const _hoisted_2 = { class: "decision-time" };
const _hoisted_3 = ["title"];
const _hoisted_4 = {
  key: 1,
  class: "active-dot"
};
const _hoisted_5 = { class: "decision-point" };
const _hoisted_6 = { class: "decision-meta" };
const _hoisted_7 = {
  key: 2,
  class: "decision-usage"
};
const _hoisted_8 = ["title"];
const _hoisted_9 = { class: "decision-body" };
const _hoisted_10 = {
  key: 0,
  class: "active-output"
};
const _hoisted_11 = { class: "output-label" };
const _hoisted_12 = { class: "output-preview" };
const _hoisted_13 = {
  key: 1,
  class: "waiting-hint"
};
const _hoisted_14 = {
  key: 2,
  class: "decision-note"
};
const _hoisted_15 = {
  key: 3,
  class: "decision-note note-error"
};
const _hoisted_16 = {
  key: 4,
  class: "decision-note note-fallback"
};
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "LLMDecisionBlock",
  props: {
    entry: {},
    active: { type: Boolean },
    activeStream: {},
    partialArgs: {},
    elapsedMs: {},
    liveThinkingMs: {}
  },
  emits: ["select-detail"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const statusInfo = computed(() => getLLMLogStatusPresentation(props.entry.status));
    const copied = ref(false);
    let copyTimer = null;
    function clearCopyTimer() {
      if (copyTimer !== null) {
        clearTimeout(copyTimer);
        copyTimer = null;
      }
    }
    watch(
      () => props.entry.id,
      () => {
        clearCopyTimer();
        copied.value = false;
      }
    );
    onBeforeUnmount(clearCopyTimer);
    async function handleCopyId() {
      if (!props.entry.id) return;
      const ok = await copyToClipboard(props.entry.id);
      if (!ok) return;
      copied.value = true;
      clearCopyTimer();
      copyTimer = setTimeout(() => {
        copied.value = false;
        copyTimer = null;
      }, 1500);
    }
    const isActiveThinking = computed(() => {
      if (!props.active) return false;
      const stream = props.activeStream;
      if (!stream) return false;
      return stream.phase === "thinking" || stream.phase === "idle" && Boolean(stream.thought);
    });
    const activeOutputText = computed(() => props.activeStream ? props.activeStream.text : props.partialArgs || "");
    const activeOutputLabel = computed(() => props.activeStream?.phase === "tool_calling" ? "● 正在组装决策参数" : "● 输出中");
    const usageBadge = computed(() => {
      if (props.active) return formatUsageSummary(props.activeStream?.usage);
      const turns = props.entry.turns || [];
      for (let i = turns.length - 1; i >= 0; i--) {
        const summary = formatUsageSummary(turns[i]?.usage);
        if (summary) return summary;
      }
      return "";
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        class: normalizeClass(["llm-decision-block", { "is-active": __props.active, "is-failed": !__props.active && __props.entry.status !== "success" }])
      }, [
        createElementVNode("div", _hoisted_1, [
          createElementVNode("span", _hoisted_2, toDisplayString(unref(formatClockTime)(__props.entry.timestamp)), 1),
          __props.entry.id ? (openBlock(), createElementBlock("button", {
            key: 0,
            type: "button",
            class: normalizeClass(["decision-log-id", { "is-copied": copied.value }]),
            title: copied.value ? `已复制: ${__props.entry.id}` : `点击复制日志ID: ${__props.entry.id}`,
            onClick: withModifiers(handleCopyId, ["stop"])
          }, toDisplayString(copied.value ? "✓ 已复制" : unref(formatShortLogId)(__props.entry.id)), 11, _hoisted_3)) : createCommentVNode("", true),
          __props.active ? (openBlock(), createElementBlock("span", _hoisted_4)) : createCommentVNode("", true),
          createElementVNode("span", _hoisted_5, toDisplayString(__props.entry.decisionPoint === "chooseCharacter" ? "开局选将" : __props.entry.decisionPoint), 1),
          createElementVNode("span", _hoisted_6, [
            __props.active ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
              createTextVNode(toDisplayString(unref(formatDurationSec)(__props.elapsedMs)), 1)
            ], 64)) : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
              createTextVNode(toDisplayString(unref(formatDurationSec)(__props.entry.durationMs)), 1)
            ], 64))
          ]),
          usageBadge.value ? (openBlock(), createElementBlock("span", _hoisted_7, toDisplayString(usageBadge.value), 1)) : createCommentVNode("", true),
          !__props.active ? (openBlock(), createElementBlock("span", {
            key: 3,
            class: normalizeClass(["decision-status", statusInfo.value.className]),
            title: statusInfo.value.text
          }, toDisplayString(statusInfo.value.icon), 11, _hoisted_8)) : createCommentVNode("", true),
          !__props.active ? (openBlock(), createElementBlock("button", {
            key: 4,
            class: "detail-btn",
            onClick: _cache[0] || (_cache[0] = ($event) => emit("select-detail", __props.entry))
          }, "详情")) : createCommentVNode("", true)
        ]),
        createElementVNode("div", _hoisted_9, [
          __props.active ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
            createVNode(LLMThinkingBlock, {
              thought: __props.activeStream?.thought || "",
              active: isActiveThinking.value,
              "thinking-ms": __props.liveThinkingMs || __props.activeStream?.thinkingMs,
              "thought-tokens": __props.activeStream?.usage?.thoughtTokens
            }, null, 8, ["thought", "active", "thinking-ms", "thought-tokens"]),
            activeOutputText.value ? (openBlock(), createElementBlock("div", _hoisted_10, [
              createElementVNode("span", _hoisted_11, toDisplayString(activeOutputLabel.value), 1),
              createElementVNode("pre", _hoisted_12, toDisplayString(activeOutputText.value), 1)
            ])) : !isActiveThinking.value ? (openBlock(), createElementBlock("div", _hoisted_13, "正在等待模型响应…")) : createCommentVNode("", true)
          ], 64)) : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
            __props.entry.turns?.length ? (openBlock(true), createElementBlock(Fragment, { key: 0 }, renderList(__props.entry.turns, (turn) => {
              return openBlock(), createElementBlock("div", {
                key: turn.index,
                class: "turn-row"
              }, [
                turn.thinking || turn.thinkingMs || turn.toolCall?.reasoningContent ? (openBlock(), createBlock(LLMThinkingBlock, {
                  key: 0,
                  thought: turn.thinking || turn.toolCall?.reasoningContent || "",
                  "thinking-ms": turn.thinkingMs,
                  "thought-tokens": turn.usage?.thoughtTokens
                }, null, 8, ["thought", "thinking-ms", "thought-tokens"])) : createCommentVNode("", true),
                turn.toolCall ? (openBlock(), createBlock(LLMToolCallLine, {
                  key: 1,
                  name: turn.toolCall.name,
                  args: turn.toolCall.arguments,
                  reason: turn.toolCall.reason,
                  "ref-labels": turn.refLabels || __props.entry.refLabels,
                  result: turn.result,
                  error: turn.error
                }, null, 8, ["name", "args", "reason", "ref-labels", "result", "error"])) : createCommentVNode("", true)
              ]);
            }), 128)) : __props.entry.response?.toolCall ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
              __props.entry.response.toolCall.reasoningContent ? (openBlock(), createBlock(LLMThinkingBlock, {
                key: 0,
                thought: __props.entry.response.toolCall.reasoningContent
              }, null, 8, ["thought"])) : createCommentVNode("", true),
              createVNode(LLMToolCallLine, {
                name: __props.entry.response.toolCall.name,
                args: __props.entry.response.toolCall.arguments,
                reason: __props.entry.response.toolCall.reason,
                "ref-labels": __props.entry.refLabels,
                result: __props.entry.response.translatedResult
              }, null, 8, ["name", "args", "reason", "ref-labels", "result"])
            ], 64)) : createCommentVNode("", true),
            __props.entry.decisionPoint === "chooseCharacter" && __props.entry.response?.execution === "automatic" ? (openBlock(), createElementBlock("div", _hoisted_14, " 本地选择：" + toDisplayString(unref(formatCharacterSelectionResult)(__props.entry.response.translatedResult, __props.entry.refLabels)), 1)) : createCommentVNode("", true),
            __props.entry.error ? (openBlock(), createElementBlock("div", _hoisted_15, " ✕ [" + toDisplayString(__props.entry.error.stage) + "] " + toDisplayString(__props.entry.error.message), 1)) : createCommentVNode("", true),
            __props.entry.fallbackReason ? (openBlock(), createElementBlock("div", _hoisted_16, " ↪ " + toDisplayString(__props.entry.fallbackReason), 1)) : createCommentVNode("", true)
          ], 64))
        ])
      ], 2);
    };
  }
});
export {
  _sfc_main as default
};

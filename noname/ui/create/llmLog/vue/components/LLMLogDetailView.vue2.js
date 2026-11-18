import { defineComponent, ref, watch, onBeforeUnmount, openBlock, createElementBlock, createElementVNode, toDisplayString, normalizeClass, createCommentVNode, createTextVNode, unref, Fragment, renderList, createBlock } from "vue";
import { getLLMLogStatusPresentation, getLLMLogStatusDetail, stripToolCallReasoning } from "../llmLogStatus.js";
import { copyToClipboard, formatUsageSummary, formatFullTime, formatCompactTokens, formatMs, formatDurationSec, formatJson } from "../timelineTypes.js";
import LLMLogContent from "./LLMLogContent.vue.js";
const _hoisted_1 = { class: "llm-detail-view" };
const _hoisted_2 = { class: "toolbar" };
const _hoisted_3 = { class: "detail-card" };
const _hoisted_4 = { class: "detail-card-body" };
const _hoisted_5 = { class: "field log-id-field" };
const _hoisted_6 = { class: "log-id-text" };
const _hoisted_7 = ["title"];
const _hoisted_8 = { class: "field" };
const _hoisted_9 = { class: "field" };
const _hoisted_10 = { class: "field" };
const _hoisted_11 = { class: "field" };
const _hoisted_12 = { class: "field" };
const _hoisted_13 = {
  key: 0,
  class: "field"
};
const _hoisted_14 = {
  key: 0,
  class: "session-badge mode-rebuilt"
};
const _hoisted_15 = {
  key: 1,
  class: "session-badge mode-degraded"
};
const _hoisted_16 = {
  key: 1,
  class: "field"
};
const _hoisted_17 = { class: "detail-card" };
const _hoisted_18 = { class: "detail-card-body" };
const _hoisted_19 = { class: "field" };
const _hoisted_20 = { class: "field" };
const _hoisted_21 = { class: "field" };
const _hoisted_22 = { class: "field" };
const _hoisted_23 = {
  key: 0,
  class: "field"
};
const _hoisted_24 = {
  key: 0,
  class: "detail-card"
};
const _hoisted_25 = {
  key: 1,
  class: "detail-card"
};
const _hoisted_26 = { class: "detail-card-body" };
const _hoisted_27 = {
  key: 0,
  class: "content-group-label"
};
const _hoisted_28 = {
  key: 2,
  class: "detail-card"
};
const _hoisted_29 = { class: "detail-card-body" };
const _hoisted_30 = {
  key: 3,
  class: "detail-card"
};
const _hoisted_31 = { class: "detail-card-body timing-table-wrap" };
const _hoisted_32 = { class: "timing-table" };
const _hoisted_33 = {
  key: 4,
  class: "detail-card"
};
const _hoisted_34 = { class: "detail-card-title" };
const _hoisted_35 = { class: "detail-card-body" };
const _hoisted_36 = { class: "turn-detail-header" };
const _hoisted_37 = {
  key: 0,
  class: "turn-meta-chip"
};
const _hoisted_38 = {
  key: 1,
  class: "turn-meta-chip"
};
const _hoisted_39 = { class: "code-block" };
const _hoisted_40 = {
  key: 5,
  class: "detail-card card-error"
};
const _hoisted_41 = { class: "detail-card-body" };
const _hoisted_42 = { class: "field" };
const _hoisted_43 = { class: "field" };
const _hoisted_44 = {
  key: 0,
  class: "field"
};
const _hoisted_45 = { class: "detail-card-title" };
const _hoisted_46 = { class: "detail-card-body" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "LLMLogDetailView",
  props: {
    entry: {},
    loading: { type: Boolean }
  },
  emits: ["back"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
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
    function isPromptMessage(message) {
      return message?.role === "system" || message?.role === "user";
    }
    function sessionModeLabel(session) {
      if (session.mode === "incremental") {
        const count = session.addedEventsCount;
        return count != null ? `增量 (+${count} 事件)` : "增量";
      }
      return "全量";
    }
    function turnUsageLabel(turn) {
      return formatUsageSummary(turn.usage);
    }
    const statusPresentation = getLLMLogStatusPresentation;
    const statusDetail = getLLMLogStatusDetail;
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", _hoisted_2, [
          createElementVNode("button", {
            class: "btn",
            onClick: _cache[0] || (_cache[0] = ($event) => emit("back"))
          }, "‹ 返回")
        ]),
        createElementVNode("div", _hoisted_3, [
          _cache[9] || (_cache[9] = createElementVNode("div", { class: "detail-card-title" }, "基本信息", -1)),
          createElementVNode("div", _hoisted_4, [
            createElementVNode("div", _hoisted_5, [
              _cache[1] || (_cache[1] = createElementVNode("span", { class: "label" }, "日志ID:", -1)),
              createElementVNode("code", _hoisted_6, toDisplayString(__props.entry.id), 1),
              __props.entry.id ? (openBlock(), createElementBlock("button", {
                key: 0,
                type: "button",
                class: normalizeClass(["copy-id-btn", { "is-copied": copied.value }]),
                title: copied.value ? `已复制: ${__props.entry.id}` : `点击复制日志ID: ${__props.entry.id}`,
                onClick: handleCopyId
              }, toDisplayString(copied.value ? "✓ 已复制" : "复制"), 11, _hoisted_7)) : createCommentVNode("", true)
            ]),
            createElementVNode("div", _hoisted_8, [
              _cache[2] || (_cache[2] = createElementVNode("span", { class: "label" }, "时间:", -1)),
              createTextVNode(" " + toDisplayString(unref(formatFullTime)(__props.entry.timestamp)), 1)
            ]),
            createElementVNode("div", _hoisted_9, [
              _cache[3] || (_cache[3] = createElementVNode("span", { class: "label" }, "决策点:", -1)),
              createTextVNode(" " + toDisplayString(__props.entry.decisionPoint), 1)
            ]),
            createElementVNode("div", _hoisted_10, [
              _cache[4] || (_cache[4] = createElementVNode("span", { class: "label" }, "玩家:", -1)),
              createTextVNode(" " + toDisplayString(__props.entry.playerName) + " [座位" + toDisplayString(__props.entry.playerSeatNum) + "]", 1)
            ]),
            createElementVNode("div", _hoisted_11, [
              _cache[5] || (_cache[5] = createElementVNode("span", { class: "label" }, "耗时:", -1)),
              createTextVNode(" " + toDisplayString(__props.entry.durationMs) + "ms", 1)
            ]),
            createElementVNode("div", _hoisted_12, [
              _cache[6] || (_cache[6] = createElementVNode("span", { class: "label" }, "状态:", -1)),
              createElementVNode("span", {
                class: normalizeClass(unref(statusPresentation)(__props.entry.status).className)
              }, toDisplayString(unref(statusPresentation)(__props.entry.status).icon) + " " + toDisplayString(unref(statusPresentation)(__props.entry.status).text), 3)
            ]),
            __props.entry.session ? (openBlock(), createElementBlock("div", _hoisted_13, [
              _cache[7] || (_cache[7] = createElementVNode("span", { class: "label" }, "会话模式:", -1)),
              createElementVNode("span", {
                class: normalizeClass(["session-badge", `mode-${__props.entry.session.mode}`])
              }, toDisplayString(sessionModeLabel(__props.entry.session)), 3),
              __props.entry.session.rebuilt ? (openBlock(), createElementBlock("span", _hoisted_14, " ↻ 重建" + toDisplayString(__props.entry.session.rebuildReason ? `: ${__props.entry.session.rebuildReason}` : ""), 1)) : createCommentVNode("", true),
              __props.entry.session.degraded ? (openBlock(), createElementBlock("span", _hoisted_15, " ⚠ 降级" + toDisplayString(__props.entry.session.degradeReason ? `: ${__props.entry.session.degradeReason}` : ""), 1)) : createCommentVNode("", true)
            ])) : createCommentVNode("", true),
            __props.entry.session?.contextUsed != null ? (openBlock(), createElementBlock("div", _hoisted_16, [
              _cache[8] || (_cache[8] = createElementVNode("span", { class: "label" }, "上下文占用:", -1)),
              createTextVNode(" " + toDisplayString(unref(formatCompactTokens)(__props.entry.session.contextUsed)) + " ", 1),
              __props.entry.session.contextSize ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                createTextVNode(" / " + toDisplayString(unref(formatCompactTokens)(__props.entry.session.contextSize)), 1)
              ], 64)) : createCommentVNode("", true)
            ])) : createCommentVNode("", true)
          ])
        ]),
        createElementVNode("div", _hoisted_17, [
          _cache[15] || (_cache[15] = createElementVNode("div", { class: "detail-card-title" }, "调用元信息", -1)),
          createElementVNode("div", _hoisted_18, [
            createElementVNode("div", _hoisted_19, [
              _cache[10] || (_cache[10] = createElementVNode("span", { class: "label" }, "enabled:", -1)),
              createTextVNode(" " + toDisplayString(__props.entry.meta.enabled), 1)
            ]),
            createElementVNode("div", _hoisted_20, [
              _cache[11] || (_cache[11] = createElementVNode("span", { class: "label" }, "configured:", -1)),
              createTextVNode(" " + toDisplayString(__props.entry.meta.configured), 1)
            ]),
            createElementVNode("div", _hoisted_21, [
              _cache[12] || (_cache[12] = createElementVNode("span", { class: "label" }, "backend:", -1)),
              createTextVNode(" " + toDisplayString(__props.entry.meta.providerLabel || __props.entry.meta.backend || "openai"), 1)
            ]),
            createElementVNode("div", _hoisted_22, [
              _cache[13] || (_cache[13] = createElementVNode("span", { class: "label" }, "model:", -1)),
              createTextVNode(" " + toDisplayString(__props.entry.meta.model || "(未设置)"), 1)
            ]),
            __props.entry.session?.sessionKey ? (openBlock(), createElementBlock("div", _hoisted_23, [
              _cache[14] || (_cache[14] = createElementVNode("span", { class: "label" }, "sessionKey:", -1)),
              createTextVNode(" " + toDisplayString(__props.entry.session.sessionKey), 1)
            ])) : createCommentVNode("", true)
          ])
        ]),
        __props.loading && !__props.entry.request ? (openBlock(), createElementBlock("div", _hoisted_24, [..._cache[16] || (_cache[16] = [
          createElementVNode("div", { class: "detail-card-title" }, "请求 Prompt", -1),
          createElementVNode("div", { class: "detail-card-body" }, "正在加载完整请求上下文…", -1)
        ])])) : createCommentVNode("", true),
        __props.entry.request ? (openBlock(), createElementBlock("div", _hoisted_25, [
          _cache[17] || (_cache[17] = createElementVNode("div", { class: "detail-card-title" }, "请求 Prompt", -1)),
          createElementVNode("div", _hoisted_26, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(__props.entry.request.messages, (msg, i) => {
              return openBlock(), createBlock(LLMLogContent, {
                key: `${__props.entry.id}-message-${i}`,
                value: isPromptMessage(msg) ? msg.content : msg,
                mode: isPromptMessage(msg) ? "auto" : "json",
                "default-expanded": msg.role !== "system",
                label: msg.role
              }, null, 8, ["value", "mode", "default-expanded", "label"]);
            }), 128)),
            __props.entry.request.tools?.length ? (openBlock(), createElementBlock("div", _hoisted_27, "tools (" + toDisplayString(__props.entry.request.tools.length) + ")", 1)) : createCommentVNode("", true),
            (openBlock(true), createElementBlock(Fragment, null, renderList(__props.entry.request.tools, (tool, i) => {
              return openBlock(), createBlock(LLMLogContent, {
                key: `${__props.entry.id}-tool-${i}`,
                value: tool,
                mode: "json",
                "default-expanded": false,
                label: `tool: ${tool.function?.name || i + 1}`
              }, null, 8, ["value", "label"]);
            }), 128))
          ])
        ])) : createCommentVNode("", true),
        __props.entry.status === "success" && __props.entry.response ? (openBlock(), createElementBlock("div", _hoisted_28, [
          _cache[18] || (_cache[18] = createElementVNode("div", { class: "detail-card-title" }, "响应结果", -1)),
          createElementVNode("div", _hoisted_29, [
            __props.entry.response.toolCall?.reasoningContent ? (openBlock(), createBlock(LLMLogContent, {
              key: `${__props.entry.id}-reasoning-content`,
              value: __props.entry.response.toolCall.reasoningContent,
              mode: "auto",
              "default-expanded": true,
              label: "reasoning_content"
            }, null, 8, ["value"])) : createCommentVNode("", true),
            __props.entry.response.toolCall ? (openBlock(), createBlock(LLMLogContent, {
              key: `${__props.entry.id}-tool-call`,
              value: unref(stripToolCallReasoning)(__props.entry.response.toolCall),
              mode: "json",
              "default-expanded": true,
              label: "tool_call"
            }, null, 8, ["value"])) : createCommentVNode("", true),
            __props.entry.response.translatedResult != null ? (openBlock(), createBlock(LLMLogContent, {
              key: `${__props.entry.id}-translated-result`,
              value: __props.entry.response.translatedResult,
              mode: "auto",
              "default-expanded": true,
              label: "translatedResult"
            }, null, 8, ["value"])) : createCommentVNode("", true)
          ])
        ])) : createCommentVNode("", true),
        __props.entry.requestTimings?.length ? (openBlock(), createElementBlock("div", _hoisted_30, [
          _cache[20] || (_cache[20] = createElementVNode("div", { class: "detail-card-title" }, "请求尝试", -1)),
          createElementVNode("div", _hoisted_31, [
            createElementVNode("table", _hoisted_32, [
              _cache[19] || (_cache[19] = createElementVNode("thead", null, [
                createElementVNode("tr", null, [
                  createElementVNode("th", null, "轮"),
                  createElementVNode("th", null, "尝试"),
                  createElementVNode("th", null, "传输"),
                  createElementVNode("th", null, "首 Chunk"),
                  createElementVNode("th", null, "首 Token"),
                  createElementVNode("th", null, "完整响应"),
                  createElementVNode("th", null, "结果")
                ])
              ], -1)),
              createElementVNode("tbody", null, [
                (openBlock(true), createElementBlock(Fragment, null, renderList(__props.entry.requestTimings, (timing) => {
                  return openBlock(), createElementBlock("tr", {
                    key: `${timing.turnIndex}-${timing.attemptIndex}`
                  }, [
                    createElementVNode("td", null, toDisplayString(timing.turnIndex + 1), 1),
                    createElementVNode("td", null, toDisplayString(timing.attemptIndex + 1), 1),
                    createElementVNode("td", null, toDisplayString(timing.transport), 1),
                    createElementVNode("td", null, toDisplayString(unref(formatMs)(timing.firstChunkMs)), 1),
                    createElementVNode("td", null, toDisplayString(unref(formatMs)(timing.ttftMs)), 1),
                    createElementVNode("td", null, toDisplayString(unref(formatMs)(timing.responseMs)), 1),
                    createElementVNode("td", null, toDisplayString(timing.outcome) + toDisplayString(timing.errorStage ? ` (${timing.errorStage})` : ""), 1)
                  ]);
                }), 128))
              ])
            ])
          ])
        ])) : createCommentVNode("", true),
        __props.entry.turns?.length ? (openBlock(), createElementBlock("div", _hoisted_33, [
          createElementVNode("div", _hoisted_34, "多轮决策（" + toDisplayString(__props.entry.turns.length) + "）", 1),
          createElementVNode("div", _hoisted_35, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(__props.entry.turns, (turn) => {
              return openBlock(), createElementBlock("div", {
                key: turn.index,
                class: "turn-detail-block"
              }, [
                createElementVNode("div", _hoisted_36, [
                  createElementVNode("span", null, "第 " + toDisplayString(turn.index + 1) + " 轮 " + toDisplayString(turn.stage || "初始动作"), 1),
                  turn.thinkingMs ? (openBlock(), createElementBlock("span", _hoisted_37, "思考 " + toDisplayString(unref(formatDurationSec)(turn.thinkingMs)), 1)) : createCommentVNode("", true),
                  turnUsageLabel(turn) ? (openBlock(), createElementBlock("span", _hoisted_38, toDisplayString(turnUsageLabel(turn)), 1)) : createCommentVNode("", true)
                ]),
                turn.thinking || turn.toolCall?.reasoningContent ? (openBlock(), createBlock(LLMLogContent, {
                  key: `${__props.entry.id}-turn-${turn.index}-thinking`,
                  value: turn.thinking || turn.toolCall?.reasoningContent,
                  mode: "auto",
                  "default-expanded": false,
                  label: `思考过程${turn.thinkingMs ? ` (${unref(formatDurationSec)(turn.thinkingMs)})` : ""}`
                }, null, 8, ["value", "label"])) : createCommentVNode("", true),
                createElementVNode("details", null, [
                  _cache[21] || (_cache[21] = createElementVNode("summary", null, "原始 Turn JSON", -1)),
                  createElementVNode("pre", _hoisted_39, toDisplayString(unref(formatJson)(turn)), 1)
                ])
              ]);
            }), 128))
          ])
        ])) : createCommentVNode("", true),
        __props.entry.error ? (openBlock(), createElementBlock("div", _hoisted_40, [
          _cache[25] || (_cache[25] = createElementVNode("div", { class: "detail-card-title" }, "错误详情", -1)),
          createElementVNode("div", _hoisted_41, [
            createElementVNode("div", _hoisted_42, [
              _cache[22] || (_cache[22] = createElementVNode("span", { class: "label" }, "stage:", -1)),
              createTextVNode(" " + toDisplayString(__props.entry.error.stage), 1)
            ]),
            createElementVNode("div", _hoisted_43, [
              _cache[23] || (_cache[23] = createElementVNode("span", { class: "label" }, "message:", -1)),
              createTextVNode(" " + toDisplayString(__props.entry.error.message), 1)
            ]),
            __props.entry.error.httpStatus != null ? (openBlock(), createElementBlock("div", _hoisted_44, [
              _cache[24] || (_cache[24] = createElementVNode("span", { class: "label" }, "httpStatus:", -1)),
              createTextVNode(" " + toDisplayString(__props.entry.error.httpStatus), 1)
            ])) : createCommentVNode("", true)
          ])
        ])) : createCommentVNode("", true),
        unref(statusDetail)(__props.entry.status, __props.entry.fallbackReason) ? (openBlock(), createElementBlock("div", {
          key: 6,
          class: normalizeClass(["detail-card", __props.entry.status === "interrupted" ? "card-interrupted" : "card-fallback"])
        }, [
          createElementVNode("div", _hoisted_45, toDisplayString(__props.entry.status === "interrupted" ? "中断说明" : "回退说明"), 1),
          createElementVNode("div", _hoisted_46, toDisplayString(unref(statusDetail)(__props.entry.status, __props.entry.fallbackReason)), 1)
        ], 2)) : createCommentVNode("", true)
      ]);
    };
  }
});
export {
  _sfc_main as default
};

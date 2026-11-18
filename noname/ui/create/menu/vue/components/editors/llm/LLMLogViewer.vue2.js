import { defineComponent, ref, onMounted, openBlock, createElementBlock, unref, createBlock, Fragment, createElementVNode, renderList, toDisplayString, normalizeClass, createCommentVNode } from "vue";
import { llmLogger } from "../../../../../../../llm/logger.js";
import LLMLogDetailView from "../../../../../llmLog/vue/components/LLMLogDetailView.vue.js";
import { useLogDetailLoader, getLLMLogStatusPresentation, getLLMLogStatusDetail } from "../../../../../llmLog/vue/llmLogStatus.js";
import { formatMs, formatFullTime, formatClockTime } from "../../../../../llmLog/vue/timelineTypes.js";
const _hoisted_1 = { class: "llm-log-viewer" };
const _hoisted_2 = { class: "llm-log-table-wrap" };
const _hoisted_3 = {
  key: 0,
  class: "llm-log-table"
};
const _hoisted_4 = ["onClick"];
const _hoisted_5 = { class: "llm-log-cell-time" };
const _hoisted_6 = {
  key: 1,
  class: "llm-log-empty"
};
const _hoisted_7 = { class: "llm-log-toolbar" };
const _hoisted_8 = { class: "llm-log-title" };
const _hoisted_9 = { class: "llm-log-table-wrap" };
const _hoisted_10 = {
  key: 0,
  class: "llm-log-table"
};
const _hoisted_11 = ["onClick"];
const _hoisted_12 = { class: "llm-log-cell-time" };
const _hoisted_13 = {
  key: 0,
  class: "llm-log-sub"
};
const _hoisted_14 = {
  key: 1,
  class: "llm-log-sub"
};
const _hoisted_15 = {
  key: 2,
  class: "llm-log-sub"
};
const _hoisted_16 = {
  key: 1,
  class: "llm-log-empty"
};
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "LLMLogViewer",
  setup(__props) {
    const selectedSession = ref(null);
    const sessions = ref([]);
    const currentLogs = ref([]);
    const loading = ref(false);
    const { selectedDetail, detailLoading, openDetail, closeDetail } = useLogDetailLoader((id) => llmLogger.getLogDetail(id));
    async function loadSessions() {
      loading.value = true;
      try {
        sessions.value = await llmLogger.getGameSessions();
      } catch {
        sessions.value = [];
      } finally {
        loading.value = false;
      }
    }
    async function openSession(session) {
      loading.value = true;
      try {
        currentLogs.value = await llmLogger.getLogSummariesByGame(session.gameId);
        selectedSession.value = session;
      } catch {
        currentLogs.value = [];
      } finally {
        loading.value = false;
      }
    }
    function backToSessions() {
      closeDetail();
      selectedSession.value = null;
    }
    async function refresh() {
      if (selectedDetail.value) return;
      if (!selectedSession.value) {
        await loadSessions();
      } else {
        await openSession(selectedSession.value);
      }
    }
    async function clearAll() {
      if (!confirm("确定清空所有已完成 LLM 日志？\n进行中的调用不会中断，结束后会重新出现在历史中。")) return;
      await llmLogger.clearLogs();
      closeDetail();
      sessions.value = [];
      currentLogs.value = [];
      selectedSession.value = null;
    }
    function formatFinalTTFT(entry) {
      return formatMs(entry.requestTimings?.find((timing) => timing.outcome === "success" && timing.ttftMs !== void 0)?.ttftMs);
    }
    const statusPresentation = getLLMLogStatusPresentation;
    const statusDetail = getLLMLogStatusDetail;
    onMounted(() => {
      loadSessions();
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        unref(selectedDetail) ? (openBlock(), createBlock(LLMLogDetailView, {
          key: 0,
          entry: unref(selectedDetail),
          loading: unref(detailLoading),
          onBack: unref(closeDetail)
        }, null, 8, ["entry", "loading", "onBack"])) : !selectedSession.value ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
          createElementVNode("div", { class: "llm-log-toolbar" }, [
            _cache[0] || (_cache[0] = createElementVNode("span", { class: "llm-log-title" }, "LLM 日志（按局）", -1)),
            createElementVNode("button", {
              class: "llm-log-btn",
              onClick: refresh
            }, "刷新"),
            createElementVNode("button", {
              class: "llm-log-btn",
              onClick: clearAll
            }, "清空")
          ]),
          createElementVNode("div", _hoisted_2, [
            sessions.value.length > 0 ? (openBlock(), createElementBlock("table", _hoisted_3, [
              _cache[1] || (_cache[1] = createElementVNode("thead", null, [
                createElementVNode("tr", null, [
                  createElementVNode("th", null, "创建时间"),
                  createElementVNode("th", null, "日志数"),
                  createElementVNode("th", null, "成功/总数"),
                  createElementVNode("th", null, "最近玩家")
                ])
              ], -1)),
              createElementVNode("tbody", null, [
                (openBlock(true), createElementBlock(Fragment, null, renderList(sessions.value, (s) => {
                  return openBlock(), createElementBlock("tr", {
                    key: s.gameId,
                    class: "llm-log-row",
                    onClick: ($event) => openSession(s)
                  }, [
                    createElementVNode("td", _hoisted_5, toDisplayString(unref(formatFullTime)(s.createdAt, true)), 1),
                    createElementVNode("td", null, toDisplayString(s.logCount), 1),
                    createElementVNode("td", null, [
                      createElementVNode("span", {
                        class: normalizeClass(s.successCount > 0 ? "llm-log-status-success" : "llm-log-status-skip")
                      }, toDisplayString(s.successCount) + "/" + toDisplayString(s.logCount), 3)
                    ]),
                    createElementVNode("td", null, toDisplayString(s.lastPlayerName), 1)
                  ], 8, _hoisted_4);
                }), 128))
              ])
            ])) : (openBlock(), createElementBlock("div", _hoisted_6, toDisplayString(loading.value ? "正在加载…" : "暂无对局记录"), 1))
          ])
        ], 64)) : (openBlock(), createElementBlock(Fragment, { key: 2 }, [
          createElementVNode("div", _hoisted_7, [
            createElementVNode("button", {
              class: "llm-log-btn",
              onClick: backToSessions
            }, "‹ 返回局列表"),
            createElementVNode("span", _hoisted_8, toDisplayString(unref(formatFullTime)(selectedSession.value.createdAt, true)), 1),
            createElementVNode("button", {
              class: "llm-log-btn",
              onClick: refresh
            }, "刷新")
          ]),
          createElementVNode("div", _hoisted_9, [
            currentLogs.value.length > 0 ? (openBlock(), createElementBlock("table", _hoisted_10, [
              _cache[2] || (_cache[2] = createElementVNode("thead", null, [
                createElementVNode("tr", null, [
                  createElementVNode("th", null, "时间"),
                  createElementVNode("th", null, "决策点"),
                  createElementVNode("th", null, "玩家"),
                  createElementVNode("th", null, "耗时"),
                  createElementVNode("th", null, "首 Token"),
                  createElementVNode("th", null, "状态")
                ])
              ], -1)),
              createElementVNode("tbody", null, [
                (openBlock(true), createElementBlock(Fragment, null, renderList(currentLogs.value, (entry) => {
                  return openBlock(), createElementBlock("tr", {
                    key: entry.id,
                    class: "llm-log-row",
                    onClick: ($event) => unref(openDetail)(entry)
                  }, [
                    createElementVNode("td", _hoisted_12, toDisplayString(unref(formatClockTime)(entry.timestamp, true)), 1),
                    createElementVNode("td", null, toDisplayString(entry.decisionPoint), 1),
                    createElementVNode("td", null, toDisplayString(entry.playerName), 1),
                    createElementVNode("td", null, toDisplayString(entry.durationMs) + "ms", 1),
                    createElementVNode("td", null, toDisplayString(formatFinalTTFT(entry)), 1),
                    createElementVNode("td", null, [
                      createElementVNode("span", {
                        class: normalizeClass(["llm-log-status", unref(statusPresentation)(entry.status).className])
                      }, toDisplayString(unref(statusPresentation)(entry.status).icon) + " " + toDisplayString(unref(statusPresentation)(entry.status).text), 3),
                      entry.status === "fallback" && entry.fallbackReason ? (openBlock(), createElementBlock("div", _hoisted_13, " ↳ " + toDisplayString(entry.fallbackReason), 1)) : createCommentVNode("", true),
                      entry.status === "interrupted" ? (openBlock(), createElementBlock("div", _hoisted_14, " ↳ " + toDisplayString(unref(statusDetail)(entry.status, entry.fallbackReason)), 1)) : createCommentVNode("", true),
                      entry.status === "timeout" || entry.status === "error" ? (openBlock(), createElementBlock("div", _hoisted_15, " ↳ 回退本地 AI ")) : createCommentVNode("", true)
                    ])
                  ], 8, _hoisted_11);
                }), 128))
              ])
            ])) : (openBlock(), createElementBlock("div", _hoisted_16, toDisplayString(loading.value ? "正在加载…" : "本局暂无日志"), 1))
          ])
        ], 64))
      ]);
    };
  }
});
export {
  _sfc_main as default
};

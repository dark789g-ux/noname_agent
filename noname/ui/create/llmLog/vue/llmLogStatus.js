import { ref } from "vue";
const statusPresentations = {
  success: { className: "llm-log-status-success", icon: "✓", text: "成功" },
  fallback: { className: "llm-log-status-fallback", icon: "↩", text: "回退" },
  error: { className: "llm-log-status-error", icon: "✗", text: "错误" },
  timeout: { className: "llm-log-status-timeout", icon: "⏱", text: "超时" },
  interrupted: { className: "llm-log-status-interrupted", icon: "⚠", text: "中断" }
};
const defaultPresentation = {
  className: "llm-log-status-unknown",
  icon: "?",
  text: "未知"
};
function getLLMLogStatusPresentation(status) {
  return statusPresentations[status] || { ...defaultPresentation, text: status || defaultPresentation.text };
}
function getLLMLogStatusDetail(status, fallbackReason) {
  if (status === "interrupted") {
    return "页面已关闭、崩溃，或记录所属页面实例已失活；无法据此判断该对局是否已回退本地 AI。";
  }
  return fallbackReason;
}
function stripToolCallReasoning(toolCall) {
  const { reasoningContent: _reasoningContent, ...rest } = toolCall;
  return rest;
}
async function loadLogDetailEntry(entry, fetchDetail, setLoading, isCurrent, onLoaded) {
  if (entry.detailLoaded === true || entry.request !== void 0) {
    setLoading(false);
    return;
  }
  setLoading(true);
  try {
    const full = await fetchDetail(entry.id);
    if (full && isCurrent()) onLoaded(full);
  } finally {
    if (isCurrent()) setLoading(false);
  }
}
function useLogDetailLoader(fetchDetail) {
  const selectedDetail = ref(null);
  const detailLoading = ref(false);
  let detailGeneration = 0;
  function closeDetail() {
    detailGeneration++;
    detailLoading.value = false;
    selectedDetail.value = null;
  }
  async function openDetail(entry) {
    const generation = ++detailGeneration;
    selectedDetail.value = entry;
    await loadLogDetailEntry(
      entry,
      fetchDetail,
      (value) => {
        detailLoading.value = value;
      },
      () => generation === detailGeneration && selectedDetail.value?.id === entry.id,
      (full) => {
        selectedDetail.value = full;
      }
    );
  }
  return {
    selectedDetail,
    detailLoading,
    openDetail,
    closeDetail
  };
}
export {
  getLLMLogStatusDetail,
  getLLMLogStatusPresentation,
  loadLogDetailEntry,
  stripToolCallReasoning,
  useLogDetailLoader
};

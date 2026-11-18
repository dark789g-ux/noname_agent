import { defineComponent, computed, ref, onMounted, onUnmounted, openBlock, createElementBlock, Fragment, createBlock, createCommentVNode, renderList, withDirectives, createElementVNode, vShow } from "vue";
import optionsMenuData from "../data/optionsMenuData.js";
import { registerOptionsMenuLifecycle } from "../utils/optionsMenuLifecycle.js";
import "./NonameConfig.vue.js";
import "./editors/BanSkillEditor.vue.js";
import "./editors/file-manager/FileManager.vue.js";
import LLMConfigEditor from "./editors/llm/LLMConfigEditor.vue.js";
import { handleImportDataButton, handleImportMusic } from "../data/optionsImportHandlers.js";
import _sfc_main$1 from "./editors/BanSkillEditor.vue2.js";
import _sfc_main$2 from "./NonameConfig.vue2.js";
import _sfc_main$3 from "./editors/file-manager/FileManager.vue2.js";
const _hoisted_1 = { class: "options-right-pane" };
const _hoisted_2 = {
  key: 0,
  class: "config"
};
const _hoisted_3 = {
  key: 1,
  class: "config"
};
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "OptionsRightPane",
  props: {
    ctx: {}
  },
  setup(__props) {
    const props = __props;
    const currentMode = computed(() => props.ctx.item.key);
    const rightPaneConfigs = computed(() => {
      return optionsMenuData.getRightPane(props.ctx);
    });
    const skillBanEditorConfigs = computed(() => {
      if (currentMode.value !== "skill") return [];
      return rightPaneConfigs.value.filter((c) => {
        return c.type === "autoskill" || c.type === "banskill";
      });
    });
    const standardConfigs = computed(() => {
      if (currentMode.value !== "skill") return rightPaneConfigs.value;
      return rightPaneConfigs.value.filter((c) => {
        return c.type !== "autoskill" && c.type !== "banskill";
      });
    });
    const hasImportDataButton = computed(() => {
      return rightPaneConfigs.value.some((c) => c._name === "import_data_button");
    });
    const hasImportMusic = computed(() => {
      return rightPaneConfigs.value.some((c) => c._name === "import_music");
    });
    const showImportData = ref(false);
    const importDataInput = ref();
    const importMusicInput = ref();
    let importDataFile = null;
    function clearImportDataSelection() {
      importDataFile = null;
      if (importDataInput.value) {
        importDataInput.value.value = "";
      }
    }
    function clearImportMusicSelection() {
      importMusicFile = null;
      if (importMusicInput.value) {
        importMusicInput.value.value = "";
      }
    }
    function clearOptionsMenuState() {
      showImportData.value = false;
      clearImportDataSelection();
      clearImportMusicSelection();
    }
    function toggleImportData() {
      if (!hasImportDataButton.value) {
        throw new TypeError("导入设置控件不可用");
      }
      showImportData.value = !showImportData.value;
      if (!showImportData.value) {
        clearImportDataSelection();
      }
    }
    function onImportDataChange(e) {
      const input = e.currentTarget;
      if (!(input instanceof HTMLInputElement)) {
        clearImportDataSelection();
        return;
      }
      importDataFile = input.files?.[0] || null;
    }
    function onImportDataClick() {
      const fileToLoad = importDataFile;
      if (!fileToLoad) return;
      clearImportDataSelection();
      handleImportDataButton(fileToLoad);
    }
    let importMusicFile = null;
    function onImportMusicChange(e) {
      const input = e.currentTarget;
      if (!(input instanceof HTMLInputElement)) {
        clearImportMusicSelection();
        return;
      }
      importMusicFile = input.files?.[0] || null;
    }
    function onImportMusicClick() {
      const fileToLoad = importMusicFile;
      if (!fileToLoad) return;
      clearImportMusicSelection();
      handleImportMusic(fileToLoad);
    }
    let unregisterOptionsMenuLifecycle = null;
    onMounted(() => {
      unregisterOptionsMenuLifecycle = registerOptionsMenuLifecycle(toggleImportData, clearOptionsMenuState);
    });
    onUnmounted(() => {
      if (unregisterOptionsMenuLifecycle) {
        unregisterOptionsMenuLifecycle();
        unregisterOptionsMenuLifecycle = null;
      } else {
        clearOptionsMenuState();
      }
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        currentMode.value !== "create" ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
          currentMode.value === "skill" ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
            skillBanEditorConfigs.value.length ? (openBlock(), createBlock(_sfc_main$1, {
              key: 0,
              "skill-configs": skillBanEditorConfigs.value
            }, null, 8, ["skill-configs"])) : createCommentVNode("", true),
            (openBlock(true), createElementBlock(Fragment, null, renderList(standardConfigs.value, (cfg) => {
              return openBlock(), createBlock(_sfc_main$2, {
                key: cfg.name,
                config: cfg
              }, null, 8, ["config"]);
            }), 128))
          ], 64)) : currentMode.value === "llm" ? (openBlock(), createBlock(LLMConfigEditor, { key: 1 })) : (openBlock(), createElementBlock(Fragment, { key: 2 }, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(rightPaneConfigs.value, (cfg) => {
              return openBlock(), createBlock(_sfc_main$2, {
                key: cfg.name,
                config: cfg
              }, null, 8, ["config"]);
            }), 128)),
            hasImportDataButton.value ? withDirectives((openBlock(), createElementBlock("div", _hoisted_2, [
              createElementVNode("input", {
                ref_key: "importDataInput",
                ref: importDataInput,
                type: "file",
                style: { "width": "153px" },
                onChange: onImportDataChange
              }, null, 544),
              createElementVNode("button", { onClick: onImportDataClick }, "确定")
            ], 512)), [
              [vShow, showImportData.value]
            ]) : createCommentVNode("", true),
            hasImportMusic.value ? (openBlock(), createElementBlock("div", _hoisted_3, [
              createElementVNode("input", {
                ref_key: "importMusicInput",
                ref: importMusicInput,
                type: "file",
                accept: "audio/*",
                style: { "width": "153px" },
                onChange: onImportMusicChange
              }, null, 544),
              createElementVNode("button", { onClick: onImportMusicClick }, "导入音乐")
            ])) : createCommentVNode("", true)
          ], 64))
        ], 64)) : createCommentVNode("", true),
        currentMode.value === "create" ? (openBlock(), createBlock(_sfc_main$3, { key: 1 })) : createCommentVNode("", true)
      ]);
    };
  }
});
export {
  _sfc_main as default
};

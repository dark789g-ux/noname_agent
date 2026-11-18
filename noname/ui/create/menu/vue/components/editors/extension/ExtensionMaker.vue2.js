import { defineComponent, ref, reactive, computed, onMounted, onUnmounted, openBlock, createElementBlock, withDirectives, createElementVNode, normalizeStyle, toDisplayString, createCommentVNode, vShow, vModelText, Fragment, renderList, createTextVNode, unref, normalizeClass, createVNode } from "vue";
import "../../../../../../../../noname.js";
import { menuBridge } from "../../../utils/menuBridge.js";
import "./CardEditor.vue.js";
import "./CharacterEditor.vue.js";
import "./CodeEditor.vue.js";
import { packageAndImportExtension, triggerExtensionExport } from "./extensionPackager.js";
import "./SkillEditor.vue.js";
import { lib } from "../../../../../../../library/index.js";
import { game } from "../../../../../../../game/index.js";
import { get } from "../../../../../../../get/binding.js";
import _sfc_main$1 from "./CharacterEditor.vue2.js";
import _sfc_main$2 from "./CardEditor.vue2.js";
import _sfc_main$3 from "./SkillEditor.vue2.js";
import _sfc_main$4 from "./CodeEditor.vue2.js";
const _hoisted_1 = {
  ref: "makerRoot",
  class: "extension-maker"
};
const _hoisted_2 = { class: "maker-pageboard" };
const _hoisted_3 = { key: 0 };
const _hoisted_4 = ["disabled"];
const _hoisted_5 = { class: "maker-info-line" };
const _hoisted_6 = ["onUpdate:modelValue"];
const _hoisted_7 = {
  key: 0,
  class: "maker-info-item"
};
const _hoisted_8 = { class: "maker-actions" };
const _hoisted_9 = {
  key: 0,
  class: "maker-export-msg",
  style: { "width": "calc(100% - 40px)", "text-align": "left", "margin-bottom": "5px" }
};
const _hoisted_10 = {
  key: 1,
  class: "maker-share-msg",
  style: { "width": "calc(100% - 40px)", "text-align": "left", "margin-bottom": "5px" }
};
const _hoisted_11 = { class: "maker-dashboard" };
const _hoisted_12 = ["onClick"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ExtensionMaker",
  setup(__props, { expose: __expose }) {
    const extName = ref("无名扩展");
    let currentExtensionName;
    let fromCharacter = false;
    const showNameInput = ref(true);
    const showNameLabel = ref(true);
    const nameInputDisabled = ref(false);
    const isNewExtension = ref(true);
    const showDashboard = ref(false);
    const showExtInfo = ref(false);
    const showConfirmBtn = ref(true);
    const exportMsgVisible = ref(false);
    const shareMsgVisible = ref(false);
    const activeDash = ref("");
    const extNameInput = ref(null);
    const infoFields = reactive([
      { key: "author", label: "扩展作者", value: "" },
      { key: "intro", label: "扩展描述", value: "" },
      { key: "version", label: "扩展版本", value: "1.0" },
      { key: "diskURL", label: "网盘地址", value: "" },
      { key: "forumURL", label: "讨论地址", value: "" }
    ]);
    const dashboardItems = [
      { key: "character", short: "将", label: "编辑武将" },
      { key: "card", short: "卡", label: "编辑卡牌" },
      { key: "skill", short: "技", label: "编辑技能" },
      { key: "code", short: "码", label: "编辑代码" }
    ];
    const characterEditorRef = ref(null);
    const cardEditorRef = ref(null);
    const skillEditorRef = ref(null);
    const codeEditorRef = ref(null);
    const isIOS = computed(() => lib.device === "ios");
    const extLineStyle = computed(() => ({
      padding: showExtInfo.value ? "20px 10px 10px 10px" : "10px",
      height: "22px",
      lineHeight: "22px",
      whiteSpace: "nowrap",
      overflow: "visible"
    }));
    const nameInputStyle = computed(
      () => isNewExtension.value ? { width: "80px", textAlign: "center" } : { width: "100px", textAlign: "" }
    );
    function readMetaFields() {
      const getVal = (key) => infoFields.find((f) => f.key === key)?.value ?? "";
      return {
        author: getVal("author"),
        intro: getVal("intro"),
        version: getVal("version"),
        diskURL: getVal("diskURL"),
        forumURL: getVal("forumURL")
      };
    }
    function switchDash(key) {
      fromCharacter = false;
      activeDash.value = key;
    }
    function onCreateSkillFromCharacter() {
      fromCharacter = true;
      activeDash.value = "skill";
    }
    function onBackFromSkill() {
      if (fromCharacter) {
        fromCharacter = false;
        activeDash.value = "character";
        characterEditorRef.value?.updateSkill();
        return;
      }
      activeDash.value = "";
    }
    function onConfirm() {
      isNewExtension.value = false;
      showConfirmBtn.value = false;
      showNameLabel.value = true;
      showNameInput.value = true;
      showExtInfo.value = false;
      showDashboard.value = true;
      nameInputDisabled.value = true;
      activeDash.value = "character";
    }
    function onRename() {
      showConfirmBtn.value = true;
      showNameInput.value = true;
      showNameLabel.value = true;
      showExtInfo.value = true;
      showDashboard.value = false;
      nameInputDisabled.value = false;
    }
    function onReset() {
      if (confirm("当前扩展将被清除，是否确定？")) {
        editExtension();
      }
    }
    function runPackage(exportMode) {
      extName.value = extName.value || "无名扩展";
      packageAndImportExtension({
        extName: extName.value,
        previousExtensionName: currentExtensionName,
        isNewExtension: isNewExtension.value,
        meta: readMetaFields(),
        codeSections: codeEditorRef.value?.content || {},
        characterPack: {
          packData: characterEditorRef.value?.packData || { character: {}, translate: {} },
          imageData: characterEditorRef.value?.imageData || {},
          audioData: characterEditorRef.value?.audioData || {},
          imagePromises: characterEditorRef.value?.imagePromises || []
        },
        cardPack: {
          packData: cardEditorRef.value?.packData || { card: {}, translate: {}, list: [] },
          pileList: cardEditorRef.value?.pileList || [],
          imageData: cardEditorRef.value?.imageData || {},
          imagePromises: cardEditorRef.value?.imagePromises || []
        },
        skillPack: {
          packData: skillEditorRef.value?.packData || { skill: {}, translate: {} },
          audioData: skillEditorRef.value?.audioData || {}
        },
        exportMode,
        onSaved: () => {
          exportMsgVisible.value = true;
        }
      });
    }
    function onSave() {
      fromCharacter = false;
      activeDash.value = "";
      runPackage(false);
    }
    function onExport() {
      const fallbackExport = () => {
        runPackage(true);
        if (lib.config.show_extensionshare) {
          shareMsgVisible.value = true;
        }
      };
      triggerExtensionExport(extName.value, fallbackExport);
    }
    function onShare() {
      game.open("https://tieba.baidu.com/f?ie=utf-8&kw=%E6%97%A0%E5%90%8D%E6%9D%80");
    }
    function editExtension(name) {
      extName.value = name || "无名扩展";
      currentExtensionName = name;
      fromCharacter = false;
      const pack = name ? lib.extensionPack[name] : null;
      infoFields[0].value = pack ? pack.author || "" : get.connectNickname() || "";
      infoFields[1].value = pack ? pack.intro || "" : "";
      infoFields[2].value = pack ? pack.version || "" : "1.0";
      infoFields[3].value = pack ? pack.diskURL || "" : "";
      infoFields[4].value = pack ? pack.forumURL || "" : "";
      nameInputDisabled.value = Boolean(name);
      isNewExtension.value = !name;
      showConfirmBtn.value = !name;
      showNameInput.value = true;
      showNameLabel.value = true;
      showDashboard.value = Boolean(name);
      showExtInfo.value = false;
      exportMsgVisible.value = false;
      shareMsgVisible.value = false;
      activeDash.value = "";
      characterEditorRef.value?.reset(name);
      cardEditorRef.value?.reset(name);
      skillEditorRef.value?.reset(name);
      codeEditorRef.value?.reset(name);
    }
    onMounted(() => {
      menuBridge.openExtensionMaker = editExtension;
      if (menuBridge.pendingEditExtensionName != null) {
        const name = menuBridge.pendingEditExtensionName;
        menuBridge.pendingEditExtensionName = null;
        editExtension(name);
      }
    });
    onUnmounted(() => {
      menuBridge.openExtensionMaker = null;
    });
    __expose({ editExtension });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        withDirectives(createElementVNode("div", _hoisted_2, [
          createElementVNode("div", {
            class: "maker-ext-line",
            style: normalizeStyle(extLineStyle.value)
          }, [
            showNameLabel.value ? (openBlock(), createElementBlock("span", _hoisted_3, "扩展" + toDisplayString(isNewExtension.value ? "名" : "名称") + "：", 1)) : createCommentVNode("", true),
            withDirectives(createElementVNode("input", {
              ref_key: "extNameInput",
              ref: extNameInput,
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => extName.value = $event),
              type: "text",
              disabled: nameInputDisabled.value,
              style: normalizeStyle(nameInputStyle.value)
            }, null, 12, _hoisted_4), [
              [vShow, showNameInput.value],
              [vModelText, extName.value]
            ])
          ], 4),
          withDirectives(createElementVNode("div", _hoisted_5, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(infoFields, (field) => {
              return openBlock(), createElementBlock("div", {
                key: field.key,
                class: "maker-info-item"
              }, [
                createElementVNode("span", null, toDisplayString(field.label) + "：", 1),
                withDirectives(createElementVNode("input", {
                  "onUpdate:modelValue": ($event) => field.value = $event,
                  type: "text",
                  style: { "width": "100px" }
                }, null, 8, _hoisted_6), [
                  [vModelText, field.value]
                ])
              ]);
            }), 128)),
            showConfirmBtn.value ? (openBlock(), createElementBlock("div", _hoisted_7, [
              createElementVNode("button", { onClick: onConfirm }, "确定")
            ])) : createCommentVNode("", true)
          ], 512), [
            [vShow, showExtInfo.value]
          ]),
          createElementVNode("div", _hoisted_8, [
            withDirectives(createElementVNode("button", { onClick: onConfirm }, "确定", 512), [
              [vShow, showConfirmBtn.value]
            ]),
            withDirectives(createElementVNode("button", { onClick: onRename }, "选项", 512), [
              [vShow, !isNewExtension.value]
            ]),
            withDirectives(createElementVNode("button", { onClick: onReset }, "重置", 512), [
              [vShow, !isNewExtension.value]
            ]),
            withDirectives(createElementVNode("button", { onClick: onSave }, "保存", 512), [
              [vShow, !isNewExtension.value]
            ]),
            withDirectives(createElementVNode("button", { onClick: onExport }, "导出", 512), [
              [vShow, !isNewExtension.value]
            ])
          ]),
          exportMsgVisible.value ? (openBlock(), createElementBlock("div", _hoisted_9, [
            isIOS.value ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
              _cache[8] || (_cache[8] = createTextVNode(" 已保存。退出游戏并重新打开后生效 ", -1)),
              createElementVNode("span", {
                class: "closenode",
                onClick: _cache[1] || (_cache[1] = ($event) => exportMsgVisible.value = false)
              }, "×")
            ], 64)) : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
              _cache[9] || (_cache[9] = createTextVNode(" 重启后生效。", -1)),
              createElementVNode("span", {
                class: "hrefnode",
                onClick: _cache[2] || (_cache[2] = //@ts-ignore
                (...args) => unref(game).reload && unref(game).reload(...args))
              }, "立即重启"),
              createElementVNode("span", {
                class: "closenode",
                onClick: _cache[3] || (_cache[3] = ($event) => exportMsgVisible.value = false)
              }, "×")
            ], 64))
          ])) : createCommentVNode("", true),
          shareMsgVisible.value ? (openBlock(), createElementBlock("div", _hoisted_10, [
            _cache[10] || (_cache[10] = createTextVNode(" 已导出扩展。", -1)),
            createElementVNode("span", {
              class: "hrefnode",
              onClick: onShare
            }, "分享扩展"),
            createElementVNode("span", {
              class: "closenode",
              onClick: _cache[4] || (_cache[4] = ($event) => shareMsgVisible.value = false)
            }, "×")
          ])) : createCommentVNode("", true),
          withDirectives(createElementVNode("div", _hoisted_11, [
            (openBlock(), createElementBlock(Fragment, null, renderList(dashboardItems, (dash) => {
              return createElementVNode("div", {
                key: dash.key,
                class: normalizeClass(["menubutton large dashboard", { active: activeDash.value === dash.key }]),
                onClick: ($event) => switchDash(dash.key)
              }, [
                createElementVNode("div", null, toDisplayString(dash.short), 1),
                createElementVNode("div", null, toDisplayString(dash.label), 1)
              ], 10, _hoisted_12);
            }), 64))
          ], 512), [
            [vShow, showDashboard.value]
          ])
        ], 512), [
          [vShow, !activeDash.value]
        ]),
        withDirectives(createElementVNode("div", null, [
          withDirectives(createVNode(_sfc_main$1, {
            ref_key: "characterEditorRef",
            ref: characterEditorRef,
            "ext-name": extName.value,
            "is-new": isNewExtension.value,
            onBack: _cache[5] || (_cache[5] = ($event) => activeDash.value = ""),
            onCreateSkill: onCreateSkillFromCharacter
          }, null, 8, ["ext-name", "is-new"]), [
            [vShow, activeDash.value === "character"]
          ]),
          withDirectives(createVNode(_sfc_main$2, {
            ref_key: "cardEditorRef",
            ref: cardEditorRef,
            "ext-name": extName.value,
            "is-new": isNewExtension.value,
            onBack: _cache[6] || (_cache[6] = ($event) => activeDash.value = "")
          }, null, 8, ["ext-name", "is-new"]), [
            [vShow, activeDash.value === "card"]
          ]),
          withDirectives(createVNode(_sfc_main$3, {
            ref_key: "skillEditorRef",
            ref: skillEditorRef,
            "ext-name": extName.value,
            "is-new": isNewExtension.value,
            onBack: onBackFromSkill
          }, null, 8, ["ext-name", "is-new"]), [
            [vShow, activeDash.value === "skill"]
          ]),
          withDirectives(createVNode(_sfc_main$4, {
            ref_key: "codeEditorRef",
            ref: codeEditorRef,
            "ext-name": extName.value,
            "is-new": isNewExtension.value,
            onBack: _cache[7] || (_cache[7] = ($event) => activeDash.value = "")
          }, null, 8, ["ext-name", "is-new"]), [
            [vShow, activeDash.value === "code"]
          ])
        ], 512), [
          [vShow, showDashboard.value && activeDash.value]
        ])
      ], 512);
    };
  }
});
export {
  _sfc_main as default
};

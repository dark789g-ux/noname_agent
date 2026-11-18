import { defineComponent, ref, reactive, computed, openBlock, createElementBlock, createElementVNode, createTextVNode, Fragment, renderList, toDisplayString, normalizeClass, withDirectives, vModelText, vShow, vModelSelect } from "vue";
import "../../../../../../../../noname.js";
import { getCharactersWithSkillsOptions } from "../shared/entityOptions.js";
import { parseEntityName, hasEntityIdConflict, openValidatedCodeEditor, validateNamedObjectCode, serializeSkillToCode } from "./makerShared.js";
import { lib } from "../../../../../../../library/index.js";
import { get } from "../../../../../../../get/binding.js";
const _hoisted_1 = { class: "menu-buttons new_skill skill-editor" };
const _hoisted_2 = ["onClick"];
const _hoisted_3 = { class: "new_character new_skill" };
const _hoisted_4 = { class: "config" };
const _hoisted_5 = { class: "config" };
const _hoisted_6 = { class: "config" };
const _hoisted_7 = ["value"];
const _hoisted_8 = ["value"];
const DEFAULT_CODE = 'skill={\n    \n}\n\n/*\n示例：\nskill={\n    trigger:{player:"phaseJieshuBegin"},\n    frequent:true,\n    content:function(){\n        player.draw()\n    }\n}\n此例为闭月代码\n导出时本段代码中的换行、缩进以及注释将被清除\n*/';
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "SkillEditor",
  props: {
    extName: {},
    isNew: { type: Boolean }
  },
  emits: ["back"],
  setup(__props, { expose: __expose }) {
    const skillName = ref("");
    const skillDescription = ref("");
    const showForm = ref(false);
    const editDisabled = ref(true);
    const showCitePanel = ref(false);
    const citeSourceSelect = ref("");
    const citeTargetSelect = ref("");
    const editingId = ref(null);
    const skillButtonIds = ref([]);
    let code = DEFAULT_CODE;
    const skillSourceList = [
      ...getCharactersWithSkillsOptions({ ensureFallbackSunce: true }),
      ["others", "其它"]
    ];
    const otherSkillList = [];
    for (const i in lib.skill) {
      if (i !== "global" && !get.is.empty(lib.skill[i]) && !lib.skilllist.includes(i)) {
        otherSkillList.push(i);
      }
    }
    otherSkillList.sort();
    const citeTargetList = ref([]);
    const packData = reactive({
      skill: {},
      translate: {}
    });
    const audioData = {};
    const editButtonText = computed(() => editingId.value ? "编辑技能" : "创建技能");
    const deleteButtonText = computed(() => editingId.value ? "删除" : "取消");
    const formHeaderText = computed(() => editingId.value ? "编辑技能" : "创建技能");
    function updateButton() {
      const parsed = parseEntityName(skillName.value);
      if (!parsed) {
        editDisabled.value = true;
        return;
      }
      editDisabled.value = hasEntityIdConflict(parsed.id, editingId.value, lib.skill, packData.skill);
    }
    function onCiteSourceChange() {
      const val = citeSourceSelect.value;
      const targets = val === "others" ? otherSkillList.map((s) => [s, s]) : (lib.character[val]?.[3] || []).map((s) => [s, lib.translate[s] || s]);
      citeTargetList.value = targets;
      citeTargetSelect.value = targets.length ? targets[0][0] : "";
    }
    if (skillSourceList.length) {
      citeSourceSelect.value = skillSourceList[0][0];
      onCiteSourceChange();
    }
    function onEditCode() {
      openValidatedCodeEditor(
        code,
        (result) => validateNamedObjectCode("skill", result),
        (result) => {
          code = result;
        }
      );
    }
    function onCiteConfirm() {
      showCitePanel.value = false;
      if (!citeTargetSelect.value || !lib.skill[citeTargetSelect.value]) return;
      code = serializeSkillToCode(lib.skill[citeTargetSelect.value]);
      if (lib.translate[`${citeTargetSelect.value}_info`]) {
        skillDescription.value = lib.translate[`${citeTargetSelect.value}_info`];
      }
    }
    function onSkillButtonClick(id) {
      if (editingId.value === id) {
        resetEditor();
        return;
      }
      resetEditor();
      editingId.value = id;
      showForm.value = true;
      const translate = packData.translate[id];
      skillName.value = translate && translate !== id ? `${id}|${translate}` : id;
      skillDescription.value = packData.translate[`${id}_info`] || "";
      code = serializeSkillToCode(packData.skill[id]);
      editDisabled.value = false;
    }
    function onCreateSkill() {
      const parsed = parseEntityName(skillName.value);
      if (!parsed) {
        alert("请填写技能名\n提示：技能名格式为id+|+中文名，其中id必须惟一");
        return;
      }
      const { id, translate } = parsed;
      const oldId = editingId.value;
      if (hasEntityIdConflict(id, oldId, lib.skill, packData.skill)) {
        alert("技能名与现有技能重复，请更改");
        return;
      }
      if (oldId !== null && oldId !== id) {
        delete packData.skill[oldId];
        delete packData.translate[oldId];
        delete packData.translate[`${oldId}_info`];
        const idx = skillButtonIds.value.indexOf(oldId);
        if (idx >= 0) skillButtonIds.value[idx] = id;
      }
      packData.translate[id] = translate;
      packData.translate[`${id}_info`] = skillDescription.value;
      try {
        packData.skill[id] = validateNamedObjectCode("skill", code);
      } catch {
        packData.skill[id] = {};
      }
      if (oldId === null) {
        skillButtonIds.value.unshift(id);
      }
      resetEditor();
    }
    function onDeleteSkill() {
      if (editingId.value) {
        const id = editingId.value;
        const idx = skillButtonIds.value.indexOf(id);
        if (idx >= 0) skillButtonIds.value.splice(idx, 1);
        delete packData.skill[id];
        delete packData.translate[id];
        delete packData.translate[`${id}_info`];
      }
      resetEditor();
    }
    function resetEditor() {
      editingId.value = null;
      skillName.value = "";
      skillDescription.value = "";
      showForm.value = false;
      editDisabled.value = true;
      showCitePanel.value = false;
      code = DEFAULT_CODE;
    }
    function reset(name) {
      resetEditor();
      skillButtonIds.value = [];
      for (const key in audioData) delete audioData[key];
      if (name && lib.extensionPack[name]) {
        const pack = lib.extensionPack[name].skill || { skill: {}, translate: {} };
        packData.skill = get.copy(pack.skill);
        packData.translate = get.copy(pack.translate);
        for (const id in packData.skill) {
          skillButtonIds.value.unshift(id);
        }
      } else {
        packData.skill = {};
        packData.translate = {};
        showForm.value = true;
      }
    }
    __expose({
      packData,
      audioData,
      reset
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", {
          class: "config more margin-bottom",
          onClick: _cache[0] || (_cache[0] = ($event) => _ctx.$emit("back"))
        }, [..._cache[8] || (_cache[8] = [
          createElementVNode("div", { style: { "transform": "none", "margin-right": "3px" } }, "←", -1),
          createTextVNode("返回 ", -1)
        ])]),
        (openBlock(true), createElementBlock(Fragment, null, renderList(skillButtonIds.value, (id) => {
          return openBlock(), createElementBlock("div", {
            key: id,
            class: "menubutton",
            onClick: ($event) => onSkillButtonClick(id)
          }, toDisplayString(packData.translate[id] || id), 9, _hoisted_2);
        }), 128)),
        createElementVNode("div", {
          class: normalizeClass(["config more", { on: showForm.value }]),
          onClick: _cache[1] || (_cache[1] = ($event) => showForm.value = !showForm.value)
        }, [
          createTextVNode(toDisplayString(formHeaderText.value) + " ", 1),
          _cache[9] || (_cache[9] = createElementVNode("div", null, ">", -1))
        ], 2),
        withDirectives(createElementVNode("div", _hoisted_3, [
          createElementVNode("div", _hoisted_4, [
            _cache[10] || (_cache[10] = createTextVNode(" 名称：", -1)),
            withDirectives(createElementVNode("input", {
              "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => skillName.value = $event),
              type: "text",
              style: { "width": "120px" },
              onBlur: updateButton
            }, null, 544), [
              [vModelText, skillName.value]
            ])
          ]),
          createElementVNode("div", _hoisted_5, [
            _cache[11] || (_cache[11] = createTextVNode(" 描述：", -1)),
            withDirectives(createElementVNode("input", {
              "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => skillDescription.value = $event),
              type: "text",
              style: { "width": "120px" }
            }, null, 512), [
              [vModelText, skillDescription.value]
            ])
          ]),
          createElementVNode("div", _hoisted_6, [
            withDirectives(createElementVNode("button", { onClick: onEditCode }, "编辑代码", 512), [
              [vShow, !showCitePanel.value]
            ]),
            withDirectives(createElementVNode("button", {
              onClick: _cache[4] || (_cache[4] = ($event) => showCitePanel.value = true)
            }, "引用代码", 512), [
              [vShow, !showCitePanel.value]
            ]),
            withDirectives(createElementVNode("select", {
              "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => citeSourceSelect.value = $event),
              style: { "max-width": "80px" },
              onChange: onCiteSourceChange
            }, [
              (openBlock(), createElementBlock(Fragment, null, renderList(skillSourceList, (item) => {
                return createElementVNode("option", {
                  key: item[0],
                  value: item[0]
                }, toDisplayString(item[1]), 9, _hoisted_7);
              }), 64))
            ], 544), [
              [vShow, showCitePanel.value],
              [vModelSelect, citeSourceSelect.value]
            ]),
            withDirectives(createElementVNode("select", {
              "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => citeTargetSelect.value = $event),
              style: { "max-width": "60px" }
            }, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(citeTargetList.value, (item) => {
                return openBlock(), createElementBlock("option", {
                  key: item[0],
                  value: item[0]
                }, toDisplayString(item[1]), 9, _hoisted_8);
              }), 128))
            ], 512), [
              [vShow, showCitePanel.value],
              [vModelSelect, citeTargetSelect.value]
            ]),
            withDirectives(createElementVNode("button", { onClick: onCiteConfirm }, "引用", 512), [
              [vShow, showCitePanel.value]
            ]),
            withDirectives(createElementVNode("button", {
              onClick: _cache[7] || (_cache[7] = ($event) => showCitePanel.value = false)
            }, "取消", 512), [
              [vShow, showCitePanel.value]
            ])
          ]),
          createElementVNode("div", {
            class: normalizeClass(["menubutton large new_skill", { disabled: editDisabled.value }]),
            onClick: onCreateSkill
          }, toDisplayString(editButtonText.value), 3),
          createElementVNode("div", {
            class: "menubutton large new_card_delete",
            onClick: onDeleteSkill
          }, toDisplayString(deleteButtonText.value), 1)
        ], 512), [
          [vShow, showForm.value]
        ])
      ]);
    };
  }
});
export {
  _sfc_main as default
};

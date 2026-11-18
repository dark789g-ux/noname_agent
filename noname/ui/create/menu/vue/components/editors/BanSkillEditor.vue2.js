import { defineComponent, ref, computed, onMounted, openBlock, createElementBlock, createElementVNode, normalizeClass, createTextVNode, withDirectives, Fragment, renderList, toDisplayString, vShow, vModelSelect, createCommentVNode } from "vue";
import "../../../../../../../noname.js";
import { getCharactersWithSkillsOptions } from "./shared/entityOptions.js";
import { lib } from "../../../../../../library/index.js";
import { game } from "../../../../../../game/index.js";
import { get } from "../../../../../../get/binding.js";
const _hoisted_1 = {
  class: "banskill-editor-container",
  style: { "padding-bottom": "10px" }
};
const _hoisted_2 = ["onClick"];
const _hoisted_3 = ["onClick"];
const _hoisted_4 = ["onClick"];
const _hoisted_5 = {
  key: 0,
  class: "config indent hidden banskilladd",
  style: { "display": "block" }
};
const _hoisted_6 = ["value"];
const _hoisted_7 = ["value"];
const _hoisted_8 = ["value"];
const _hoisted_9 = ["value"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "BanSkillEditor",
  props: {
    skillConfigs: {}
  },
  setup(__props) {
    const props = __props;
    const autoSkillExpanded = ref(false);
    const banSkillExpanded = ref(false);
    const showAddPanel = ref(false);
    const autoSkillConfigs = computed(() => {
      return props.skillConfigs.filter((c) => c.type === "autoskill");
    });
    const banSkillConfigs = computed(() => {
      return props.skillConfigs.filter((c) => c.type === "banskill");
    });
    const customBanSkills = ref([]);
    onMounted(() => {
      if (lib.config.customforbid) {
        customBanSkills.value = lib.config.customforbid.slice();
      }
    });
    function toggleAutoSkill(_name) {
      let list = lib.config.autoskilllist;
      if (list.includes(_name)) {
        list.remove(_name);
      } else {
        list.add(_name);
      }
      game.saveConfig("autoskilllist", list);
    }
    function isAutoSkillOn(_name) {
      return lib.config.autoskilllist.includes(_name);
    }
    function toggleBanSkill(_name) {
      let list = lib.config.forbidlist;
      if (list.includes(_name)) {
        list.remove(_name);
      } else {
        list.add(_name);
      }
      game.saveConfig("forbidlist", list);
    }
    function isBanSkillOn(_name) {
      return lib.config.forbidlist.includes(_name);
    }
    function deleteCustomBanSkill(idx) {
      let skills = customBanSkills.value[idx];
      for (let i = 0; i < lib.config.customforbid.length; i++) {
        if (matchBanSkill(lib.config.customforbid[i], skills)) {
          lib.config.customforbid.splice(i--, 1);
          break;
        }
      }
      game.saveConfig("customforbid", lib.config.customforbid);
      customBanSkills.value.splice(idx, 1);
    }
    function getCustomBanSkillName(skills) {
      return skills.map((s) => get.translation(s)).join("+");
    }
    function matchBanSkill(skills1, skills2) {
      if (skills1.length != skills2.length) return false;
      for (let i = 0; i < skills1.length; i++) {
        if (!skills2.includes(skills1[i])) return false;
      }
      return true;
    }
    const characterList = ref([]);
    const selectedChar1 = ref("");
    const selectedSkill1 = ref("");
    const selectedChar2 = ref("");
    const selectedSkill2 = ref("");
    const char1Skills = ref([]);
    const char2Skills = ref([]);
    function getSkillsForChar(charKey) {
      let skills = lib.character[charKey]?.[3] || [];
      return skills.map((s) => [s, lib.translate[s] || s]);
    }
    function onChar1Change() {
      char1Skills.value = getSkillsForChar(selectedChar1.value);
      if (char1Skills.value.length) {
        selectedSkill1.value = char1Skills.value[0][0];
      }
    }
    function onChar2Change() {
      char2Skills.value = getSkillsForChar(selectedChar2.value);
      if (char2Skills.value.length) {
        selectedSkill2.value = char2Skills.value[0][0];
      }
    }
    function confirmAddBanSkill() {
      let skills = [selectedSkill1.value, selectedSkill2.value];
      if (skills[0] == skills[1]) {
        skills.shift();
      }
      if (!lib.config.customforbid) return;
      for (let i = 0; i < lib.config.customforbid.length; i++) {
        if (matchBanSkill(lib.config.customforbid[i], skills)) return;
      }
      lib.config.customforbid.push(skills);
      game.saveConfig("customforbid", lib.config.customforbid);
      customBanSkills.value.push(skills);
      showAddPanel.value = false;
    }
    onMounted(() => {
      const list = getCharactersWithSkillsOptions();
      if (!list.length) return;
      characterList.value = list;
      selectedChar1.value = list[0][0];
      selectedChar2.value = list[0][0];
      onChar1Change();
      onChar2Change();
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", {
          class: normalizeClass(["config more", { on: autoSkillExpanded.value }]),
          onClick: _cache[0] || (_cache[0] = ($event) => autoSkillExpanded.value = !autoSkillExpanded.value)
        }, [..._cache[7] || (_cache[7] = [
          createTextVNode(" 自动发动 ", -1),
          createElementVNode("div", null, ">", -1)
        ])], 2),
        withDirectives(createElementVNode("div", null, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(autoSkillConfigs.value, (cfg) => {
            return openBlock(), createElementBlock("div", {
              key: cfg._name,
              class: normalizeClass(["config toggle indent", { on: isAutoSkillOn(cfg._name) }]),
              onClick: ($event) => toggleAutoSkill(cfg._name)
            }, [
              createElementVNode("span", null, toDisplayString(cfg.name), 1)
            ], 10, _hoisted_2);
          }), 128))
        ], 512), [
          [vShow, autoSkillExpanded.value]
        ]),
        createElementVNode("div", {
          class: normalizeClass(["config more", { on: banSkillExpanded.value }]),
          onClick: _cache[1] || (_cache[1] = ($event) => banSkillExpanded.value = !banSkillExpanded.value)
        }, [..._cache[8] || (_cache[8] = [
          createTextVNode(" 双将禁配 ", -1),
          createElementVNode("div", null, ">", -1)
        ])], 2),
        withDirectives(createElementVNode("div", null, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(banSkillConfigs.value, (cfg) => {
            return openBlock(), createElementBlock("div", {
              key: cfg._name,
              class: normalizeClass(["config toggle indent", { on: isBanSkillOn(cfg._name) }]),
              onClick: ($event) => toggleBanSkill(cfg._name)
            }, [
              createElementVNode("span", null, toDisplayString(cfg.name), 1)
            ], 10, _hoisted_3);
          }), 128)),
          (openBlock(true), createElementBlock(Fragment, null, renderList(customBanSkills.value, (item, idx) => {
            return openBlock(), createElementBlock("div", {
              key: "custom-" + idx,
              class: "config indent toggle",
              style: { "display": "block" }
            }, [
              createElementVNode("span", null, toDisplayString(getCustomBanSkillName(item)), 1),
              createElementVNode("span", {
                class: "cardpiledelete",
                onClick: ($event) => deleteCustomBanSkill(idx)
              }, "删除", 8, _hoisted_4)
            ]);
          }), 128)),
          createElementVNode("div", {
            class: "config indent",
            style: { "cursor": "pointer" },
            onClick: _cache[2] || (_cache[2] = ($event) => showAddPanel.value = !showAddPanel.value)
          }, [..._cache[9] || (_cache[9] = [
            createElementVNode("span", { class: "pointerdiv" }, "添加...", -1)
          ])]),
          showAddPanel.value ? (openBlock(), createElementBlock("div", _hoisted_5, [
            withDirectives(createElementVNode("select", {
              "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => selectedChar1.value = $event),
              style: { "max-width": "85px" },
              onChange: onChar1Change
            }, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(characterList.value, (c) => {
                return openBlock(), createElementBlock("option", {
                  key: c[0],
                  value: c[0]
                }, toDisplayString(c[1]), 9, _hoisted_6);
              }), 128))
            ], 544), [
              [vModelSelect, selectedChar1.value]
            ]),
            withDirectives(createElementVNode("select", {
              "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => selectedSkill1.value = $event),
              style: { "max-width": "85px" }
            }, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(char1Skills.value, (s) => {
                return openBlock(), createElementBlock("option", {
                  key: s[0],
                  value: s[0]
                }, toDisplayString(s[1]), 9, _hoisted_7);
              }), 128))
            ], 512), [
              [vModelSelect, selectedSkill1.value]
            ]),
            _cache[10] || (_cache[10] = createElementVNode("span", null, "＋", -1)),
            _cache[11] || (_cache[11] = createElementVNode("br", null, null, -1)),
            withDirectives(createElementVNode("select", {
              "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => selectedChar2.value = $event),
              style: { "max-width": "85px" },
              onChange: onChar2Change
            }, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(characterList.value, (c) => {
                return openBlock(), createElementBlock("option", {
                  key: c[0],
                  value: c[0]
                }, toDisplayString(c[1]), 9, _hoisted_8);
              }), 128))
            ], 544), [
              [vModelSelect, selectedChar2.value]
            ]),
            withDirectives(createElementVNode("select", {
              "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => selectedSkill2.value = $event),
              style: { "max-width": "85px" }
            }, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(char2Skills.value, (s) => {
                return openBlock(), createElementBlock("option", {
                  key: s[0],
                  value: s[0]
                }, toDisplayString(s[1]), 9, _hoisted_9);
              }), 128))
            ], 512), [
              [vModelSelect, selectedSkill2.value]
            ]),
            createElementVNode("button", { onClick: confirmAddBanSkill }, "确定")
          ])) : createCommentVNode("", true)
        ], 512), [
          [vShow, banSkillExpanded.value]
        ])
      ]);
    };
  }
});
export {
  _sfc_main as default
};

import { defineComponent, ref, reactive, computed, onMounted, onUnmounted, openBlock, createElementBlock, createElementVNode, createTextVNode, Fragment, renderList, withDirectives, normalizeStyle, unref, normalizeClass, toDisplayString, vModelText, vModelSelect, vShow, createCommentVNode, vModelCheckbox } from "vue";
import "../../../../../../../../noname.js";
import { getCharactersWithSkillsOptions } from "../shared/entityOptions.js";
import { vCharBg } from "../shared/vCharBg.js";
import { extractCharacterSnapshot, resolveDieAudioBuffer, writeCharacterRecord, parseHpInput } from "./characterModel.js";
import { readImageAsDataUrlAndBuffer, readFileAsArrayBuffer, parseEntityName, hasEntityIdConflict } from "./makerShared.js";
import { lib } from "../../../../../../../library/index.js";
import { get } from "../../../../../../../get/binding.js";
import { game } from "../../../../../../../game/index.js";
const _hoisted_1 = { class: "menu-buttons character-editor" };
const _hoisted_2 = ["onClick"];
const _hoisted_3 = ["innerHTML"];
const _hoisted_4 = { class: "new_character" };
const _hoisted_5 = {
  class: "indent",
  style: { "padding-top": "8px" }
};
const _hoisted_6 = {
  class: "indent",
  style: { "padding-top": "8px" }
};
const _hoisted_7 = {
  class: "indent",
  style: { "padding-top": "8px" }
};
const _hoisted_8 = {
  class: "indent",
  style: { "padding-top": "8px" }
};
const _hoisted_9 = {
  class: "indent",
  style: { "padding-top": "8px" }
};
const _hoisted_10 = ["value"];
const _hoisted_11 = {
  class: "indent",
  style: { "padding-top": "8px" }
};
const _hoisted_12 = {
  class: "add_skill options",
  style: { "padding-top": "8px" }
};
const _hoisted_13 = {
  class: "add_skill",
  style: { "padding-top": "8px" }
};
const _hoisted_14 = ["value"];
const _hoisted_15 = ["value"];
const _hoisted_16 = { class: "skill_list" };
const _hoisted_17 = ["onClick"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "CharacterEditor",
  props: {
    extName: {},
    isNew: { type: Boolean }
  },
  emits: ["back", "create-skill"],
  setup(__props, { expose: __expose }) {
    const charName = ref("");
    const charDes = ref("");
    const charHp = ref("");
    const charSex = ref("male");
    const charGroup = ref("wei");
    const isZhu = ref(false);
    const isBoss = ref(false);
    const isForbidAi = ref(false);
    const isHiddenSkill = ref(false);
    const showForm = ref(false);
    const fakemeInited = ref(false);
    const editDisabled = ref(true);
    const fakemeStyle = reactive({});
    const editingId = ref(null);
    const charButtons = ref([]);
    const addedSkills = ref([]);
    const skillRefreshTick = ref(0);
    let fakemeImage64;
    let fakemeImage;
    const dieAudioInput = ref(null);
    const dieAudioPreview = ref(false);
    let dieAudioFile;
    let dieAudioArrayBuffer;
    let dieAudioBlob;
    let dieAudioUrl;
    const avatarInput = ref(null);
    const skillSourceSelect = ref("current_extension");
    const skillSelect = ref("");
    const skillSourceList = ref([]);
    const skillTargetList = ref([]);
    const packData = reactive({
      character: {},
      translate: {}
    });
    const imageData = {};
    const audioData = {};
    const imagePromises = [];
    const groupList = computed(() => lib.group.map((g) => [g, get.translation(g)]));
    const editButtonText = computed(() => editingId.value ? "编辑武将" : "创建武将");
    const deleteButtonText = computed(() => editingId.value ? "删除" : "取消");
    const formHeaderText = computed(() => editingId.value ? "编辑武将" : "创建武将");
    function buildSkillSourceList() {
      skillSourceList.value = [
        ["current_extension", "此扩展"],
        ...getCharactersWithSkillsOptions({ ensureFallbackSunce: true })
      ];
    }
    function onSkillSourceChange() {
      const val = skillSourceSelect.value;
      const newTargets = [];
      if (val === "current_extension") {
        for (const i in packData.character) {
          newTargets.push([i, packData.translate[i]]);
        }
      } else {
        let skills = (lib.character[val]?.[3] || []).slice();
        for (const skill of skills) {
          const derivation = lib.skill[skill]?.derivation;
          if (derivation) {
            skills = Array.isArray(derivation) ? [...skills, ...derivation] : [...skills, derivation];
          }
        }
        for (const s of skills) {
          if (lib.skill[s] && !lib.skill[s].sub && lib.translate[s]) {
            newTargets.push([s, lib.translate[s]]);
          }
        }
      }
      skillTargetList.value = newTargets;
      if (newTargets.length) skillSelect.value = newTargets[0][0];
    }
    function skillDisplayLabel(skillId) {
      void skillRefreshTick.value;
      return packData.translate[skillId] || lib.translate[skillId] || skillId;
    }
    async function onAvatarChange() {
      const file = avatarInput.value?.files?.[0];
      if (!file) return;
      const { dataUrl, buffer } = await readImageAsDataUrlAndBuffer(file);
      fakemeImage64 = dataUrl;
      fakemeStyle.backgroundImage = `url(${dataUrl})`;
      fakemeInited.value = true;
      fakemeImage = buffer;
      updateButton();
    }
    async function onDieAudioChange() {
      const file = dieAudioInput.value?.files?.[0];
      if (!file) return;
      dieAudioFile = file;
      dieAudioArrayBuffer = await readFileAsArrayBuffer(file);
      dieAudioBlob = new Blob([dieAudioArrayBuffer]);
      if (dieAudioUrl) URL.revokeObjectURL(dieAudioUrl);
      dieAudioUrl = URL.createObjectURL(dieAudioBlob);
      dieAudioPreview.value = true;
    }
    function playDieAudio() {
      if (!dieAudioBlob || !dieAudioUrl) return;
      const audio = new Audio(dieAudioUrl);
      audio.play().catch(() => alert("您使用的客户端不支持预览此音频！"));
    }
    function cancelDieAudio() {
      dieAudioPreview.value = false;
      if (dieAudioUrl) {
        URL.revokeObjectURL(dieAudioUrl);
        dieAudioUrl = void 0;
      }
      dieAudioFile = void 0;
      dieAudioArrayBuffer = void 0;
      dieAudioBlob = void 0;
      if (dieAudioInput.value) dieAudioInput.value.value = "";
    }
    function updateButton() {
      const parsed = parseEntityName(charName.value);
      if (!parsed) {
        editDisabled.value = true;
        return;
      }
      if (hasEntityIdConflict(parsed.id, editingId.value, lib.character, packData.character)) {
        editDisabled.value = true;
        return;
      }
      editDisabled.value = !fakemeImage && !imageData[`${parsed.id}.jpg`];
    }
    async function onCharacterButtonClick(item, event) {
      if (editingId.value === item.id) {
        resetEditor();
        return;
      }
      resetEditor();
      editingId.value = item.id;
      showForm.value = true;
      const targetEl = event.currentTarget;
      fakemeInited.value = true;
      fakemeStyle.backgroundImage = item.customBg ? `url(${item.customBg})` : targetEl?.style.backgroundImage || "";
      const snapshot = extractCharacterSnapshot(item.id, packData.character[item.id], packData.translate[item.id]);
      charName.value = snapshot.charName;
      charDes.value = snapshot.charDes;
      charHp.value = snapshot.charHp;
      charSex.value = snapshot.charSex;
      charGroup.value = snapshot.charGroup;
      isZhu.value = snapshot.isZhu;
      isBoss.value = snapshot.isBoss;
      isForbidAi.value = snapshot.isForbidAi;
      isHiddenSkill.value = snapshot.isHiddenSkill;
      addedSkills.value = snapshot.skills;
      for (const dieAudio of snapshot.dieAudios) {
        const loaded = await resolveDieAudioBuffer(dieAudio, audioData);
        if (loaded) {
          dieAudioFile = { name: loaded.fileName };
          dieAudioArrayBuffer = loaded.buffer;
          dieAudioBlob = new Blob([loaded.buffer]);
          if (dieAudioUrl) URL.revokeObjectURL(dieAudioUrl);
          dieAudioUrl = URL.createObjectURL(dieAudioBlob);
          dieAudioPreview.value = true;
        }
      }
      editDisabled.value = false;
    }
    function onAddSkill() {
      if (addedSkills.value.includes(skillSelect.value)) {
        alert(skillSourceSelect.value === "current_extension" ? "此扩展还未添加技能" : "此武将没有技能可添加");
        return;
      }
      if (!skillSelect.value) return;
      addedSkills.value.push(skillSelect.value);
    }
    function onCreateCharacter() {
      const parsed = parseEntityName(charName.value);
      if (!parsed) {
        alert("请填写武将名\n提示：武将名格式为id+|+中文名，其中id必须惟一");
        return;
      }
      const { id, translate } = parsed;
      const oldId = editingId.value;
      if (hasEntityIdConflict(id, oldId, lib.character, packData.character)) {
        alert("武将名与现有武将重复，请更改");
        return;
      }
      if (oldId !== null && oldId !== id) {
        if (imageData[`${oldId}.jpg`]) {
          imageData[`${id}.jpg`] = imageData[`${oldId}.jpg`];
          delete imageData[`${oldId}.jpg`];
        }
        delete packData.character[oldId];
        delete packData.translate[oldId];
      }
      if (fakemeImage) {
        imageData[`${id}.jpg`] = fakemeImage;
      } else if (!imageData[`${id}.jpg`]) {
        alert("请选择武将头像");
        return;
      }
      let dieAudioTag;
      if (dieAudioFile && dieAudioArrayBuffer) {
        const audioname = id + dieAudioFile.name.slice(dieAudioFile.name.indexOf("."));
        dieAudioTag = `${typeof game.readFile === "function" ? "ext" : "db"}:audio/die/${audioname}`;
        audioData[audioname] = dieAudioArrayBuffer;
      }
      packData.translate[id] = translate;
      writeCharacterRecord(packData.character, {
        id,
        sex: charSex.value,
        group: charGroup.value,
        hp: parseHpInput(charHp.value),
        des: charDes.value,
        isZhu: isZhu.value,
        isBoss: isBoss.value,
        isForbidAi: isForbidAi.value,
        isHiddenSkill: isHiddenSkill.value,
        skills: addedSkills.value,
        dieAudioTag
      });
      if (oldId !== null) {
        const btn = charButtons.value.find((b) => b.id === oldId);
        if (btn) {
          btn.id = id;
          if (fakemeImage64) btn.customBg = fakemeImage64;
        }
      } else {
        charButtons.value.unshift({ id, customBg: fakemeImage64 });
      }
      resetEditor();
    }
    function onDeleteCharacter() {
      if (editingId.value) {
        const id = editingId.value;
        const idx = charButtons.value.findIndex((b) => b.id === id);
        if (idx >= 0) charButtons.value.splice(idx, 1);
        delete packData.character[id];
        delete packData.translate[id];
        delete imageData[`${id}.jpg`];
        for (const key in audioData) {
          if (key.startsWith(`${id}.`)) delete audioData[key];
        }
      }
      resetEditor();
    }
    function resetEditor() {
      editingId.value = null;
      charName.value = "";
      charDes.value = "";
      charHp.value = "";
      charSex.value = "male";
      charGroup.value = "wei";
      isZhu.value = false;
      isBoss.value = false;
      isForbidAi.value = false;
      isHiddenSkill.value = false;
      fakemeInited.value = false;
      fakemeImage64 = void 0;
      fakemeImage = void 0;
      fakemeStyle.backgroundImage = "";
      showForm.value = false;
      editDisabled.value = true;
      cancelDieAudio();
      addedSkills.value = [];
    }
    function reset(name) {
      resetEditor();
      imagePromises.length = 0;
      charButtons.value = [];
      for (const key in imageData) delete imageData[key];
      for (const key in audioData) delete audioData[key];
      if (name && lib.extensionPack[name]) {
        const pack = lib.extensionPack[name].character || { character: {}, translate: {} };
        packData.character = get.copy(pack.character);
        packData.translate = get.copy(pack.translate);
        for (const id in packData.character) {
          charButtons.value.unshift({ id });
          const file = `${id}.jpg`;
          const url = `${lib.assetURL}extension/${name}/${file}`;
          imagePromises.push(
            game.promises.readFile(url).then((result) => {
              imageData[file] = result;
            }).catch((e) => console.error(e))
          );
        }
      } else {
        packData.character = {};
        packData.translate = {};
        showForm.value = true;
      }
    }
    function updateSkill() {
      skillRefreshTick.value++;
    }
    onMounted(() => {
      buildSkillSourceList();
    });
    onUnmounted(() => {
      if (dieAudioUrl) URL.revokeObjectURL(dieAudioUrl);
    });
    __expose({
      packData,
      imageData,
      audioData,
      imagePromises,
      reset,
      updateSkill,
      skillSourceSelect,
      skillTargetList,
      skillSelect
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", {
          class: "config more margin-bottom",
          onClick: _cache[0] || (_cache[0] = ($event) => _ctx.$emit("back"))
        }, [..._cache[14] || (_cache[14] = [
          createElementVNode("div", { style: { "transform": "none", "margin-right": "3px" } }, "←", -1),
          createTextVNode("返回 ", -1)
        ])]),
        (openBlock(true), createElementBlock(Fragment, null, renderList(charButtons.value, (item) => {
          return withDirectives((openBlock(), createElementBlock("div", {
            key: item.id,
            class: "button character noclick",
            style: normalizeStyle(item.customBg ? { backgroundImage: `url(${item.customBg})`, backgroundSize: "cover" } : { backgroundSize: "cover" }),
            onClick: ($event) => onCharacterButtonClick(item, $event)
          }, [
            createElementVNode("div", {
              class: "name",
              style: { "top": "8px" },
              innerHTML: unref(get).verticalStr(packData.translate[item.id] || item.id)
            }, null, 8, _hoisted_3)
          ], 12, _hoisted_2)), [
            [unref(vCharBg), item.customBg ? void 0 : item.id, "character"]
          ]);
        }), 128)),
        createElementVNode("div", {
          class: normalizeClass(["config more", { on: showForm.value }]),
          onClick: _cache[1] || (_cache[1] = ($event) => showForm.value = !showForm.value)
        }, [
          createTextVNode(toDisplayString(formHeaderText.value) + " ", 1),
          _cache[15] || (_cache[15] = createElementVNode("div", null, ">", -1))
        ], 2),
        withDirectives(createElementVNode("div", _hoisted_4, [
          createElementVNode("div", {
            class: normalizeClass(["avatar", { inited: fakemeInited.value }]),
            style: normalizeStyle(fakemeStyle)
          }, [
            createElementVNode("input", {
              ref_key: "avatarInput",
              ref: avatarInput,
              type: "file",
              accept: "image/*",
              class: "fileinput",
              onChange: onAvatarChange
            }, null, 544),
            _cache[16] || (_cache[16] = createElementVNode("div", { class: "select_avatar" }, "选择头像", -1))
          ], 6),
          createElementVNode("div", _hoisted_5, [
            _cache[17] || (_cache[17] = createTextVNode(" 姓名：", -1)),
            withDirectives(createElementVNode("input", {
              "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => charName.value = $event),
              type: "text",
              onBlur: updateButton
            }, null, 544), [
              [vModelText, charName.value]
            ])
          ]),
          createElementVNode("div", _hoisted_6, [
            _cache[18] || (_cache[18] = createTextVNode(" 介绍：", -1)),
            withDirectives(createElementVNode("input", {
              "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => charDes.value = $event),
              type: "text"
            }, null, 512), [
              [vModelText, charDes.value]
            ])
          ]),
          createElementVNode("div", _hoisted_7, [
            _cache[19] || (_cache[19] = createTextVNode(" 体力：", -1)),
            withDirectives(createElementVNode("input", {
              "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => charHp.value = $event),
              type: "text",
              placeholder: "体/限/甲"
            }, null, 512), [
              [vModelText, charHp.value]
            ])
          ]),
          createElementVNode("div", _hoisted_8, [
            _cache[21] || (_cache[21] = createTextVNode(" 性别：", -1)),
            withDirectives(createElementVNode("select", {
              "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => charSex.value = $event)
            }, [..._cache[20] || (_cache[20] = [
              createElementVNode("option", { value: "male" }, "男", -1),
              createElementVNode("option", { value: "female" }, "女", -1),
              createElementVNode("option", { value: "double" }, "双性", -1),
              createElementVNode("option", { value: "none" }, "无", -1)
            ])], 512), [
              [vModelSelect, charSex.value]
            ])
          ]),
          createElementVNode("div", _hoisted_9, [
            _cache[22] || (_cache[22] = createTextVNode(" 势力：", -1)),
            withDirectives(createElementVNode("select", {
              "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => charGroup.value = $event)
            }, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(groupList.value, (g) => {
                return openBlock(), createElementBlock("option", {
                  key: g[0],
                  value: g[0]
                }, toDisplayString(g[1]), 9, _hoisted_10);
              }), 128))
            ], 512), [
              [vModelSelect, charGroup.value]
            ])
          ]),
          createElementVNode("div", _hoisted_11, [
            _cache[23] || (_cache[23] = createElementVNode("label", null, "阵亡配音:", -1)),
            withDirectives(createElementVNode("input", {
              ref_key: "dieAudioInput",
              ref: dieAudioInput,
              type: "file",
              accept: "audio/*",
              style: { "width": "calc(100% - 100px)" },
              onChange: onDieAudioChange
            }, null, 544), [
              [vShow, !dieAudioPreview.value]
            ]),
            dieAudioPreview.value ? (openBlock(), createElementBlock("button", {
              key: 0,
              onClick: playDieAudio
            }, "播放")) : createCommentVNode("", true),
            dieAudioPreview.value ? (openBlock(), createElementBlock("button", {
              key: 1,
              onClick: cancelDieAudio
            }, "取消")) : createCommentVNode("", true)
          ]),
          createElementVNode("div", _hoisted_12, [
            createElementVNode("span", null, [
              _cache[24] || (_cache[24] = createTextVNode("主公", -1)),
              withDirectives(createElementVNode("input", {
                "onUpdate:modelValue": _cache[7] || (_cache[7] = ($event) => isZhu.value = $event),
                type: "checkbox",
                name: "zhu"
              }, null, 512), [
                [vModelCheckbox, isZhu.value]
              ])
            ]),
            createElementVNode("span", null, [
              _cache[25] || (_cache[25] = createTextVNode("BOSS", -1)),
              withDirectives(createElementVNode("input", {
                "onUpdate:modelValue": _cache[8] || (_cache[8] = ($event) => isBoss.value = $event),
                type: "checkbox",
                name: "boss"
              }, null, 512), [
                [vModelCheckbox, isBoss.value]
              ])
            ]),
            createElementVNode("span", null, [
              _cache[26] || (_cache[26] = createTextVNode("仅点将可用", -1)),
              withDirectives(createElementVNode("input", {
                "onUpdate:modelValue": _cache[9] || (_cache[9] = ($event) => isForbidAi.value = $event),
                type: "checkbox",
                name: "forbidai"
              }, null, 512), [
                [vModelCheckbox, isForbidAi.value]
              ])
            ]),
            _cache[28] || (_cache[28] = createElementVNode("br", null, null, -1)),
            createElementVNode("span", null, [
              _cache[27] || (_cache[27] = createTextVNode("隐匿技", -1)),
              withDirectives(createElementVNode("input", {
                "onUpdate:modelValue": _cache[10] || (_cache[10] = ($event) => isHiddenSkill.value = $event),
                type: "checkbox",
                name: "hiddenSkill"
              }, null, 512), [
                [vModelCheckbox, isHiddenSkill.value]
              ])
            ]),
            _cache[29] || (_cache[29] = createElementVNode("br", null, null, -1))
          ]),
          createElementVNode("div", _hoisted_13, [
            _cache[30] || (_cache[30] = createTextVNode(" 添加技能", -1)),
            _cache[31] || (_cache[31] = createElementVNode("br", null, null, -1)),
            withDirectives(createElementVNode("select", {
              "onUpdate:modelValue": _cache[11] || (_cache[11] = ($event) => skillSourceSelect.value = $event),
              style: { "max-width": "85px" },
              onChange: onSkillSourceChange
            }, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(skillSourceList.value, (item) => {
                return openBlock(), createElementBlock("option", {
                  key: item[0],
                  value: item[0]
                }, toDisplayString(item[1]), 9, _hoisted_14);
              }), 128))
            ], 544), [
              [vModelSelect, skillSourceSelect.value]
            ]),
            withDirectives(createElementVNode("select", {
              "onUpdate:modelValue": _cache[12] || (_cache[12] = ($event) => skillSelect.value = $event),
              style: { "max-width": "60px" }
            }, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(skillTargetList.value, (item) => {
                return openBlock(), createElementBlock("option", {
                  key: item[0],
                  value: item[0]
                }, toDisplayString(item[1]), 9, _hoisted_15);
              }), 128))
            ], 512), [
              [vModelSelect, skillSelect.value]
            ]),
            createElementVNode("button", { onClick: onAddSkill }, "添加"),
            createElementVNode("button", {
              onClick: _cache[13] || (_cache[13] = ($event) => _ctx.$emit("create-skill"))
            }, "创建")
          ]),
          createElementVNode("div", _hoisted_16, [
            createElementVNode("div", null, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(addedSkills.value, (skillId, idx) => {
                return openBlock(), createElementBlock("button", {
                  key: `${skillId}-${idx}`,
                  onClick: ($event) => addedSkills.value.splice(idx, 1)
                }, toDisplayString(skillDisplayLabel(skillId)), 9, _hoisted_17);
              }), 128))
            ]),
            _cache[32] || (_cache[32] = createElementVNode("div", null, null, -1))
          ]),
          createElementVNode("div", {
            class: normalizeClass(["menubutton large", { disabled: editDisabled.value }]),
            onClick: onCreateCharacter
          }, toDisplayString(editButtonText.value), 3),
          createElementVNode("div", {
            class: "menubutton large",
            style: { "margin-left": "13px" },
            onClick: onDeleteCharacter
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

import { defineComponent, ref, reactive, computed, watch, openBlock, createElementBlock, createElementVNode, createTextVNode, Fragment, renderList, normalizeStyle, normalizeClass, toDisplayString, withDirectives, vModelText, vShow, unref, vModelSelect } from "vue";
import "../../../../../../../../noname.js";
import { getTranslatedCardOptions, SUIT_OPTIONS } from "../shared/entityOptions.js";
import { readImageAsDataUrlAndBuffer, parseEntityName, hasEntityIdConflict, openValidatedCodeEditor, validateNamedObjectCode } from "./makerShared.js";
import { lib } from "../../../../../../../library/index.js";
import { get } from "../../../../../../../get/binding.js";
import { game } from "../../../../../../../game/index.js";
const _hoisted_1 = { class: "menu-buttons card-editor" };
const _hoisted_2 = ["onClick"];
const _hoisted_3 = { class: "name" };
const _hoisted_4 = {
  class: "new_character",
  style: { "height": "173px" }
};
const _hoisted_5 = {
  class: "indent",
  style: { "padding-top": "8px" }
};
const _hoisted_6 = {
  class: "indent",
  style: { "padding-top": "6px" }
};
const _hoisted_7 = { style: { "position": "relative" } };
const _hoisted_8 = ["value"];
const _hoisted_9 = { style: { "left": "123px", "top": "90px", "position": "absolute" } };
const _hoisted_10 = { class: "edit_pile" };
const _hoisted_11 = { class: "config toggle cardpilecfg cardpilecfgadd" };
const _hoisted_12 = ["value"];
const _hoisted_13 = ["value"];
const _hoisted_14 = ["value"];
const _hoisted_15 = ["onClick"];
const DEFAULT_CODE = 'card={\n    \n}\n\n/*\n示例：\ncard={\n    type:"basic",\n    enable:true,\n    filterTarget:true,\n    content:function(){\n        target.draw()\n    },\n    ai:{\n        order:1,\n        result:{\n            target:1\n        }\n    }\n}\n此例的效果为目标摸一张牌\n导出时本段代码中的换行、缩进以及注释将被清除\n*/';
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "CardEditor",
  props: {
    extName: {},
    isNew: { type: Boolean }
  },
  emits: ["back"],
  setup(__props, { expose: __expose }) {
    const cardName = ref("");
    const cardDescription = ref("");
    const showForm = ref(false);
    const fakemeInited = ref(false);
    const editDisabled = ref(true);
    const isFullskin = ref(true);
    const fakemeStyle = reactive({});
    const cardImageStyle = reactive({});
    const showCitePanel = ref(false);
    const citeSelect = ref("");
    const showPileEditor = ref(false);
    const editingId = ref(null);
    const cardButtons = ref([]);
    let fakemeImage64;
    let fakemeImage;
    let code = DEFAULT_CODE;
    const pileAddName = ref("");
    const pileAddSuit = ref("heart");
    const pileAddNumber = ref(1);
    const pileList = ref([]);
    const cardImageInput = ref(null);
    const cardList = getTranslatedCardOptions();
    if (cardList.length) citeSelect.value = cardList[0][0];
    const packData = reactive({
      card: {},
      translate: {},
      list: []
    });
    const imageData = {};
    const imagePromises = [];
    const editButtonText = computed(() => editingId.value ? "编辑卡牌" : "创建卡牌");
    const deleteButtonText = computed(() => editingId.value ? "删除" : "取消");
    const formHeaderText = computed(() => editingId.value ? "编辑卡牌" : "创建卡牌");
    const cardPackList = computed(
      () => Object.keys(packData.card).map((id) => [id, packData.translate[id] || id])
    );
    watch(
      cardPackList,
      (list) => {
        if (!list.length) {
          pileAddName.value = "";
        } else if (!list.some(([id]) => id === pileAddName.value)) {
          pileAddName.value = list[0][0];
        }
      },
      { immediate: true }
    );
    function cardButtonContainerStyle(item) {
      if (!item.imageUrl || item.fullskin) return void 0;
      return {
        color: "white",
        textShadow: "black 0 0 2px",
        backgroundImage: `url(${item.imageUrl})`,
        backgroundSize: "cover"
      };
    }
    function cardButtonInnerStyle(item) {
      if (!item.imageUrl || !item.fullskin) return void 0;
      return { backgroundImage: `url(${item.imageUrl})` };
    }
    async function onCardImageChange() {
      const file = cardImageInput.value?.files?.[0];
      if (!file) return;
      const isJpg = file.name.includes(".jpg");
      const { dataUrl, buffer } = await readImageAsDataUrlAndBuffer(file);
      fakemeImage64 = dataUrl;
      if (isJpg) {
        fakemeStyle.backgroundImage = `url(${dataUrl})`;
        cardImageStyle.backgroundImage = "";
        isFullskin.value = false;
      } else {
        fakemeStyle.backgroundImage = "";
        cardImageStyle.backgroundImage = `url(${dataUrl})`;
        isFullskin.value = true;
      }
      fakemeInited.value = true;
      fakemeImage = buffer;
      updateButton();
    }
    function updateButton() {
      const parsed = parseEntityName(cardName.value);
      if (!parsed) {
        editDisabled.value = true;
        return;
      }
      if (hasEntityIdConflict(parsed.id, editingId.value, lib.card, packData.card)) {
        editDisabled.value = true;
        return;
      }
      editDisabled.value = !fakemeImage && !fakemeInited.value;
    }
    function onCardButtonClick(item) {
      if (editingId.value === item.id) {
        resetEditor();
        return;
      }
      resetEditor();
      editingId.value = item.id;
      showForm.value = true;
      const translate = packData.translate[item.id];
      cardName.value = translate && translate !== item.id ? `${item.id}|${translate}` : item.id;
      cardDescription.value = packData.translate[`${item.id}_info`] || "";
      isFullskin.value = item.fullskin;
      const bgUrl = item.imageUrl ? `url(${item.imageUrl})` : "";
      if (item.fullskin) {
        cardImageStyle.backgroundImage = bgUrl;
        fakemeStyle.backgroundImage = "";
      } else {
        fakemeStyle.backgroundImage = bgUrl;
        cardImageStyle.backgroundImage = "";
      }
      fakemeInited.value = true;
      code = `card=${get.stringify(packData.card[item.id])}`;
      editDisabled.value = false;
    }
    function onEditCode() {
      openValidatedCodeEditor(
        code,
        (result) => validateNamedObjectCode("card", result),
        (result) => {
          code = result;
        }
      );
    }
    function onCiteConfirm() {
      showCitePanel.value = false;
      if (!citeSelect.value) return;
      code = `card=${get.stringify(lib.card[citeSelect.value])}`;
      if (lib.translate[`${citeSelect.value}_info`]) {
        cardDescription.value = lib.translate[`${citeSelect.value}_info`];
      }
    }
    function prunePile(id) {
      pileList.value = pileList.value.filter((entry) => entry[2] !== id);
    }
    function onCreateCard() {
      const parsed = parseEntityName(cardName.value);
      if (!parsed) {
        alert("请填写卡牌名\n提示：卡牌名格式为id+|+中文名，其中id必须惟一");
        return;
      }
      const { id, translate } = parsed;
      const oldId = editingId.value;
      if (hasEntityIdConflict(id, oldId, lib.card, packData.card)) {
        alert("卡牌名与现有卡牌重复，请更改");
        return;
      }
      if (oldId !== null && oldId !== id) {
        for (const ext of [".png", ".jpg"]) {
          if (imageData[oldId + ext]) {
            imageData[id + ext] = imageData[oldId + ext];
            delete imageData[oldId + ext];
          }
        }
        delete packData.card[oldId];
        delete packData.translate[oldId];
        delete packData.translate[`${oldId}_info`];
        prunePile(oldId);
      }
      if (fakemeImage) {
        if (isFullskin.value) {
          imageData[`${id}.png`] = fakemeImage;
          delete imageData[`${id}.jpg`];
        } else {
          imageData[`${id}.jpg`] = fakemeImage;
          delete imageData[`${id}.png`];
        }
      } else if (!fakemeInited.value) {
        alert("请选择一个卡牌背景");
        return;
      }
      packData.translate[id] = translate;
      packData.translate[`${id}_info`] = cardDescription.value;
      try {
        packData.card[id] = validateNamedObjectCode("card", code);
      } catch {
        packData.card[id] = {};
      }
      if (fakemeInited.value) {
        if (isFullskin.value) {
          packData.card[id].fullskin = true;
          delete packData.card[id].fullimage;
        } else {
          packData.card[id].fullimage = true;
          delete packData.card[id].fullskin;
        }
      }
      if (oldId !== null) {
        const btn = cardButtons.value.find((b) => b.id === oldId);
        if (btn) {
          btn.id = id;
          btn.fullskin = isFullskin.value;
          if (fakemeImage64) btn.imageUrl = fakemeImage64;
        }
      } else {
        cardButtons.value.unshift({ id, fullskin: isFullskin.value, imageUrl: fakemeImage64 });
      }
      resetEditor();
    }
    function onDeleteCard() {
      if (editingId.value) {
        const id = editingId.value;
        const idx = cardButtons.value.findIndex((b) => b.id === id);
        if (idx >= 0) cardButtons.value.splice(idx, 1);
        delete packData.card[id];
        delete packData.translate[id];
        delete packData.translate[`${id}_info`];
        delete imageData[`${id}.png`];
        delete imageData[`${id}.jpg`];
        prunePile(id);
      }
      resetEditor();
    }
    function onAddPile() {
      if (!pileAddName.value) return;
      pileList.value.push([pileAddSuit.value, pileAddNumber.value, pileAddName.value]);
    }
    function resetEditor() {
      editingId.value = null;
      cardName.value = "";
      cardDescription.value = "";
      fakemeInited.value = false;
      isFullskin.value = true;
      fakemeImage64 = void 0;
      fakemeImage = void 0;
      fakemeStyle.backgroundImage = "";
      cardImageStyle.backgroundImage = "";
      showForm.value = false;
      showCitePanel.value = false;
      editDisabled.value = true;
      code = DEFAULT_CODE;
    }
    function reset(name) {
      resetEditor();
      imagePromises.length = 0;
      cardButtons.value = [];
      pileList.value = [];
      showPileEditor.value = false;
      for (const key in imageData) delete imageData[key];
      if (name && lib.extensionPack[name]) {
        const pack = lib.extensionPack[name].card || { card: {}, translate: {} };
        packData.card = get.copy(pack.card);
        packData.translate = get.copy(pack.translate);
        if (Array.isArray(pack.list)) {
          packData.list = get.copy(pack.list);
          pileList.value = [...packData.list];
        }
        for (const id in packData.card) {
          const fullskin = Boolean(packData.card[id].fullskin);
          const file = id + (fullskin ? ".png" : ".jpg");
          const url = `${lib.assetURL}extension/${name}/${file}`;
          cardButtons.value.unshift({ id, fullskin, imageUrl: url });
          imagePromises.push(
            game.promises.readFile(url).then((result) => {
              imageData[file] = result;
            }).catch((e) => console.error(e))
          );
        }
      } else {
        packData.card = {};
        packData.translate = {};
        packData.list = [];
        showForm.value = true;
      }
    }
    __expose({
      packData,
      imageData,
      imagePromises,
      pileList,
      reset
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", {
          class: "config more margin-bottom",
          onClick: _cache[0] || (_cache[0] = ($event) => _ctx.$emit("back"))
        }, [..._cache[11] || (_cache[11] = [
          createElementVNode("div", { style: { "transform": "none", "margin-right": "3px" } }, "←", -1),
          createTextVNode("返回 ", -1)
        ])]),
        (openBlock(true), createElementBlock(Fragment, null, renderList(cardButtons.value, (item) => {
          return openBlock(), createElementBlock("div", {
            key: item.id,
            class: normalizeClass(["button card noclick", { fullskin: item.fullskin }]),
            style: normalizeStyle(cardButtonContainerStyle(item)),
            onClick: ($event) => onCardButtonClick(item)
          }, [
            createElementVNode("div", {
              class: "image",
              style: normalizeStyle(cardButtonInnerStyle(item))
            }, null, 4),
            createElementVNode("div", _hoisted_3, toDisplayString(packData.translate[item.id] || item.id), 1)
          ], 14, _hoisted_2);
        }), 128)),
        createElementVNode("div", {
          class: normalizeClass(["config more", { on: showForm.value }]),
          onClick: _cache[1] || (_cache[1] = ($event) => showForm.value = !showForm.value)
        }, [
          createTextVNode(toDisplayString(formHeaderText.value) + " ", 1),
          _cache[12] || (_cache[12] = createElementVNode("div", null, ">", -1))
        ], 2),
        withDirectives(createElementVNode("div", _hoisted_4, [
          createElementVNode("div", {
            class: normalizeClass(["card", { inited: fakemeInited.value, fullskin: isFullskin.value }]),
            style: normalizeStyle(fakemeStyle)
          }, [
            createElementVNode("input", {
              ref_key: "cardImageInput",
              ref: cardImageInput,
              type: "file",
              accept: "image/*",
              class: "fileinput",
              onChange: onCardImageChange
            }, null, 544),
            createElementVNode("div", {
              class: "image",
              style: normalizeStyle(cardImageStyle)
            }, null, 4),
            _cache[13] || (_cache[13] = createElementVNode("div", { class: "name" }, "选择背景", -1))
          ], 6),
          createElementVNode("div", _hoisted_5, [
            _cache[14] || (_cache[14] = createTextVNode(" 名称：", -1)),
            withDirectives(createElementVNode("input", {
              "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => cardName.value = $event),
              type: "text",
              onBlur: updateButton
            }, null, 544), [
              [vModelText, cardName.value]
            ])
          ]),
          createElementVNode("div", _hoisted_6, [
            _cache[15] || (_cache[15] = createTextVNode(" 描述：", -1)),
            withDirectives(createElementVNode("input", {
              "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => cardDescription.value = $event),
              type: "text"
            }, null, 512), [
              [vModelText, cardDescription.value]
            ])
          ]),
          createElementVNode("div", _hoisted_7, [
            withDirectives(createElementVNode("button", {
              style: { "left": "123px", "top": "66px", "position": "absolute" },
              onClick: onEditCode
            }, "编辑代码", 512), [
              [vShow, !showCitePanel.value]
            ]),
            withDirectives(createElementVNode("button", {
              style: { "left": "123px", "top": "90px", "position": "absolute" },
              onClick: _cache[4] || (_cache[4] = ($event) => showCitePanel.value = true)
            }, "引用代码", 512), [
              [vShow, !showCitePanel.value]
            ]),
            withDirectives(createElementVNode("select", {
              "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => citeSelect.value = $event),
              style: { "left": "123px", "top": "66px", "position": "absolute", "max-width": "120px" }
            }, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(unref(cardList), (item) => {
                return openBlock(), createElementBlock("option", {
                  key: item[0],
                  value: item[0]
                }, toDisplayString(item[1]), 9, _hoisted_8);
              }), 128))
            ], 512), [
              [vShow, showCitePanel.value],
              [vModelSelect, citeSelect.value]
            ]),
            withDirectives(createElementVNode("div", _hoisted_9, [
              createElementVNode("button", { onClick: onCiteConfirm }, "引用"),
              createElementVNode("button", {
                style: { "margin-left": "3px" },
                onClick: _cache[6] || (_cache[6] = ($event) => showCitePanel.value = false)
              }, "取消")
            ], 512), [
              [vShow, showCitePanel.value]
            ])
          ]),
          createElementVNode("div", {
            class: normalizeClass(["menubutton large new_card", { disabled: editDisabled.value }]),
            onClick: onCreateCard
          }, toDisplayString(editButtonText.value), 3),
          createElementVNode("div", {
            class: "menubutton large new_card_delete",
            style: { "margin-left": "13px" },
            onClick: onDeleteCard
          }, toDisplayString(deleteButtonText.value), 1)
        ], 512), [
          [vShow, showForm.value]
        ]),
        withDirectives(createElementVNode("div", {
          class: normalizeClass(["config more", { on: showPileEditor.value }]),
          onClick: _cache[7] || (_cache[7] = ($event) => showPileEditor.value = !showPileEditor.value)
        }, [..._cache[16] || (_cache[16] = [
          createTextVNode(" 编辑牌堆 ", -1),
          createElementVNode("div", null, ">", -1)
        ])], 2), [
          [vShow, cardPackList.value.length > 0]
        ]),
        withDirectives(createElementVNode("div", _hoisted_10, [
          createElementVNode("div", _hoisted_11, [
            withDirectives(createElementVNode("select", {
              "onUpdate:modelValue": _cache[8] || (_cache[8] = ($event) => pileAddName.value = $event),
              style: { "width": "75px", "margin-right": "2px", "margin-left": "-1px" }
            }, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(cardPackList.value, (item) => {
                return openBlock(), createElementBlock("option", {
                  key: item[0],
                  value: item[0]
                }, toDisplayString(item[1]), 9, _hoisted_12);
              }), 128))
            ], 512), [
              [vModelSelect, pileAddName.value]
            ]),
            withDirectives(createElementVNode("select", {
              "onUpdate:modelValue": _cache[9] || (_cache[9] = ($event) => pileAddSuit.value = $event),
              style: { "width": "53px", "margin-right": "2px" }
            }, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(unref(SUIT_OPTIONS), (suit) => {
                return openBlock(), createElementBlock("option", {
                  key: suit.value,
                  value: suit.value
                }, toDisplayString(suit.label), 9, _hoisted_13);
              }), 128))
            ], 512), [
              [vModelSelect, pileAddSuit.value]
            ]),
            withDirectives(createElementVNode("select", {
              "onUpdate:modelValue": _cache[10] || (_cache[10] = ($event) => pileAddNumber.value = $event),
              style: { "width": "43px", "margin-right": "2px" }
            }, [
              (openBlock(), createElementBlock(Fragment, null, renderList(13, (n) => {
                return createElementVNode("option", {
                  key: n,
                  value: n
                }, toDisplayString(n), 9, _hoisted_14);
              }), 64))
            ], 512), [
              [vModelSelect, pileAddNumber.value]
            ]),
            createElementVNode("button", {
              style: { "width": "40px" },
              onClick: onAddPile
            }, "确定")
          ]),
          createElementVNode("div", null, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(pileList.value, (card, idx) => {
              return openBlock(), createElementBlock("button", {
                key: `${card[2]}-${card[0]}-${card[1]}-${idx}`,
                onClick: ($event) => pileList.value.splice(idx, 1)
              }, toDisplayString(`${packData.translate[card[2]] || unref(lib).translate[card[2]] || card[2]} ${unref(lib).translate[card[0]] || card[0]}${card[1]}`), 9, _hoisted_15);
            }), 128))
          ])
        ], 512), [
          [vShow, showPileEditor.value && cardPackList.value.length > 0]
        ])
      ]);
    };
  }
});
export {
  _sfc_main as default
};

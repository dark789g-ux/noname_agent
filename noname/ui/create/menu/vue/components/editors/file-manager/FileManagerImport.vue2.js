import { defineComponent, ref, openBlock, createElementBlock, createElementVNode, normalizeClass, createTextVNode, unref, createCommentVNode } from "vue";
import "../../../../../../../../noname.js";
import { parseAssetZipBuffer, writeAssetZipPlan } from "./platformFileOps.js";
import { ui } from "../../../../../../index.js";
import { game } from "../../../../../../../game/index.js";
const _hoisted_1 = { class: "file-import-board" };
const _hoisted_2 = {
  key: 0,
  class: "new_character export import",
  style: { padding: "0px 33px 10px", width: "100%", textAlign: "left" }
};
const _hoisted_3 = {
  key: 0,
  style: { "width": "153px", "font-size": "small", "margin-top": "8px" }
};
const _hoisted_4 = { key: 0 };
const _hoisted_5 = { key: 1 };
const _hoisted_6 = { key: 2 };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "FileManagerImport",
  setup(__props) {
    const expanded = ref(false);
    const status = ref("idle");
    const zipFileInputRef = ref();
    function onZipImportClick() {
      if (status.value !== "idle") return;
      const fileToLoad = zipFileInputRef.value?.files?.[0];
      if (!fileToLoad) return;
      status.value = "reading";
      const fileReader = new FileReader();
      fileReader.onload = (e) => {
        const data = e.target?.result;
        if (!(data instanceof ArrayBuffer)) {
          status.value = "idle";
          return;
        }
        const plan = parseAssetZipBuffer(data);
        if (!plan.filelist.length) {
          alert("没有检测到素材");
          status.value = "idle";
          return;
        }
        if (!confirm(`本次将导入${plan.summaryText}，是否继续？`)) {
          status.value = "idle";
          return;
        }
        status.value = "importing";
        writeAssetZipPlan(plan, () => {
          status.value = "done";
        });
      };
      fileReader.readAsArrayBuffer(fileToLoad);
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", {
          class: normalizeClass(["config more", { on: expanded.value }]),
          style: { padding: "13px 33px 4px", left: "0px" },
          onClick: _cache[0] || (_cache[0] = ($event) => expanded.value = !expanded.value)
        }, [..._cache[4] || (_cache[4] = [
          createTextVNode(" 导入素材包 ", -1),
          createElementVNode("div", null, ">", -1)
        ])], 2),
        expanded.value ? (openBlock(), createElementBlock("div", _hoisted_2, [
          createElementVNode("div", null, [
            createElementVNode("input", {
              ref_key: "zipFileInputRef",
              ref: zipFileInputRef,
              type: "file",
              accept: "application/zip",
              style: { "width": "153px" }
            }, null, 512),
            createElementVNode("button", { onClick: onZipImportClick }, "确定")
          ]),
          status.value !== "idle" ? (openBlock(), createElementBlock("div", _hoisted_3, [
            status.value === "reading" ? (openBlock(), createElementBlock("span", _hoisted_4, "正在解压...")) : status.value === "importing" ? (openBlock(), createElementBlock("span", _hoisted_5, [
              _cache[5] || (_cache[5] = createTextVNode(" 正在导入... ", -1)),
              createElementVNode("span", {
                class: "hrefnode",
                onClick: _cache[1] || (_cache[1] = ($event) => unref(ui).click.consoleMenu())
              }, "详细信息")
            ])) : status.value === "done" ? (openBlock(), createElementBlock("span", _hoisted_6, [
              _cache[6] || (_cache[6] = createTextVNode(" 导入成功。", -1)),
              createElementVNode("span", {
                class: "hrefnode",
                onClick: _cache[2] || (_cache[2] = ($event) => unref(game).reload())
              }, "重新启动"),
              createElementVNode("span", {
                class: "closenode",
                onClick: _cache[3] || (_cache[3] = ($event) => status.value = "idle")
              }, "×")
            ])) : createCommentVNode("", true)
          ])) : createCommentVNode("", true)
        ])) : createCommentVNode("", true)
      ]);
    };
  }
});
export {
  _sfc_main as default
};

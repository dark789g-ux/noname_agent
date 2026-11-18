import { defineComponent, ref, computed, onMounted, openBlock, createElementBlock, createElementVNode, normalizeClass, createTextVNode, withDirectives, vShow, unref, createCommentVNode, Fragment, renderList, toDisplayString, withModifiers, normalizeStyle } from "vue";
import "../../../../../../../../noname.js";
import { importExtensionZipFile, downloadCatalogExtension, resolveExtensionRepoURL, fetchExtensionCatalog } from "./extensionDownloader.js";
import { game } from "../../../../../../../game/index.js";
import { lib } from "../../../../../../../library/index.js";
const _hoisted_1 = { class: "extension-get-page" };
const _hoisted_2 = {
  class: "new_character export import",
  style: { "margin-left": "5px", "margin-top": "5px", "margin-bottom": "5px", "width": "100%", "text-align": "left" }
};
const _hoisted_3 = { class: "extension-list" };
const _hoisted_4 = { class: "caption" };
const _hoisted_5 = ["onClick"];
const _hoisted_6 = { class: "button-progress" };
const _hoisted_7 = { class: "text author" };
const _hoisted_8 = { class: "text" };
const _hoisted_9 = { class: "text" };
const _hoisted_10 = {
  key: 0,
  class: "text"
};
const _hoisted_11 = ["href"];
const _hoisted_12 = ["href"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ExtensionGetter",
  setup(__props) {
    const importExpanded = ref(false);
    const importFileInput = ref(null);
    const showReload = ref(false);
    const catalogItems = ref([]);
    let repoUrl = "";
    const hasDownload = computed(() => Boolean(game.download));
    const STATUS_LABELS = {
      download: "下载扩展",
      update: "更新扩展",
      installed: "已安装",
      install_failed: "安装失败",
      download_failed: "下载失败"
    };
    function statusLabel(status) {
      return status === "downloading" ? "正在下载" : STATUS_LABELS[status];
    }
    async function onImportClick() {
      const fileToLoad = importFileInput.value?.files?.[0];
      if (!fileToLoad) return;
      if (await importExtensionZipFile(fileToLoad)) {
        importExpanded.value = false;
      }
    }
    function alertDownloadURL() {
      alert('您可以在"设置→通用→获取扩展地址"中，修改下载扩展时所采用的地址。');
    }
    function onDownloadItem(item) {
      downloadCatalogExtension(item, repoUrl, () => {
        showReload.value = true;
      });
    }
    async function loadCatalog() {
      repoUrl = resolveExtensionRepoURL();
      try {
        catalogItems.value = await fetchExtensionCatalog(repoUrl);
      } catch (reason) {
        console.log(reason);
      }
    }
    onMounted(() => {
      if (!lib.config.menu_loadondemand) {
        void loadCatalog();
      }
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", {
          class: normalizeClass(["config more", { on: importExpanded.value }]),
          onClick: _cache[0] || (_cache[0] = ($event) => importExpanded.value = !importExpanded.value)
        }, [..._cache[2] || (_cache[2] = [
          createTextVNode(" 导入扩展 ", -1),
          createElementVNode("div", null, ">", -1)
        ])], 2),
        withDirectives(createElementVNode("div", _hoisted_2, [
          createElementVNode("div", null, [
            createElementVNode("input", {
              ref_key: "importFileInput",
              ref: importFileInput,
              type: "file",
              accept: "application/zip",
              style: { "width": "153px" }
            }, null, 512),
            createElementVNode("button", { onClick: onImportClick }, "确定")
          ])
        ], 512), [
          [vShow, importExpanded.value]
        ]),
        createElementVNode("div", {
          class: "config",
          onClick: alertDownloadURL
        }, "修改下载地址"),
        showReload.value ? (openBlock(), createElementBlock("div", {
          key: 0,
          class: "config toggle pointerdiv",
          onClick: _cache[1] || (_cache[1] = //@ts-ignore
          (...args) => unref(game).reload && unref(game).reload(...args))
        }, " 重新启动 ")) : createCommentVNode("", true),
        _cache[5] || (_cache[5] = createElementVNode("div", {
          class: "config toggle",
          style: { "height": "0", "margin-top": "5px" }
        }, null, -1)),
        createElementVNode("div", _hoisted_3, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(catalogItems.value, (item) => {
            return openBlock(), createElementBlock("div", {
              key: item.name,
              class: "videonode menubutton extension large"
            }, [
              createElementVNode("div", _hoisted_4, [
                createTextVNode(toDisplayString(item.name) + " ", 1),
                hasDownload.value ? (openBlock(), createElementBlock("div", {
                  key: 0,
                  class: normalizeClass(["menubutton text", {
                    active: item.status === "download",
                    transparent2: item.status === "installed",
                    highlight: item.status === "update",
                    update: item.status === "update",
                    nopointer: item.status !== "download" && item.status !== "update",
                    "button-downloading": item.status === "downloading"
                  }]),
                  style: { "z-index": "5" },
                  onClick: withModifiers(($event) => onDownloadItem(item), ["stop"])
                }, [
                  item.status === "downloading" ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                    _cache[3] || (_cache[3] = createElementVNode("span", null, "正在下载", -1)),
                    _cache[4] || (_cache[4] = createElementVNode("div", null, "正在下载", -1)),
                    createElementVNode("div", _hoisted_6, [
                      createElementVNode("div", {
                        style: normalizeStyle({ width: `${item.progressPercent}%` })
                      }, null, 4)
                    ])
                  ], 64)) : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                    createTextVNode(toDisplayString(statusLabel(item.status)), 1)
                  ], 64))
                ], 10, _hoisted_5)) : createCommentVNode("", true)
              ]),
              createElementVNode("div", _hoisted_7, [
                createTextVNode(" 作者：" + toDisplayString(item.author), 1),
                createElementVNode("span", null, "(" + toDisplayString(item.size) + ")", 1)
              ]),
              createElementVNode("div", _hoisted_8, "更新日期：" + toDisplayString(item.date), 1),
              createElementVNode("div", _hoisted_9, toDisplayString(item.intro), 1),
              !hasDownload.value && (item.diskURL || item.forumURL) ? (openBlock(), createElementBlock("div", _hoisted_10, [
                item.diskURL ? (openBlock(), createElementBlock("a", {
                  key: 0,
                  href: item.diskURL,
                  target: "_blank"
                }, "网盘下载", 8, _hoisted_11)) : createCommentVNode("", true),
                item.diskURL && item.forumURL ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                  createTextVNode("  ")
                ], 64)) : createCommentVNode("", true),
                item.forumURL ? (openBlock(), createElementBlock("a", {
                  key: 2,
                  href: item.forumURL,
                  target: "_blank"
                }, "论坛讨论", 8, _hoisted_12)) : createCommentVNode("", true)
              ])) : createCommentVNode("", true)
            ]);
          }), 128))
        ])
      ]);
    };
  }
});
export {
  _sfc_main as default
};

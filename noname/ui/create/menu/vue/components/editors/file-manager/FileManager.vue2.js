import { defineComponent, ref, nextTick, openBlock, createElementBlock, createVNode, createElementVNode, Fragment, renderList, toDisplayString, createCommentVNode, normalizeClass, unref } from "vue";
import "../../../../../../../../noname.js";
import { setNoclose, openPopup } from "../../../utils/popupHost.js";
import "./FileManagerImport.vue.js";
import { removePlatformDirectory, removePlatformFiles, createPlatformDirectory } from "./platformFileOps.js";
import { ui } from "../../../../../../index.js";
import { lib } from "../../../../../../../library/index.js";
import { game } from "../../../../../../../game/index.js";
import { _status } from "../../../../../../../status/index.js";
import _sfc_main$1 from "./FileManagerImport.vue2.js";
const _hoisted_1 = { id: "create-extension" };
const _hoisted_2 = { class: "file-dashboard" };
const _hoisted_3 = ["onClick"];
const _hoisted_4 = ["onClick"];
const _hoisted_5 = ["onClick"];
const _hoisted_6 = ["onClick"];
const _hoisted_7 = ["src"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "FileManager",
  setup(__props) {
    const activeDash = ref(null);
    const currentPath = ref("");
    const currentFolders = ref([]);
    const currentFiles = ref([]);
    const deleteMode = ref(false);
    const fileListRef = ref();
    const contentRef = ref();
    const isDirectoryView = ref(false);
    const audioPreviews = /* @__PURE__ */ new Map();
    let fileClicked = false;
    const dashboards = [
      {
        abbr: "图",
        label: "图片文件",
        type: "subdir",
        subdirs: [
          { abbr: "将", label: "武将图片", path: "image/character" },
          { abbr: "肤", label: "皮肤图片", path: "image/skin" },
          { abbr: "卡", label: "卡牌图片", path: "image/card" },
          { abbr: "模", label: "模式图片", path: "image/mode" },
          { abbr: "始", label: "开始图片", path: "image/splash" },
          { abbr: "景", label: "背景图片", path: "image/background" }
        ]
      },
      {
        abbr: "音",
        label: "音频文件",
        type: "subdir",
        subdirs: [
          { abbr: "技", label: "技能配音", path: "audio/skill" },
          { abbr: "卡", label: "男性卡牌", path: "audio/card/male" },
          { abbr: "牌", label: "女性卡牌", path: "audio/card/female" },
          { abbr: "亡", label: "阵亡配音", path: "audio/die" },
          { abbr: "效", label: "游戏音效", path: "audio/effect" },
          { abbr: "景", label: "背景音乐", path: "audio/background" }
        ]
      },
      { abbr: "字", label: "字体文件", type: "directory", path: "font" },
      { abbr: "全", label: "全部文件", type: "directory", path: "" }
    ];
    function onDashClick(dash) {
      ui.create.templayer();
      if (dash.type === "subdir") {
        activeDash.value = dash;
        isDirectoryView.value = false;
      } else if (dash.type === "directory") {
        activeDash.value = dash;
        isDirectoryView.value = true;
        enterDirectory(dash.path || "");
      }
      nextTick(() => {
        if (contentRef.value) lib.setScroll(contentRef.value);
      });
    }
    function onBackClick() {
      ui.create.templayer();
      if (isDirectoryView.value && currentPath.value.includes("/")) {
        enterDirectory(currentPath.value.slice(0, currentPath.value.lastIndexOf("/")));
        return;
      }
      activeDash.value = null;
      isDirectoryView.value = false;
    }
    function enterDirectory(path) {
      currentPath.value = path;
      currentFolders.value = [];
      currentFiles.value = [];
      deleteMode.value = false;
      isDirectoryView.value = true;
      nextTick(() => {
        if (fileListRef.value) lib.setScroll(fileListRef.value);
      });
      game.getFileList(path, (folders, files) => {
        folders.sort();
        files.sort();
        const parent = path ? `${path}/` : "";
        currentFolders.value = folders.filter((f) => !(path === "" && f === "app"));
        const filteredFiles = [];
        for (const fileName of files) {
          if (path === "" && (fileName === "app.html" || fileName === "main.js" || fileName === "package.json")) {
            continue;
          }
          filteredFiles.push({
            name: fileName,
            ext: fileName.slice(fileName.lastIndexOf(".") + 1),
            path: parent + fileName,
            selected: false
          });
        }
        currentFiles.value = filteredFiles;
      });
    }
    function onFolderClick(folder) {
      if (_status.dragged) return;
      const target = currentPath.value ? `${currentPath.value}/${folder}` : folder;
      if (deleteMode.value) {
        if (confirm(`确认删除${folder}文件夹？（此操作不可撤销）`)) {
          removePlatformDirectory(target, () => enterDirectory(currentPath.value));
        }
        return;
      }
      enterDirectory(target);
    }
    function onFileClick(file) {
      if (_status.dragged) return;
      if (deleteMode.value) {
        if (confirm(`确认删除${file.name}？（此操作不可撤销）`)) {
          removePlatformFiles(currentPath.value, [file.path], () => enterDirectory(currentPath.value));
        }
        return;
      }
      file.selected = !file.selected;
      fileClicked = true;
      if (file.ext === "mp3" || file.ext === "ogg") {
        if (file.selected) {
          if (!audioPreviews.has(file.path)) {
            const audio = game.playAudio(file.path.slice(6));
            if (audio) audioPreviews.set(file.path, audio);
          }
        } else {
          const audio = audioPreviews.get(file.path);
          if (audio) {
            audio.remove();
            audioPreviews.delete(file.path);
          }
        }
      }
    }
    function onFileListClick() {
      if (fileClicked) {
        fileClicked = false;
        return;
      }
      for (const file of currentFiles.value) {
        file.selected = false;
      }
      for (const audio of audioPreviews.values()) {
        audio.remove();
      }
      audioPreviews.clear();
    }
    function onAddClick(event) {
      const menu = ui.create.div(".menu");
      const addFileItem = ui.create.div("", "添加文件", menu, () => {
        setNoclose();
      });
      const input = document.createElement("input");
      input.className = "fileinput";
      input.type = "file";
      input.onchange = () => {
        const fileToLoad = input.files?.[0];
        if (!fileToLoad) return;
        game.print(fileToLoad.name);
        const fileReader = new FileReader();
        fileReader.onload = (e) => {
          game.writeFile(e.target.result, currentPath.value, fileToLoad.name, () => {
            enterDirectory(currentPath.value);
          });
        };
        fileReader.readAsArrayBuffer(fileToLoad);
      };
      addFileItem.appendChild(input);
      ui.create.div("", "添加目录", menu, () => {
        ui.create.templayer();
        game.prompt("输入目录名称", (str) => {
          if (str) {
            createPlatformDirectory(currentPath.value, str, () => enterDirectory(currentPath.value));
          }
        });
      });
      const pos1 = event.currentTarget.getBoundingClientRect();
      const pos2 = ui.window.getBoundingClientRect();
      openPopup(menu, pos1.left + pos1.width + 5 - pos2.left, pos1.top - pos2.top);
    }
    function onDeleteClick() {
      if (deleteMode.value) {
        deleteMode.value = false;
        return;
      }
      const selected = currentFiles.value.filter((f) => f.selected);
      if (selected.length) {
        if (confirm(`一共要删除${selected.length}个文件，此操作不可撤销，是否确定？`)) {
          removePlatformFiles(
            currentPath.value,
            selected.map((f) => f.path),
            () => enterDirectory(currentPath.value)
          );
        }
      } else {
        deleteMode.value = true;
      }
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createVNode(_sfc_main$1),
        createElementVNode("div", _hoisted_2, [
          (openBlock(), createElementBlock(Fragment, null, renderList(dashboards, (dash) => {
            return createElementVNode("div", {
              key: dash.label,
              class: "menubutton large dashboard",
              onClick: ($event) => onDashClick(dash)
            }, [
              createElementVNode("div", null, toDisplayString(dash.abbr), 1),
              createElementVNode("div", null, toDisplayString(dash.label), 1)
            ], 8, _hoisted_3);
          }), 64))
        ]),
        activeDash.value ? (openBlock(), createElementBlock("div", {
          key: 0,
          ref_key: "contentRef",
          ref: contentRef,
          class: "menu-buttons"
        }, [
          createElementVNode("div", {
            class: "menubutton round",
            style: { zIndex: 1, right: "10px", bottom: "15px" },
            onClick: onBackClick
          }, " 返 "),
          activeDash.value.type === "subdir" ? (openBlock(true), createElementBlock(Fragment, { key: 0 }, renderList(activeDash.value.subdirs, (sd) => {
            return openBlock(), createElementBlock("div", {
              key: sd.path,
              class: "menubutton large dashboard dashboard2",
              onClick: ($event) => enterDirectory(sd.path)
            }, [
              createElementVNode("div", null, toDisplayString(sd.abbr), 1),
              createElementVNode("div", null, toDisplayString(sd.label), 1)
            ], 8, _hoisted_4);
          }), 128)) : createCommentVNode("", true),
          isDirectoryView.value ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
            createElementVNode("div", {
              class: "menubutton round",
              style: { zIndex: 1, right: "10px", bottom: "80px" },
              onClick: onAddClick
            }, " 添 "),
            createElementVNode("div", {
              class: normalizeClass(["menubutton round", { active: deleteMode.value }]),
              style: { zIndex: 1, right: "10px", bottom: "145px" },
              onClick: onDeleteClick
            }, " 删 ", 2),
            createElementVNode("div", {
              ref_key: "fileListRef",
              ref: fileListRef,
              class: "file-container",
              onClick: onFileListClick
            }, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(currentFolders.value, (folder) => {
                return openBlock(), createElementBlock("div", {
                  key: "folder-" + folder,
                  onClick: ($event) => onFolderClick(folder)
                }, [
                  createElementVNode("span", null, toDisplayString(folder), 1)
                ], 8, _hoisted_5);
              }), 128)),
              (openBlock(true), createElementBlock(Fragment, null, renderList(currentFiles.value, (file) => {
                return openBlock(), createElementBlock("div", {
                  key: "file-" + file.name,
                  onClick: ($event) => onFileClick(file)
                }, [
                  createElementVNode("span", {
                    class: normalizeClass({ thundertext: file.selected })
                  }, toDisplayString(file.name), 3),
                  file.selected && (file.ext === "jpg" || file.ext === "png") ? (openBlock(), createElementBlock("img", {
                    key: 0,
                    src: unref(lib).assetURL + file.path,
                    width: "60",
                    style: { "max-height": "120px" }
                  }, null, 8, _hoisted_7)) : createCommentVNode("", true)
                ], 8, _hoisted_6);
              }), 128))
            ], 512)
          ], 64)) : createCommentVNode("", true)
        ], 512)) : createCommentVNode("", true)
      ]);
    };
  }
});
export {
  _sfc_main as default
};

import { defineComponent, ref, onMounted, openBlock, createElementBlock, createElementVNode, Fragment, renderList, withModifiers, normalizeClass, withDirectives, unref, createCommentVNode, toDisplayString, createTextVNode } from "vue";
import "../../../../../../../noname.js";
import { persistVideo } from "../../../../../../storage/videos.js";
import { menuBridge } from "../../utils/menuBridge.js";
import { vCharBg } from "./shared/vCharBg.js";
import { lib } from "../../../../../../library/index.js";
import { game } from "../../../../../../game/index.js";
import { ui } from "../../../../../index.js";
import { _status } from "../../../../../../status/index.js";
const _hoisted_1 = { class: "video-manager" };
const _hoisted_2 = ["onClick"];
const _hoisted_3 = { class: "menubutton videoavatar" };
const _hoisted_4 = {
  key: 0,
  class: "menubutton videoavatar2"
};
const _hoisted_5 = { class: "caption" };
const _hoisted_6 = { class: "text" };
const _hoisted_7 = {
  key: 1,
  class: "victory"
};
const _hoisted_8 = ["onClick"];
const _hoisted_9 = {
  key: 0,
  class: "config import-panel"
};
const _hoisted_10 = {
  key: 1,
  class: "video-float-buttons"
};
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "VideoManager",
  setup(__props) {
    const fileInputRef = ref();
    const showImportPanel = ref(false);
    const videos = ref([]);
    const selectedVideo = ref(null);
    function formatVideoTime(time) {
      const date = new Date(time);
      const mins = date.getMinutes();
      return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()} ${date.getHours()}:${mins < 10 ? "0" : ""}${mins}`;
    }
    function toggleSelectVideo(video) {
      selectedVideo.value = selectedVideo.value === video ? null : video;
    }
    async function toggleStar(video) {
      const starred = !video.starred;
      await persistVideo(lib.db, { ...video, starred });
      video.starred = starred;
    }
    function playVideo() {
      if (!selectedVideo.value) return;
      game.playVideo(selectedVideo.value.time, selectedVideo.value.mode);
    }
    async function deleteVideo() {
      const target = selectedVideo.value;
      if (!target) return;
      await game.deleteDB("video", target.time);
      lib.videos.remove(target);
      const idx = videos.value.indexOf(target);
      if (idx >= 0) videos.value.splice(idx, 1);
      if (selectedVideo.value === target) {
        selectedVideo.value = null;
      }
    }
    function saveVideo() {
      if (!selectedVideo.value) return;
      game.export(
        lib.init.encode(JSON.stringify(selectedVideo.value)),
        `无名杀 - 录像 - ${selectedVideo.value.name[0]} - ${selectedVideo.value.name[1]}`
      );
    }
    function removeFromLists(target) {
      lib.videos.remove(target);
      const idx = videos.value.indexOf(target);
      if (idx >= 0) videos.value.splice(idx, 1);
      if (selectedVideo.value === target) selectedVideo.value = null;
    }
    function insertIntoLists(video, before) {
      removeFromLists(video);
      if (before === true) {
        lib.videos.unshift(video);
        videos.value.unshift(video);
      } else {
        lib.videos.push(video);
        videos.value.push(video);
      }
    }
    function onImportClick() {
      const fileToLoad = fileInputRef.value?.files?.[0];
      if (!fileToLoad) return;
      const fileReader = new FileReader();
      fileReader.onload = async (fileLoadedEvent) => {
        const data = fileLoadedEvent.target?.result;
        if (!data) return;
        let parsed;
        try {
          parsed = JSON.parse(lib.init.decode(data));
        } catch (e) {
          console.log(e);
          alert("导入失败");
          return;
        }
        if (lib.videos.some((video) => video.time === parsed.time)) {
          alert("录像已存在");
          return;
        }
        const nonStarred = lib.videos.filter((video) => !video.starred);
        const removed = [];
        const limit = parseInt(lib.config.video, 10);
        for (let count = 0; count < 5 && nonStarred.length && nonStarred.length >= limit; count++) {
          removed.push(nonStarred.pop());
        }
        await persistVideo(
          lib.db,
          parsed,
          removed.map((video) => video.time)
        );
        for (const video of removed) {
          removeFromLists(video);
        }
        insertIntoLists(parsed, true);
      };
      fileReader.readAsText(fileToLoad, "UTF-8");
    }
    onMounted(async () => {
      if (!lib.db) return;
      const dbVideos = await game.getDB("video");
      const sorted = Object.values(dbVideos || {}).sort((a, b) => Number(b.time) - Number(a.time));
      lib.videos = sorted;
      videos.value = [...sorted];
      ui.create.videoNode = (video, before) => {
        if (_status.over) {
          removeFromLists(video);
          return;
        }
        insertIntoLists(video, before);
      };
      ui.updateVideoMenu = () => menuBridge.setActiveLeftItem?.("其它", "video");
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", null, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(videos.value, (video) => {
            return openBlock(), createElementBlock("div", {
              key: String(video.time),
              class: normalizeClass(["videonode menubutton large", { starred: video.starred, active: selectedVideo.value === video }]),
              onClick: withModifiers(($event) => toggleSelectVideo(video), ["stop"])
            }, [
              withDirectives(createElementVNode("div", _hoisted_3, null, 512), [
                [unref(vCharBg), video.name1, "character"]
              ]),
              video.name2 ? withDirectives((openBlock(), createElementBlock("div", _hoisted_4, null, 512)), [
                [unref(vCharBg), video.name2, "character"]
              ]) : createCommentVNode("", true),
              createElementVNode("div", _hoisted_5, toDisplayString(video.name[0]), 1),
              createElementVNode("div", _hoisted_6, [
                createTextVNode(toDisplayString(formatVideoTime(video.time)), 1),
                _cache[1] || (_cache[1] = createElementVNode("br", null, null, -1)),
                createTextVNode(toDisplayString(video.name[1]), 1)
              ]),
              video.win ? (openBlock(), createElementBlock("div", _hoisted_7, "胜")) : createCommentVNode("", true),
              createElementVNode("div", {
                class: "video_star",
                onClick: withModifiers(($event) => toggleStar(video), ["stop"])
              }, "★", 8, _hoisted_8)
            ], 10, _hoisted_2);
          }), 128))
        ]),
        createElementVNode("div", {
          class: "config switcher pointerspan import-trigger",
          onClick: _cache[0] || (_cache[0] = ($event) => showImportPanel.value = !showImportPanel.value)
        }, [..._cache[2] || (_cache[2] = [
          createElementVNode("span", { class: "underlinenode slim" }, "导入录像...", -1)
        ])]),
        showImportPanel.value ? (openBlock(), createElementBlock("div", _hoisted_9, [
          createElementVNode("input", {
            ref_key: "fileInputRef",
            ref: fileInputRef,
            type: "file",
            accept: "*/*"
          }, null, 512),
          createElementVNode("button", { onClick: onImportClick }, "确定")
        ])) : createCommentVNode("", true),
        selectedVideo.value ? (openBlock(), createElementBlock("div", _hoisted_10, [
          createElementVNode("div", {
            class: "menubutton round highlight",
            style: { "left": "215px", "transition": "opacity 0.3s" },
            onClick: playVideo
          }, "播"),
          createElementVNode("div", {
            class: "menubutton round highlight",
            style: { "left": "275px", "transition": "opacity 0.3s" },
            onClick: saveVideo
          }, "存"),
          createElementVNode("div", {
            class: "menubutton round highlight",
            style: { "left": "335px", "transition": "opacity 0.3s" },
            onClick: deleteVideo
          }, "删")
        ])) : createCommentVNode("", true)
      ]);
    };
  }
});
export {
  _sfc_main as default
};

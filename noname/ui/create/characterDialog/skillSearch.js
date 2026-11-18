import "../../../../noname.js";
import { ui } from "../../index.js";
import { lib } from "../../../library/index.js";
import { get } from "../../../get/binding.js";
const skillSearchCacheMap = /* @__PURE__ */ new WeakMap();
function getSkillSearchCache(createInstance) {
  let cache = skillSearchCacheMap.get(createInstance);
  if (!cache) {
    cache = {
      skillCaching: false,
      skillCacheReady: false,
      skillMaps: /* @__PURE__ */ new Map(),
      skillRegsCache: /* @__PURE__ */ new Map()
    };
    skillSearchCacheMap.set(createInstance, cache);
  }
  return cache;
}
function attachCharacterSkillSearch(createInstance, dialog, updatePagination) {
  const cache = getSkillSearchCache(createInstance);
  const container = dialog.querySelector(".content-container>.content");
  if (!container) {
    return;
  }
  const Searcher = ui.create.div(".searcher.caption");
  const input = document.createElement("input").css({
    textAlign: "center",
    border: "solid 2px #294510",
    borderRadius: "6px",
    fontWeight: "bold",
    fontSize: "21px"
  });
  input.placeholder = "支持正则搜索和技能搜索";
  const find = ui.create.button(["find", "搜索"], "tdnodes");
  find.style.display = "inline";
  if (!cache.skillCacheReady && !cache.skillCaching) {
    cache.skillCaching = true;
    queueMicrotask(() => {
      for (const skill in lib.skill) {
        const translation = lib.translate[skill];
        if (!translation) {
          continue;
        }
        let set = cache.skillMaps.get(translation);
        if (!set) {
          set = /* @__PURE__ */ new Set();
          cache.skillMaps.set(translation, set);
        }
        set.add(skill);
      }
      cache.skillCacheReady = true;
    });
  }
  const updateFind = () => {
    const { value } = input;
    const reg = new RegExp(value);
    let skills;
    if (cache.skillCacheReady) {
      if (cache.skillRegsCache.has(value)) {
        skills = cache.skillRegsCache.get(value);
      } else {
        skills = /* @__PURE__ */ new Set();
        for (const [desc, skillSet] of cache.skillMaps.entries()) {
          if (reg.test(desc)) {
            for (const skill of skillSet) {
              skills.add(skill);
            }
          }
        }
        cache.skillRegsCache.set(value, skills);
      }
    }
    for (const btn of dialog.buttons) {
      const name = btn.link;
      const character = lib.character[name];
      const nameHit = reg.test(get.translation(name)) || reg.test(get.translation(`${name}_ab`));
      const skillHit = Boolean(value in lib.skill && character?.skills.includes(value));
      const skillTransHit = Boolean(skills && skills.size > 0 && character?.skills.some((skill) => skills.has(skill)));
      if (nameHit || skillHit || skillTransHit) {
        btn.classList.remove("nodisplay");
      } else {
        btn.classList.add("nodisplay");
      }
    }
    updatePagination();
  };
  find.addEventListener("click", updateFind);
  input.onkeydown = function(e) {
    e.stopPropagation();
    if (e.key == "Enter") {
      updateFind();
    }
  };
  input.onmousedown = function(e) {
    e.stopPropagation();
  };
  Searcher.append(input, find);
  container.prepend(Searcher);
}
export {
  attachCharacterSkillSearch
};

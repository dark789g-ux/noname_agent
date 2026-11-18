import "../../../../../../noname.js";
import { lib } from "../../../../index.js";
import { get } from "../../../../../get/binding.js";
import { game } from "../../../../../game/index.js";
import { ui } from "../../../../../ui/index.js";
import { _status } from "../../../../../status/index.js";
function createViewInformationOptions() {
  return {
    show_tip: {
      name: "显示tip标记",
      intro: "显示类似手杀的武将标记效果，如：<br><li>蒺藜 5<br><li>放逐 技能失效<br><li>渐营 ♥7",
      init: false,
      unfrequent: true,
      onclick(bool) {
        game.saveConfig("show_tip", bool);
        document.documentElement.style.setProperty("--tip-display", bool ? "flex" : "none");
      }
    },
    show_sortPack: {
      name: "显示武将分包",
      intro: "开启后，长按/右键查看武将信息时将显示武将所在分包",
      init: false,
      unfrequent: true,
      onclick(bool) {
        game.saveConfig("show_sortPack", bool);
      }
    },
    show_deckMonitor: {
      name: "显示记牌器",
      init: true,
      unfrequent: true,
      onclick(bool) {
        if (_status.connectMode) {
        } else {
          game.saveConfig("show_deckMonitor", bool);
          if (lib.config.show_deckMonitor) {
            ui.deckMonitor.style.display = "";
          } else {
            ui.deckMonitor.style.display = "none";
          }
        }
      }
    },
    /*show_deckMonitor_online: {
    			name: "联机显示记牌器",
    			intro: "如果你是房主，此设置对所有人生效",
    			init: false,
    			unfrequent: true,
    			onclick(bool) {
    				if (_status.connectMode) {
    					if (confirm("当前为联机模式，修改此设置须重启，是否重启？")) {
    						game.saveConfig("show_deckMonitor_online", bool);
    						game.reload();
    					} else {
    						this.classList.toggle("on");
    					}
    				} else {
    					game.saveConfig("show_deckMonitor_online", bool);
    				}
    			},
    		},*/
    show_wuxie: {
      name: "显示无懈按钮",
      intro: "在右上角显示不询问无懈",
      init: false,
      unfrequent: true,
      onclick(bool) {
        game.saveConfig("show_wuxie", bool);
        if (lib.config.show_wuxie) {
          ui.wuxie.style.display = "";
        } else {
          ui.wuxie.style.display = "none";
        }
      }
    },
    wuxie_right: {
      name: "无懈按钮靠左",
      init: true,
      unfrequent: true
    },
    show_discardpile: {
      name: "暂停时显示弃牌堆",
      init: false,
      unfrequent: true
    },
    show_extensionmaker: {
      name: "显示制作扩展",
      init: true,
      unfrequent: true
    },
    show_extensionshare: {
      name: "显示分享扩展",
      init: true,
      unfrequent: true
    },
    show_characternamepinyin: {
      name: "显示武将名注解",
      intro: "在武将资料卡显示武将名及其注解、性别、势力、体力等信息",
      init: "showCodeIdentifier",
      unfrequent: true,
      item: {
        doNotShow: "不显示",
        showPinyin: "拼音(样式一)",
        showCodeIdentifier: "代码ID(样式一)",
        showPinyin2: "拼音(样式二)",
        showCodeIdentifier2: "代码ID(样式二)"
      },
      visualMenu: (node, link, name) => {
        node.classList.add("button", "character");
        const style = node.style;
        style.alignItems = "center";
        style.animation = "background-position-left-center-right-center-left-center 15s ease infinite";
        style.background = "linear-gradient(-45deg, #EE7752, #E73C7E, #23A6D5, #23D5AB)";
        style.backgroundSize = "400% 400%";
        style.display = "flex";
        style.height = "60px";
        style.justifyContent = "center";
        style.width = "180px";
        const firstChild = node.firstChild;
        firstChild.removeAttribute("class");
        firstChild.style.position = "initial";
        if (link == "doNotShow") {
          return;
        }
        const ruby = document.createElement("ruby");
        ruby.textContent = name;
        const rt = document.createElement("rt");
        rt.style.fontSize = "smaller";
        if (link == "showPinyin2" || link == "showCodeIdentifier2") {
          rt.textContent = link == "showCodeIdentifier2" ? "[" + link + "]" : "[" + get.pinyin(name) + "]";
          ruby.appendChild(rt);
        } else {
          const leftParenthesisRP = document.createElement("rp");
          leftParenthesisRP.textContent = "（";
          ruby.appendChild(leftParenthesisRP);
          rt.textContent = link == "showCodeIdentifier" ? link : get.pinyin(name).join(" ");
          ruby.appendChild(rt);
          const rightParenthesisRP = document.createElement("rp");
          rightParenthesisRP.textContent = "）";
          ruby.appendChild(rightParenthesisRP);
        }
        firstChild.innerHTML = ruby.outerHTML;
      }
    },
    show_skillnamepinyin: {
      name: "显示技能名注解",
      intro: "在武将资料卡显示技能名注解",
      get init() {
        return lib.configMenu.view.config.show_characternamepinyin.init;
      },
      set init(newVal) {
        lib.configMenu.view.config.show_characternamepinyin.init = newVal;
      },
      get unfrequent() {
        return lib.configMenu.view.config.show_characternamepinyin.unfrequent;
      },
      set unfrequent(newVal) {
        lib.configMenu.view.config.show_characternamepinyin.unfrequent = newVal;
      },
      get item() {
        return lib.configMenu.view.config.show_characternamepinyin.item;
      },
      set item(newVal) {
        lib.configMenu.view.config.show_characternamepinyin.item = newVal;
      },
      get visualMenu() {
        return lib.configMenu.view.config.show_characternamepinyin.visualMenu;
      },
      set visualMenu(newVal) {
        lib.configMenu.view.config.show_characternamepinyin.visualMenu = newVal;
      }
    }
  };
}
export {
  createViewInformationOptions
};

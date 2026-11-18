import "../../../../noname.js";
import { Pagination } from "../../../util/pagination.js";
import { ui } from "../../index.js";
import { get } from "../../../get/binding.js";
import { lib } from "../../../library/index.js";
function applyClassAndId(node, str) {
  for (let i = 0; i < str.length; i++) {
    if (str[i] == ".") {
      if (node.className.length != 0) {
        node.className += " ";
      }
      while (str[i + 1] != "." && str[i + 1] != "#" && i + 1 < str.length) {
        node.className += str[i + 1];
        i++;
      }
    } else if (str[i] == "#") {
      while (str[i + 1] != "." && str[i + 1] != "#" && i + 1 < str.length) {
        node.id += str[i + 1];
        i++;
      }
    }
  }
}
const domElementMethods = {
  div(...args) {
    let str, innerHTML, position, position2, style, divposition, listen;
    for (let i = 0; i < args.length; i++) {
      if (typeof args[i] == "string") {
        if (typeof str == "string") {
          innerHTML = args[i];
        } else {
          str = args[i];
        }
      } else if (["div", "table", "tr", "td", "body", "fragment"].includes(get.objtype(args[i]) ?? "")) {
        position = args[i];
      } else if (typeof args[i] == "number") {
        position2 = args[i];
      } else if (get.itemtype(args[i]) == "divposition") {
        divposition = args[i];
      } else if (typeof args[i] == "object") {
        style = args[i];
      } else if (typeof args[i] == "function") {
        listen = args[i];
      }
    }
    if (str == void 0) {
      str = "";
    }
    const node = document.createElement("div");
    applyClassAndId(node, str);
    if (position) {
      if (typeof position2 == "number" && position.childNodes.length > position2) {
        position.insertBefore(node, position.childNodes[position2]);
      } else {
        position.appendChild(node);
      }
    }
    if (style) {
      node.css(style);
    }
    if (divposition) {
      node.setPosition(divposition);
    }
    if (innerHTML) {
      node.innerHTML = innerHTML;
    }
    if (listen) {
      node.listen(listen);
    }
    return node;
  },
  filediv(...rawArgs) {
    const args = Array.from(rawArgs);
    let func = null;
    for (let i = 0; i < args.length; i++) {
      if (typeof args[i] == "function") {
        func = args[i];
        args.splice(i, 1);
        break;
      }
    }
    const div = ui.create.div.apply(this, args);
    const input = ui.create.node("input.fileinput");
    input.type = "file";
    input.onchange = function(e) {
      const target = e.currentTarget;
      func?.call(target, target.files?.[0], e);
    };
    div.appendChild(input);
    return Object.assign(div, { inputNode: input });
  },
  node(...args) {
    let tagName, str, innerHTML, position, position2, style, divposition, listen;
    for (let i = 0; i < args.length; i++) {
      if (typeof args[i] == "string") {
        if (typeof tagName == "string") {
          innerHTML = args[i];
        } else {
          tagName = args[i];
        }
      } else if (["div", "table", "tr", "td", "body", "fragment"].includes(get.objtype(args[i]) ?? "")) {
        position = args[i];
      } else if (typeof args[i] == "number") {
        position2 = args[i];
      } else if (get.itemtype(args[i]) == "divposition") {
        divposition = args[i];
      } else if (typeof args[i] == "object") {
        style = args[i];
      } else if (typeof args[i] == "function") {
        listen = args[i];
      }
    }
    if (tagName == void 0) {
      tagName = "div";
    } else {
      let i1 = tagName.indexOf(".");
      const i2 = tagName.indexOf("#");
      if (i1 != -1 || i2 != -1) {
        if (i2 != -1 && (i1 == -1 || i2 < i1)) {
          i1 = i2;
        }
        str = tagName.slice(i1);
        tagName = tagName.slice(0, i1);
      }
    }
    const node = document.createElement(tagName);
    if (str) {
      applyClassAndId(node, str);
    }
    if (position) {
      if (typeof position2 == "number" && position.childNodes.length > position2) {
        position.insertBefore(node, position.childNodes[position2]);
      } else {
        position.appendChild(node);
      }
    }
    if (style) {
      HTMLDivElement.prototype.css.call(node, style);
    }
    if (divposition) {
      HTMLDivElement.prototype.setPosition.call(node, divposition);
    }
    if (innerHTML) {
      node.innerHTML = innerHTML;
    }
    if (listen) {
      node.onclick = listen;
    }
    return node;
  },
  iframe(src) {
    const layer = document.createElement("div");
    layer.classList.add("poplayer");
    layer.style.zIndex = "100";
    layer.listen(function() {
      this.remove();
    });
    layer.style.background = "white";
    const webview = document.createElement("iframe");
    webview.src = src;
    webview.style.width = "100%";
    webview.style.height = "100%";
    webview.style.left = "0px";
    webview.style.top = "0px";
    webview.style.position = "absolute";
    webview.style.border = "none";
    layer.appendChild(webview);
    const backbutton = ui.create.div(".menubutton.round", "返", layer, function() {
      layer.remove();
    });
    backbutton.style.bottom = "10px";
    backbutton.style.right = "10px";
    backbutton.style.background = "rgba(0,0,0,0.4)";
    backbutton.style.color = "white";
    backbutton.style.textShadow = "rgba(0,0,0,0.5) 0px 0px 2px";
    backbutton.style.boxShadow = "rgba(0, 0, 0, 0.3) 0 0 0 1px, rgba(0, 0, 0, 0.3) 0 3px 10px";
    backbutton.style.position = "fixed";
    ui.window.appendChild(layer);
  },
  selectlist(list, init, position, onchange) {
    const select = document.createElement("select");
    for (let i = 0; i < list.length; i++) {
      const option = document.createElement("option");
      if (Array.isArray(list[i])) {
        option.value = list[i][0];
        option.innerHTML = list[i][1];
      } else {
        const text = String(list[i]);
        option.value = text;
        option.innerHTML = text;
      }
      if (init == option.value) {
        option.selected = true;
      }
      select.appendChild(option);
    }
    if (position) {
      position.appendChild(select);
    }
    if (onchange) {
      select.onchange = onchange;
    }
    return select;
  },
  statictable(...args) {
    let str, row = 0, col = 0, hasRow = false, hasCol = false, position, position2, fixed;
    for (let i = 0; i < args.length; i++) {
      if (typeof args[i] == "string") {
        str = args[i];
      } else if (typeof args[i] == "number") {
        if (hasRow) {
          if (hasCol) {
            position2 = args[i];
          } else {
            col = args[i];
            hasCol = true;
          }
        } else {
          row = args[i];
          hasRow = true;
        }
      } else if (["div", "table", "tr", "td", "body", "fragment"].includes(get.objtype(args[i]) ?? "")) {
        position = args[i];
      } else if (typeof args[i] == "boolean") {
        fixed = args[i];
      }
    }
    if (str == void 0) {
      str = "";
    }
    const node = document.createElement("table");
    applyClassAndId(node, str);
    for (let i = 0; i < row; i++) {
      const tr = document.createElement("tr");
      if (fixed) {
        tr.style.height = 100 / row + "%";
      }
      node.appendChild(tr);
      for (let j = 0; j < col; j++) {
        const td = document.createElement("td");
        tr.appendChild(td);
      }
    }
    if (position) {
      if (typeof position2 == "number" && position.childNodes.length > position2) {
        position.insertBefore(node, position.childNodes[position2]);
      } else {
        position.appendChild(node);
      }
    }
    return node;
  },
  dialog(...args) {
    const dialog = new lib.element.Dialog(...args);
    if (!args.includes("hidden")) {
      dialog.open();
    }
    return dialog;
  },
  line2(...args) {
    const node = ui.create.line.apply(this, args);
    node.classList.add("line2");
    return node;
  },
  line(...args) {
    let two = false;
    let func;
    const node = ui.create.div(".config");
    for (let i = 0; i < args.length; i++) {
      if (typeof args[i] == "string" || typeof args[i] == "number") {
        if (two) {
          ui.create.div(".toggle", node).innerHTML = String(args[i]);
        } else {
          ui.create.div(node).innerHTML = String(args[i]);
          two = true;
        }
      } else if (typeof args[i] == "function") {
        func = args[i];
      }
    }
    if (func) {
      for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i];
        if (child instanceof HTMLElement && "listen" in child && typeof child.listen == "function") {
          child.listen(func);
        }
      }
    }
    return node;
  },
  switcher(name, current, current2, maybeCallback) {
    let func;
    const args = [name, current, current2, maybeCallback];
    for (let i = 0; i < args.length; i++) {
      if (typeof args[i] == "function") {
        func = args[i];
        break;
      }
    }
    const node = ui.create.div(".config");
    ui.create.div(node).innerHTML = get.translation(name + "_config");
    let initialLink = typeof current == "string" ? current : false;
    if (Array.isArray(current)) {
      initialLink = current[0];
    }
    const switcher = Object.assign(ui.create.div(".toggle.pointerdiv", node), {
      name,
      link: initialLink,
      choice: Array.isArray(current) ? current : [],
      additionalCommand: func
    });
    if (typeof current == "string") {
      switcher.link = current;
      switcher.innerHTML = get.translation(current);
      switcher.contentEditable = "true";
      switcher.style.webkitUserSelect = "text";
      switcher.addEventListener(lib.config.touchscreen ? "touchend" : "click", ui.click.editor);
    } else if (typeof current == "object") {
      switcher.link = typeof current2 == "string" ? current2 : current[0];
      switcher.innerHTML = get.translation(switcher.link);
      switcher.choice = current;
      switcher.addEventListener(lib.config.touchscreen ? "touchend" : "click", ui.click.switcher);
    } else {
      if (current) {
        switcher.classList.add("on");
      }
      switcher.classList.add("onoff");
      ui.create.div(ui.create.div(switcher));
      Object.assign(switcher, { link: current ? true : false });
      switcher.addEventListener(lib.config.touchscreen ? "touchend" : "click", ui.click.toggle);
    }
    if (func) {
      switcher.additionalCommand = func;
    }
    return node;
  },
  caption(str, position) {
    const caption = ui.create.div(".caption", position);
    caption.innerHTML = str;
    return caption;
  },
  /**
   * 创建分页类
   */
  pagination(options) {
    return new Pagination(options);
  }
};
export {
  domElementMethods
};

import "../../../noname.js";
import { game } from "../index.js";
import { ui } from "../../ui/index.js";
import { lib } from "../../library/index.js";
import { _status } from "../../status/index.js";
const zsLineAnimationMethods = {
  zsPlayLineAnimation(name, node, fake, points) {
    const animation = game.jianqiLineAnim;
    animation["image"] = name;
    if (lib.config.zsGuideTime) {
      animation["time"] = parseInt(lib.config.zsGuideTime);
    }
    if (animation == void 0) {
      return;
    }
    if (animation.time <= 1e5) {
      if (animation.pause != false && !_status.paused2 && !_status.nopause) {
        _status.zhx_onAnimationPause = true;
        game.pause2();
      }
      if (_status.zhx_onAnimation == void 0) {
        _status.zhx_onAnimation = 0;
      }
      _status.zhx_onAnimation++;
    }
    let src;
    if (animation.image != void 0) {
      src = "image/pointer/" + animation.image + "?" + (/* @__PURE__ */ new Date()).getTime();
    }
    const animationTracked = animation.time <= 1e5;
    const finish = function() {
      let animationID;
      let timeoutID;
      let interval;
      const div = ui.create.div();
      if (fake == true) {
        ui.window.appendChild(div);
      } else if (node == void 0 || node == false) {
        ui.window.appendChild(div);
      } else {
        node.appendChild(div);
      }
      if (animation.style != void 0) {
        for (const key in animation.style) {
          if (key == "innerHTML") {
            continue;
          }
          div.style[key] = animation.style[key];
        }
      }
      const judgeStyle = function(style) {
        if (animation.style == void 0) {
          return false;
        }
        return animation.style[style] != void 0;
      };
      if (judgeStyle("innerHTML")) div.innerHTML = animation.style.innerHTML;
      if (judgeStyle("width") == false) div.style.width = animation.width;
      if (judgeStyle("height") == false) div.style.height = animation.height;
      if (judgeStyle("backgroundSize") == false && judgeStyle("background-size") == false) div.style.backgroundSize = animation.backgroundSize;
      if (judgeStyle("opacity") == false) div.style.opacity = String(animation.opacity);
      if (judgeStyle("zIndex") == false && judgeStyle("z-index") == false) div.style.zIndex = "1001";
      if (judgeStyle("borderRadius") == false && judgeStyle("border-radius") == false) div.style.borderRadius = "5px";
      if (judgeStyle("pointer-events") == false && judgeStyle("pointerEvents") == false) div.style["pointer-events"] = "none";
      if (src != void 0) {
        if (animation.image.indexOf(".") != -1) {
          div.setBackgroundImage(src);
        } else {
          const type_frame = ".png";
          const num_frame = 8;
          const folder_frame = lib.assetURL + "image/pointer/" + animation.image + "/";
          const div1 = ui.create.div();
          div1.style.height = "100%";
          div1.style.width = "100%";
          div1.style.top = "0px";
          div1.style.left = "0px";
          div1.style.opacity = "0.7";
          div.appendChild(div1);
          const canvas = document.createElement("canvas");
          canvas.width = div1.offsetWidth;
          canvas.height = div1.offsetHeight;
          div1.appendChild(canvas);
          const context = canvas.getContext("2d");
          if (!context) {
            if (fake == true || node == void 0 || node == false) {
              ui.window.removeChild(div);
            } else {
              node.removeChild(div);
            }
            if (animationTracked && typeof _status.zhx_onAnimation === "number") {
              _status.zhx_onAnimation--;
            }
            if (animationTracked && _status.zhx_onAnimationPause == true && _status.zhx_onAnimation == 0) {
              delete _status.zhx_onAnimationPause;
              game.resume2();
            }
            return;
          }
          let start;
          const imgs = [];
          let imgs_num = 0;
          for (let i = 0; i < num_frame; i++) {
            const img = new Image();
            img.src = folder_frame + (animation.qianzhui == void 0 ? "" : animation.qianzhui) + (animation.liang == true ? i < 10 ? "0" + i : i : i) + type_frame;
            const isFinalFrame = i >= num_frame - 1;
            img.onload = () => {
              imgs.push(img);
              if (isFinalFrame) {
                start();
              }
            };
            img.onerror = () => {
              if (isFinalFrame) {
                start();
              }
            };
          }
          start = function() {
            const play = function() {
              if (!context || imgs_num >= imgs.length) {
                return;
              }
              const img = imgs[imgs_num];
              context.clearRect(0, 0, img.width, img.height);
              context.drawImage(img, 0, 0, img.width, img.height, 0, 0, div1.offsetWidth, div1.offsetHeight);
              imgs_num++;
              if (animation.jump_zhen == true && imgs[imgs_num + 1] != void 0) {
                imgs.remove(imgs_num + 1);
              }
              if (imgs_num >= imgs.length) {
                if (animation.cycle == true) {
                  imgs_num = 0;
                } else {
                  if (interval != void 0) clearInterval(interval);
                  if (timeoutID != void 0) clearTimeout(timeoutID);
                  if (animationID != void 0) cancelAnimationFrame(animationID);
                }
              }
            };
            interval = setInterval(play, animation.rate_zhen == void 0 ? 45 : 1e3 / animation.rate_zhen);
          };
        }
      }
      if (points == void 0) {
        if (judgeStyle("top") == false) {
          div.style.top = "calc(50% - " + div.offsetHeight / 2 + "px)";
        }
        if (judgeStyle("left") == false) {
          div.style.left = "calc(50% - " + div.offsetWidth / 2 + "px)";
        }
      } else {
        div.style.top = points[0][1] - div.offsetHeight / 2 + "px";
        div.style.left = points[0][0] + "px";
      }
      let div2 = null;
      if (points != void 0) {
        const timeS = (animation.fade == true ? animation.time - 450 : animation.time - 100) / 1e3 / 2;
        const getAngle = function(x12, y12, x2, y2, bool) {
          const x = x12 - x2;
          const y = y12 - y2;
          const z = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
          const cos = y / z;
          const radina = Math.acos(cos);
          let angle = 180 / (Math.PI / radina);
          if (x2 > x12 && y2 === y12) angle = 0;
          if (x2 > x12 && y2 < y12) angle = angle - 90;
          if (x2 === x12 && y12 > y2) angle = -90;
          if (x2 < x12 && y2 < y12) angle = 270 - angle;
          if (x2 < x12 && y2 === y12) angle = 180;
          if (x2 < x12 && y2 > y12) angle = 270 - angle;
          if (x2 === x12 && y2 > y12) angle = 90;
          if (x2 > x12 && y2 > y12) angle = angle - 90;
          if (bool == true && angle > 90) angle -= 180;
          return angle;
        };
        const p1 = points[0];
        const p2 = points[1];
        const x0 = p1[0];
        const y0 = p1[1];
        const x1 = p2[0];
        const y1 = p2[1];
        div.style.transition = "all 0s";
        div.style.transform = "rotate(" + getAngle(x0, y0, x1, y1, true) + "deg)" + (x0 > x1 ? "" : " rotateY(180deg)");
        div.style["transform-origin"] = "0 50%";
        div2 = ui.create.div();
        div2.style.zIndex = "1000";
        div2.style["pointer-events"] = "none";
        div2.style.height = "20px";
        div2.style.width = Math.pow(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2), 0.5) + 2 + "px";
        div2.style.left = x0 + "px";
        div2.style.top = y0 - 10 + "px";
        div2.style.transform = "rotate(" + getAngle(x0, y0, x1, y1) + "deg) scaleX(0)";
        div2.style["transform-origin"] = "0 50%";
        div2.style.transition = "all " + timeS * 4 / 3 + "s";
        if (src != void 0 && animation.image.indexOf(".") == -1) {
          div2.style.backgroundSize = "100% 100%";
          div2.style.opacity = "0.7";
          div2.setBackgroundImage("image/pointer/" + animation.image + "/line.png");
        } else {
          div2.style.background = "#ffffff";
        }
        setTimeout(function() {
          if (!div2) return;
          div.style.transition = "all " + timeS * 4 / 3 + "s";
          div.style.transform += " translateX(" + -(Math.pow(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2), 0.5) + 2) + "px)";
          div2.style.transform = "rotate(" + getAngle(x0, y0, x1, y1) + "deg) scaleX(1)";
        }, 50);
        setTimeout(
          function() {
            if (!div2) return;
            div2.style.transition = "all " + timeS * 2 / 3 + "s";
            div2.style.transform = "rotate(" + getAngle(x0, y0, x1, y1) + "deg) translateX(" + (Math.pow(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2), 0.5) + 2 - Math.pow(Math.pow(div.offsetHeight / 2, 2) + Math.pow(div.offsetWidth / 2, 2), 0.5)) + "px) scaleX(0.01)";
          },
          50 + timeS * 4 / 3 * 1e3
        );
        if (div2) {
          node.appendChild(div2);
        }
      }
      if (animation.time <= 1e5) {
        if (animation.fade == true) {
          if (div2) {
            setTimeout(function() {
              div2.hide();
            }, animation.time - 350);
            setTimeout(function() {
              div.hide();
            }, animation.time - 400);
          } else {
            setTimeout(function() {
              div.hide();
            }, animation.time - 350);
          }
        }
        setTimeout(function() {
          if (interval != void 0) clearInterval(interval);
          if (timeoutID != void 0) clearTimeout(timeoutID);
          if (animationID != void 0) cancelAnimationFrame(animationID);
          if (fake == true) {
            ui.window.removeChild(div);
          } else if (node == void 0 || node == false) {
            ui.window.removeChild(div);
          } else {
            node.removeChild(div);
          }
          if (div2 && node) {
            node.removeChild(div2);
          }
          if (typeof _status.zhx_onAnimation === "number") {
            _status.zhx_onAnimation--;
          }
          if (_status.zhx_onAnimationPause == true && _status.zhx_onAnimation == 0) {
            delete _status.zhx_onAnimationPause;
            game.resume2();
          }
        }, animation.time);
      }
    };
    if (animation.delay != void 0) {
      setTimeout(finish, animation.delay);
    } else {
      finish();
    }
  },
  zsPlayLineAnimationByName(name, path) {
    const from = [path[0], path[1]];
    const to = [path[2], path[3]];
    if (game.chess) {
      game.zsPlayLineAnimation(name, ui.chess, false, [from, to]);
    } else {
      game.zsPlayLineAnimation(name, ui.arena, false, [from, to]);
    }
  },
  zsXiangongLineXy(path) {
    game.zsPlayLineAnimationByName("jianqilinexy", path);
  },
  zsZhuzhangLineXy(path) {
    game.zsPlayLineAnimationByName("zhuzhanglinexy", path);
  },
  zsMohuaLineXy(path) {
    game.zsPlayLineAnimationByName("mohualinexy", path);
  },
  zsShenjianLineXy(path) {
    game.zsPlayLineAnimationByName("shenjianlinexy", path);
  },
  zsYujianLineXy(path) {
    game.zsPlayLineAnimationByName("yujianlinexy", path);
  },
  zsAnheiLineXy(path) {
    game.zsPlayLineAnimationByName("anheilinexy", path);
  },
  zsMozhuaLineXy(path) {
    game.zsPlayLineAnimationByName("mozhualinexy", path);
  },
  zsJianfengLineXy(path) {
    game.zsPlayLineAnimationByName("jianfenglinexy", path);
  },
  zsJinjianLineXy(path) {
    game.zsPlayLineAnimationByName("jinjianlinexy", path);
  },
  zsJinlongLineXy(path) {
    game.zsPlayLineAnimationByName("jinlonglinexy", path);
  },
  zsLuoyingLineXy(path) {
    game.zsPlayLineAnimationByName("luoyinglinexy", path);
  },
  zsXingdieLineXy(path) {
    game.zsPlayLineAnimationByName("xingdielinexy", path);
  },
  zsYuexianLineXy(path) {
    game.zsPlayLineAnimationByName("yuexianlinexy", path);
  },
  zsShezhangLineXy(path) {
    game.zsPlayLineAnimationByName("shezhanglinexy", path);
  }
};
export {
  zsLineAnimationMethods
};

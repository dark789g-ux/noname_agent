import "../../../noname.js";
import { game } from "../index.js";
import { ui } from "../../ui/index.js";
import { _status } from "../../status/index.js";
import { lib } from "../../library/index.js";
function createGameAnimate() {
  return {
    window: function(num) {
      switch (num) {
        case 1: {
          ui.window.style.transition = "all 0.5s";
          ui.window.classList.add("zoomout3");
          ui.window.hide();
          game.addVideo("windowzoom1");
          game.delay(0, 500);
          break;
        }
        case 2: {
          ui.window.style.transition = "all 0s";
          ui.refresh(ui.window);
          game.addVideo("windowzoom2");
          game.pause();
          setTimeout(function() {
            ui.window.classList.remove("zoomout3");
            ui.window.classList.add("zoomin3");
            game.addVideo("windowzoom3");
            setTimeout(function() {
              ui.window.style.transition = "all 0.5s";
              ui.refresh(ui.window);
              ui.window.show();
              ui.window.classList.remove("zoomin3");
              game.addVideo("windowzoom4");
              setTimeout(function() {
                ui.window.style.transition = "";
                game.addVideo("windowzoom5");
                game.resume();
              }, 500);
            }, 100);
          }, 100);
          break;
        }
      }
    },
    flame: function(x, y, duration, type) {
      const particles = [];
      let particle_count = 50;
      if (type == "thunder" || type == "recover") {
        particle_count = 30;
      } else if (type == "coin" || type == "dust") {
        particle_count = 50;
      } else if (type == "legend") {
        particle_count = 120;
      } else if (type == "epic") {
        particle_count = 80;
      } else if (type == "rare") {
        particle_count = 50;
      }
      function Particle() {
        this.speed = { x: -1 + Math.random() * 2, y: -5 + Math.random() * 5 };
        if (type == "thunder" || type == "coin" || type == "dust") {
          this.speed.y = -3 + Math.random() * 5;
          this.speed.x = -2 + Math.random() * 4;
        }
        if (type == "legend" || type == "rare" || type == "epic") {
          this.speed.x *= 3;
          this.speed.y *= 1.5;
        }
        this.location = { x, y };
        this.radius = 0.5 + Math.random() * 1;
        this.life = 10 + Math.random() * 10;
        this.death = this.life;
        switch (type) {
          case "thunder": {
            this.b = 255;
            this.r = Math.round(Math.random() * 255);
            this.g = Math.round(Math.random() * 255);
            this.location.x += Math.random() * 20 - 10;
            this.location.y += Math.random() * 20 - 10;
            break;
          }
          case "fire": {
            this.r = 255;
            this.g = Math.round(Math.random() * 155);
            this.b = 0;
            break;
          }
          case "coin": {
            this.r = 255;
            this.g = Math.round(Math.random() * 25 + 230);
            this.b = Math.round(Math.random() * 100 + 50);
            this.location.x += Math.round(Math.random() * 60) - 30;
            this.location.y += Math.round(Math.random() * 40) - 20;
            this.speed.x = this.location.x < x ? -Math.abs(this.speed.x) : Math.abs(this.speed.x);
            this.life *= 1.3;
            this.death *= 1.3;
            break;
          }
          case "dust": {
            this.r = Math.round(Math.random() * 55) + 105;
            this.g = Math.round(Math.random() * 55) + 150;
            this.b = 255;
            this.location.x += Math.round(Math.random() * 60) - 30;
            this.location.y += Math.round(Math.random() * 40) - 20;
            this.speed.x = this.location.x < x ? -Math.abs(this.speed.x) : Math.abs(this.speed.x);
            this.life *= 1.3;
            this.death *= 1.3;
            break;
          }
          case "legend": {
            this.r = 255;
            this.g = Math.round(Math.random() * 100 + 155);
            this.b = Math.round(Math.random() * 100 + 50);
            this.location.x += Math.round(Math.random() * 60) - 30;
            this.location.y += Math.round(Math.random() * 40) - 20;
            this.speed.x = (this.location.x < x ? -Math.abs(this.speed.x) : Math.abs(this.speed.x)) / 2;
            this.speed.y /= 2;
            this.life *= 2;
            this.death *= 2;
            break;
          }
          case "epic": {
            this.r = Math.round(Math.random() * 55) + 200;
            this.g = Math.round(Math.random() * 100) + 55;
            this.b = 255;
            this.location.x += Math.round(Math.random() * 60) - 30;
            this.location.y += Math.round(Math.random() * 40) - 20;
            this.speed.x = (this.location.x < x ? -Math.abs(this.speed.x) : Math.abs(this.speed.x)) / 2;
            this.speed.y /= 2;
            this.life *= 2;
            this.death *= 2;
            break;
          }
          case "rare": {
            this.r = Math.round(Math.random() * 55) + 105;
            this.g = Math.round(Math.random() * 55) + 150;
            this.b = 255;
            this.location.x += Math.round(Math.random() * 60) - 30;
            this.location.y += Math.round(Math.random() * 40) - 20;
            this.speed.x = (this.location.x < x ? -Math.abs(this.speed.x) : Math.abs(this.speed.x)) / 2;
            this.speed.y /= 2;
            this.life *= 2;
            this.death *= 2;
            break;
          }
          case "recover": {
            this.g = 255;
            this.r = Math.round(Math.random() * 200 + 55);
            this.b = Math.round(Math.random() * 155 + 55);
            this.location.x += Math.round(Math.random() * 60) - 30;
            this.location.y += Math.round(Math.random() * 40) - 20;
            this.speed.x = (this.location.x < x ? -Math.abs(this.speed.x) : Math.abs(this.speed.x)) / 2;
            this.speed.y /= 2;
            this.life *= 2;
            this.death *= 2;
            break;
          }
          default: {
            this.r = 255;
            this.g = Math.round(Math.random() * 155);
            this.b = 0;
          }
        }
      }
      for (let i = 0; i < particle_count; i++) {
        particles.push(new Particle());
      }
      game.draw(function(time, surface) {
        surface.globalCompositeOperation = "source-over";
        surface.globalCompositeOperation = "lighter";
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          surface.beginPath();
          let middle = 0.5;
          let radius = p.radius;
          if (type == "recover" || type == "legend" || type == "rare" || type == "epic" || type == "coin" || type == "dust") {
            middle = 0.7;
            radius /= 3;
          }
          p.opacity = Math.round(p.death / p.life * 100) / 100;
          const gradient = surface.createRadialGradient(p.location.x, p.location.y, 0, p.location.x, p.location.y, p.radius);
          gradient.addColorStop(0, "rgba(" + p.r + ", " + p.g + ", " + p.b + ", " + p.opacity + ")");
          gradient.addColorStop(middle, "rgba(" + p.r + ", " + p.g + ", " + p.b + ", " + p.opacity + ")");
          gradient.addColorStop(1, "rgba(" + p.r + ", " + p.g + ", " + p.b + ", 0)");
          surface.fillStyle = gradient;
          surface.arc(p.location.x, p.location.y, radius, Math.PI * 2, false);
          surface.fill();
          p.death--;
          if (type == "recover" || type == "legend" || type == "rare" || type == "epic") {
            p.radius += 0.5;
          } else if (type == "coin" || type == "dust") {
            p.radius += 0.7;
          } else {
            p.radius++;
          }
          p.location.x += p.speed.x;
          p.location.y += p.speed.y;
          if (p.death < 0 || p.radius < 0) {
            if (typeof duration == "number" && time + 500 >= duration) {
              particles.splice(i--, 1);
            } else {
              particles[i] = new Particle();
            }
          }
        }
        if (particles.length == 0) {
          return false;
        }
      });
    }
  };
}
const dialogAndAnimateMethods = {
  draw(func) {
    lib.canvasUpdates.push(func);
    if (!lib.status.canvas) {
      lib.status.canvas = true;
      game.update(lib.updateCanvas);
    }
  },
  vibrate(time) {
    if ("vibrate" in navigator) {
      navigator.vibrate(time || 500);
    }
  },
  prompt(...args) {
    let str, forced, callback, noinput = false, str2 = "";
    for (let i = 0; i < args.length; i++) {
      if (args[i] == "alert") {
        forced = true;
        noinput = true;
      } else if (typeof args[i] == "string") {
        if (args[i].startsWith("###")) {
          const list = args[i].slice(3).split("###");
          str = list[0];
          str2 = list[1];
        } else {
          str = args[i];
        }
      } else if (typeof args[i] == "boolean") {
        forced = args[i];
      } else if (typeof args[i] == "function") {
        callback = args[i];
      }
    }
    if (!callback) {
      callback = function() {
      };
    }
    function clickPromptContainer() {
      if (this.clicked) {
        this.clicked = false;
      } else {
        clickCancel();
      }
    }
    const promptContainer = Object.assign(ui.create.div(".popup-container", ui.window, clickPromptContainer), { clicked: false });
    const dialogContainer = ui.create.div(".prompt-container", promptContainer);
    const dialog = ui.create.div(".menubg", ui.create.div(dialogContainer), function() {
      promptContainer.clicked = true;
    });
    ui.create.div("", str || "", dialog);
    const input = ui.create.node("textarea", ui.create.div(dialog));
    input.value = str2;
    input.setAttribute("cols", String(Math.max(str2.split("\n").length || 1, 10)));
    if (noinput) {
      input.style.display = "none";
    }
    const controls = ui.create.div(dialog);
    const clickConfirm = function() {
      if (noinput) {
        callback(true);
        promptContainer.remove();
      } else {
        callback(input.value);
        promptContainer.remove();
      }
    };
    const clickCancel = function() {
      callback(false);
      if (!forced) {
        promptContainer.remove();
      }
    };
    const confirmNode = ui.create.div(".menubutton.large.disabled", "确定", controls, clickConfirm);
    if (!forced) {
      ui.create.div(".menubutton.large", "取消", controls, clickCancel);
    }
    if (noinput || str2 && str2.length > 0) {
      confirmNode.classList.remove("disabled");
    } else {
      input.onkeydown = function(e) {
        if (e.key == "Enter") {
          clickConfirm();
        } else if (e.key == "Escape") {
          clickCancel();
        }
        e.stopPropagation();
      };
      input.onkeyup = function(e) {
        confirmNode.classList.remove("disabled");
        e.stopPropagation();
      };
      input.focus();
    }
  },
  alert(str) {
    game.prompt(str, "alert");
  },
  print(...args) {
    if (!_status.toprint) {
      _status.toprint = [];
    }
    _status.toprint.push(args);
  }
};
export {
  createGameAnimate,
  dialogAndAnimateMethods
};

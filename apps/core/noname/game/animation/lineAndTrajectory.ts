import { lib, get, ui } from "noname";
import { game } from "../index.js";
import type { Game } from "../index.js";

export function createJianqiLineAnim() {
	return {
		time: 1200,
		position: "screen",
		width: "256px",
		height: "128px",
		backgroundSize: "100% 100%",
		opacity: 1,
		show: "none",
		fade: true,
		pause: false,
		rate_zhen: 18,
		jump_zhen: false,
		qianzhui: "",
		liang: false,
		isLine: true,
		cycle: true,
		style: {},
		skills: [],
		cards: [],
		forbid: false,
		image: "jianqilinexy",
	};
}

export const lineAndTrajectoryMethods = {
	linexy(this: Game, path: [number, number, number, number], config: any = undefined, reusable: boolean | HTMLDivElement | undefined = undefined): HTMLDivElement {
		const from: [number, number] = [path[0], path[1]],
			to: [number, number] = [path[2], path[3]];
		let total = typeof config === "number" ? config : lib.config.duration * 2,
			opacity = 1,
			dashed = false,
			drag = false;
		let color: number[] | string = [255, 255, 255];
		if (config && typeof config == "object") {
			Object.keys(config).forEach(value => {
				switch (value) {
					case "opacity":
						opacity = config[value];
						break;
					case "color":
						color = config[value];
						break;
					case "dashed":
						dashed = config[value];
						break;
					case "duration":
						total = config[value];
						break;
				}
			});
		} else if (typeof config == "string") {
			color = config;
		}
		if (typeof color == "string") {
			color = lib.lineColor.get(color) || [255, 255, 255];
		}
		let node: HTMLDivElement;
		if (config == "drag") {
			color = [236, 201, 71];
			drag = true;
			if (reusable && typeof reusable !== "boolean") {
				node = reusable;
			} else {
				node = ui.create.div(".linexy.drag");
				node.style.left = `${from[0]}px`;
				node.style.top = `${from[1]}px`;
				node.style.background = `linear-gradient(transparent,rgba(${color.toString()},${opacity}),rgba(${color.toString()},${opacity}))`;
				if (game.chess) {
					ui.chess.appendChild(node);
				} else {
					ui.arena.appendChild(node);
				}
			}
		} else {
			node = ui.create.div(".linexy.hidden");
			node.style.left = `${from[0]}px`;
			node.style.top = `${from[1]}px`;
			node.style.background = `linear-gradient(transparent,rgba(${color.toString()},${opacity}),rgba(${color.toString()},${opacity}))`;
			node.style.transitionDuration = `${total / 3000}s`;
		}
		const dy = to[1] - from[1],
			dx = to[0] - from[0];
		let deg = (Math.atan(Math.abs(dy) / Math.abs(dx)) / Math.PI) * 180;
		if (dx >= 0) {
			if (dy <= 0) {
				deg += 90;
			} else {
				deg = 90 - deg;
			}
		} else if (dy <= 0) {
			deg = 270 - deg;
		} else {
			deg += 270;
		}
		if (drag) {
			node.style.transform = `rotate(${-deg}deg)`;
			node.style.height = `${get.xyDistance(from, to)}px`;
		} else {
			node.style.transform = `rotate(${-deg}deg) scaleY(0)`;
			node.style.height = `${get.xyDistance(from, to)}px`;
			if (["div", "fragment"].includes(get.objtype(config))) {
				config.appendChild(node);
			} else if (game.chess) {
				ui.chess.appendChild(node);
			} else {
				ui.arena.appendChild(node);
			}
			ui.refresh(node);
			node.show();
			node.style.transform = `rotate(${-deg}deg) scaleY(1)`;
			node.listenTransition(() =>
				setTimeout(() => {
					if (!node.classList.contains("removing")) {
						node.delete();
					}
				}, total / 3)
			);
		}
		return node;
	},
	_linexy(this: Game, path: [number, number, number, number], option?: any, chessFlag?: any) {
		const from = [path[0], path[1]];
		const to = [path[2], path[3]];
		let total = typeof option === "number" ? option : lib.config.duration * 2;
		let opacity = 1;
		let color: string | number[] = [255, 255, 255];
		let dashed = false;
		if (option && typeof option == "object") {
			for (const key in option) {
				switch (key) {
					case "opacity":
						opacity = option[key];
						break;
					case "color":
						color = option[key];
						break;
					case "dashed":
						dashed = option[key];
						break;
					case "duration":
						total = option[key];
						break;
				}
			}
		} else if (option == "fire" || option == "thunder" || option == "green") {
			color = option;
		}
		if (color == "fire") {
			color = [255, 146, 68];
		} else if (color == "thunder") {
			color = [141, 216, 255];
		} else if (color == "green") {
			color = [141, 255, 216];
		}
		if (typeof color == "string") {
			color = lib.lineColor.get(color) || [255, 255, 255];
		}
		const drawfunc = function (time: number, ctx: CanvasRenderingContext2D) {
			let current: number[];
			if (time < total / 3) {
				ctx.strokeStyle = "rgba(" + color.toString() + "," + opacity * (time / (total / 3)) + ")";
				current = [from[0] + ((to[0] - from[0]) * time) / (total / 3), from[1] + ((to[1] - from[1]) * time) / (total / 3)];
			} else if (time <= total) {
				current = to;
				if (time > total / 1.5) {
					ctx.strokeStyle = "rgba(" + color.toString() + "," + opacity * (1 - (time - total / 1.5) / (total - total / 1.5)) + ")";
				} else {
					ctx.strokeStyle = "rgba(" + color.toString() + "," + opacity + ")";
				}
			} else {
				return false;
			}
			ctx.beginPath();
			if (dashed) {
				ctx.lineCap = "butt";
				ctx.setLineDash([8, 2]);
			} else {
				ctx.lineCap = "round";
			}
			ctx.moveTo(from[0], from[1]);
			ctx.lineTo(current[0], current[1]);
			ctx.stroke();
		};
		if (chessFlag && game.chess) {
			if (typeof game.draw2 != "function") {
				throw new TypeError("Chess mode requires game.draw2");
			}
			game.draw2(drawfunc);
		} else {
			game.draw(drawfunc);
		}
	},
};

import { lib, game, get, _status, ui } from "noname";
import type { ConnectEventInfo, ConnectEventsButton } from "../contracts/domTargetsContract.js";

function formatEventTime(day: number, hour: number, currentDay: number): string {
	let str = day < currentDay ? "下周" : "周";
	str += day == 7 ? "日" : get.cnNumber(day, true);
	str += " ";
	if (hour <= 12) {
		if (hour <= 5) {
			str += "凌晨";
		} else if (hour < 12) {
			str += "上午";
		} else {
			str += "中午";
		}
		str += hour + "点";
	} else {
		str += hour <= 17 ? "下午" : "晚上";
		str += hour - 12 + "点";
	}
	return str;
}

export const connectEventsMethods = {
	connectEvents(this: ConnectEventsButton) {
		if (!this.info) {
			return;
		}
		const button = this;
		const onlineKey = game.onlineKey;
		const layer = ui.create.div(".poplayer", ui.window);
		const uiintro = ui.create.dialog("hidden", "notouchscroll");
		this.classList.add("active");
		if (lib.config.touchscreen) {
			lib.setScroll(uiintro.contentContainer);
		}
		layer.listen(function (this: HTMLDivElement) {
			if (_status.clicked) {
				_status.clicked = false;
				return;
			}
			button.classList.remove("active");
			uiintro.delete();
			this.delete();
		});
		uiintro.listen(function () {
			_status.clicked = true;
		});
		uiintro.style.zIndex = "21";
		uiintro.classList.add("popped");
		uiintro.classList.add("static");
		uiintro.classList.add("onlineclient");
		uiintro.style.width = "180px";
		uiintro.style.height = "300px";
		uiintro.style.left = "auto";
		uiintro.style.right = "20px";
		uiintro.style.top = "auto";
		uiintro.style.bottom = "75px";

		uiintro.refresh = function () {
			if (button.focused) {
				return;
			}
			uiintro.content.innerHTML = "";
			uiintro.addText("创建约战");
			const textContainer = uiintro.content.lastElementChild;
			if (!(textContainer instanceof HTMLElement) || !(textContainer.lastElementChild instanceof HTMLElement)) {
				return;
			}
			button.textnode = textContainer.lastElementChild;
			uiintro.add('<input type="text" style="width:calc(100% - 10px);resize: none;border: none;border-radius: 2px;box-shadow: rgba(0, 0, 0, 0.2) 0px 0px 0px 1px;margin-top: -2px;margin-bottom: 2px;">');
			const inputContainer = uiintro.content.lastElementChild;
			if (!(inputContainer instanceof HTMLElement)) {
				return;
			}
			inputContainer.style.paddingTop = "0";
			const input = inputContainer.lastElementChild;
			if (!(input instanceof HTMLInputElement)) {
				return;
			}
			button.input = input;
			button.input.onfocus = function () {
				button.focused = true;
			};
			button.input.onblur = function () {
				delete button.focused;
			};
			if (button.interval) {
				button.input.disabled = true;
				button.input.style.opacity = "0.6";
				if (button.intervaltext) {
					button.textnode.innerHTML = button.intervaltext;
				}
			}
			const datenode = ui.create.div(uiintro.content);
			datenode.style.marginTop = "0";
			datenode.style.whiteSpace = "nowrap";
			const date = new Date();
			let days: Array<[string, string]> = [];
			let currentDay = date.getDay();
			if (currentDay == 0) {
				currentDay = 7;
			}
			for (let i = 1; i <= 7; i++) {
				if (i < currentDay) {
					days.push([i.toString(), "下周" + get.cnNumber(i, true)]);
				} else if (i == 7) {
					days.push([i.toString(), "周日"]);
				} else if (i == currentDay) {
					days.push([i.toString(), "今天"]);
				} else {
					days.push([i.toString(), "周" + get.cnNumber(i, true)]);
				}
			}
			days = days.concat(days.splice(0, currentDay - 1));
			let initday = currentDay + 1;
			if (initday > 7) {
				initday -= 7;
			}
			const daysselect = ui.create.selectlist(days, initday.toString(), datenode);
			daysselect.style.width = "55px";
			const hours: Array<[string, string]> = [];
			for (let i = 0; i < 24; i++) {
				hours.push([i.toString(), i.toString() + "点"]);
			}
			const hoursselect = ui.create.selectlist(hours, date.getHours().toString(), datenode);
			hoursselect.style.marginLeft = "5px";
			hoursselect.style.width = "55px";
			const timeconfirm = ui.create.node("button", "确定", datenode) as HTMLButtonElement;
			timeconfirm.style.marginLeft = "5px";
			timeconfirm.onclick = function () {
				if (!button.input.value) {
					alert("请填写约战标题");
					return;
				}
				const date2 = new Date();
				date2.setHours(parseInt(hoursselect.value));
				date2.setMinutes(0);
				date2.setSeconds(0);
				let deltaday = parseInt(daysselect.value) - currentDay;
				if (deltaday < 0) {
					deltaday += 7;
				}
				const utc = date2.getTime() + deltaday * 24 * 3600000;
				if (utc < date.getTime()) {
					alert("创建失败，时间已过");
					return;
				}
				if (typeof onlineKey != "string") {
					return;
				}
				if (get.is.banWords(button.input.value)) {
					const eventContent = get.plainText(button.input.value);
					const eventnode = ui.create.div(
						".menubutton.videotext.onlineevent.pointerdiv",
						function () {
							setTimeout(function () {
								if (eventnode.classList.contains("active")) {
									if (confirm("确定要离开" + eventContent + "？")) {
										eventnode.classList.remove("active");
									}
								} else if (confirm("确定要加入" + eventContent + "？")) {
									eventnode.classList.add("active");
								}
							});
						},
						uiintro.content,
						4
					);
					const fakeinfo = {
						utc,
						day: parseInt(daysselect.value),
						hour: parseInt(hoursselect.value),
						nickname: get.connectNickname(),
						avatar: lib.config.connect_avatar,
						content: eventContent,
						create: onlineKey,
						members: [onlineKey],
					};
					ui.create.div(".title", fakeinfo.content, eventnode);
					const timeText = formatEventTime(fakeinfo.day, fakeinfo.hour, currentDay);
					ui.create.div("", "已有" + fakeinfo.members.length + "人加入", eventnode);
					ui.create.div("", "时间：" + timeText, eventnode);
					if (fakeinfo.members.includes(onlineKey)) {
						eventnode.classList.add("active");
					}
					button.input.value = "";
					return;
				}
				game.send(
					"server",
					"events",
					{
						utc,
						day: parseInt(daysselect.value),
						hour: parseInt(hoursselect.value),
						nickname: get.connectNickname(),
						avatar: lib.config.connect_avatar,
						content: get.plainText(button.input.value),
					},
					onlineKey
				);
			};

			let num = 0;
			for (let i = 0; i < button.info.length; i++) {
				const eventInfo: ConnectEventInfo = button.info[i];
				if (typeof eventInfo.creator == "string" && (typeof onlineKey != "string" || eventInfo.creator != onlineKey) && get.is.banWords(eventInfo.content)) {
					continue;
				}
				if (typeof onlineKey == "string" && typeof eventInfo.creator == "string" && eventInfo.creator == onlineKey) {
					num++;
				}
				const eventnode = ui.create.div(
					".menubutton.videotext.onlineevent.pointerdiv",
					function () {
						if (typeof eventInfo.creator != "string") {
							return;
						}
						setTimeout(function () {
							if (eventnode.classList.contains("active")) {
								if (confirm("确定要离开" + eventInfo.content + "？") && typeof onlineKey == "string") {
									game.send("server", "events", eventInfo.id, onlineKey, "leave");
								}
							} else if (confirm("确定要加入" + eventInfo.content + "？") && typeof onlineKey == "string") {
								game.send("server", "events", eventInfo.id, onlineKey, "join");
							}
						});
					},
					uiintro.content
				);
				if (typeof eventInfo.creator == "string") {
					ui.create.div(".title", eventInfo.content, eventnode);
					const timeText = formatEventTime(eventInfo.day, eventInfo.hour, currentDay);
					ui.create.div("", "创建者：" + eventInfo.nickname, eventnode);
					ui.create.div("", "已有" + eventInfo.members.length + "人加入", eventnode);
					ui.create.div("", "时间：" + timeText, eventnode);
					if (typeof onlineKey == "string" && eventInfo.members.includes(onlineKey)) {
						eventnode.classList.add("active");
					}
				} else {
					ui.create.div(".title", eventInfo.title, eventnode);
					ui.create.div("", eventInfo.content, eventnode);
					ui.create.div("", "创建者：" + eventInfo.nickname, eventnode);
				}
			}
			if (num >= 3) {
				button.input.disabled = true;
				button.input.style.opacity = "0.6";
				hoursselect.disabled = true;
				daysselect.disabled = true;
				timeconfirm.disabled = true;
			}
		};
		uiintro.refresh?.();
		ui.window.appendChild(uiintro);
		_status.connectEventsCallback = function () {
			if (uiintro.parentNode == ui.window) {
				uiintro.refresh?.();
			}
		};
	},
};

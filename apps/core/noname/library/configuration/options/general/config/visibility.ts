import { get } from "noname";
import { lib } from "noname";

export function createGeneralVisibilityOptions() {
	return {
		update: function (config, map) {
			if ("ontouchstart" in document) {
				map.touchscreen.show();
			} else {
				map.touchscreen.hide();
			}
			if (lib.device || lib.node) {
				map.auto_check_update.show();
			} else {
				map.auto_check_update.hide();
			}
			if (lib.device) {
				map.enable_vibrate.show();
				map.keep_awake.show();
			} else {
				map.enable_vibrate.hide();
				map.keep_awake.hide();
			}
			// if(config.enable_pressure){
			// 	map.pressure_click.show();
			// 	if(lib.device){
			// 		map.pressure_taptic.show();
			// 	}
			// 	else{
			// 		map.pressure_taptic.hide();
			// 	}
			// }
			// else{
			// 	map.pressure_click.hide();
			// 	map.pressure_taptic.hide();
			// }
			if (lib.config.touchscreen) {
				map.mousewheel.hide();
				map.hover_all.hide();
				map.hover_handcard.hide();
				map.hoveration.hide();
				map.right_info.hide();
				map.right_click.hide();
				map.longpress_info.show();
				map.swipe.show();
				if (lib.config.swipe) {
					map.swipe_up.show();
					map.swipe_down.show();
					map.swipe_left.show();
					map.swipe_right.show();
				} else {
					map.swipe_up.hide();
					map.swipe_down.hide();
					map.swipe_left.hide();
					map.swipe_right.hide();
				}
			} else {
				map.mousewheel.show();
				map.hover_all.show();
				map.right_info.show();
				map.right_click.show();
				map.longpress_info.hide();
				if (!config.hover_all) {
					map.hover_handcard.hide();
					map.hoveration.hide();
				} else {
					map.hover_handcard.show();
					map.hoveration.show();
				}
				map.swipe.hide();
				map.swipe_up.hide();
				map.swipe_down.hide();
				map.swipe_left.hide();
				map.swipe_right.hide();
			}
			if (lib.config.enable_drag) {
				if (lib.config.touchscreen) {
					map.enable_dragline.hide();
					map.enable_touchdragline.show();
				} else {
					map.enable_dragline.show();
					map.enable_touchdragline.hide();
				}
			} else {
				map.enable_dragline.hide();
				map.enable_touchdragline.hide();
			}
			if (!get.is.phoneLayout()) {
				map.round_menu_func.hide();
			} else {
				map.round_menu_func.show();
			}
			if (!lib.node && lib.device != "ios") {
				map.confirm_exit.show();
			} else {
				map.confirm_exit.hide();
			}
		},
	};
}

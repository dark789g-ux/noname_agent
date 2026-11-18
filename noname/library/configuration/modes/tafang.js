function createModeTafang() {
  return {
    name: "塔防",
    config: {
      tafang_turn: {
        name: "游戏胜利",
        init: "10",
        frequent: true,
        item: {
          10: "十回合",
          20: "二十回合",
          30: "三十回合",
          1e3: "无限"
        }
      },
      // tafang_size:{
      // 	name:'战场大小',
      // 	init:'9',
      // 	frequent:true,
      // 	item:{
      // 		'6':'小',
      // 		'9':'中',
      // 		'12':'大',
      // 	}
      // },
      tafang_difficulty: {
        name: "战斗难度",
        init: "2",
        frequent: true,
        item: {
          1: "简单",
          2: "普通",
          3: "困难"
        }
      },
      show_range: {
        name: "显示卡牌范围",
        init: true
      },
      show_distance: {
        name: "显示距离",
        init: true
      },
      chessscroll_speed: {
        name: "边缘滚动速度",
        intro: "鼠标移至屏幕边缘时自动滚屏",
        init: "20",
        item: {
          0: "不滚动",
          10: "10格/秒",
          20: "20格/秒",
          30: "30格/秒"
        }
      }
    }
  };
}
export {
  createModeTafang
};

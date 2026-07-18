# 身份场游戏界面（Identity Mode UI）

身份场（mode=identity）游戏界面的代码索引，定位 UI 相关代码（不覆盖玩法逻辑/胜负判定）。

> - 所有路径均相对于仓库根目录。
> - 模式文件：`apps/core/mode/identity.js`（5219 行，**不**覆盖玩法逻辑，本文档只索引 UI/启动/DOM/样式相关）。
> - 4 个子模式：标准 `normal` / 明忠 `zhong` / 谋攻 `stratagem` / 3v3v2 `purple`（由 `identity_mode` 配置项控制）。
> - **身份场不使用任何专属 CSS 文件**——所有 UI 元素复用通用 Player DOM 和通用 layout CSS。

## 总览

```text
MenuView.vue onStartClick
  │  game.saveConfig("mode","identity") + directstart + game.reload()
  ▼
bootImpl()  [init/index.ts]
  └─ importMode("identity")  ──→ lib.mode.identity 注册
  └─ game.loop()
       ▼
game.switchMode("identity")  [game/index.js:7781-7963]
  ├─ lib.init.layout()       切换 layout CSS
  ├─ game.loadModeAsync()    mode exports mixin
  └─ game.createEvent("game").setContent(start)  [L7935]
       ▼
identity.start 数组  [mode/identity.js:10-472]
  ① 新手向导检查
  ② game.prepareArena(N) → ui.create.players(N) + ui.create.me()
  ③ 新手向导交互
  ④ game.chooseCharacter() → 选将 UI
  ⑤ 身份分配 + 主公增强 + event.trigger("gameStart")
  ⑥ game.gameDraw() 发牌
  ⑦ game.phaseLoop() 阶段循环
```

详细启动链路见 [startup.md](startup.md)。

## 核心目录

| 路径 | 说明 |
|------|------|
| `apps/core/mode/identity.js` | 身份场模式逻辑（start 链、选将、胜负判定、身份分配、子模式分流） |
| `apps/core/noname/ui/` | UI 类与 DOM 创建工厂 |
| `apps/core/layout/default/layout.css` | 身份颜色/身份牌定位主样式 |
| `apps/core/noname/library/element/player.js` | Player DOM 子节点构造 |

## 文档导航

| 文档 | 内容 |
|------|------|
| [startup.md](startup.md) | 启动链路：MenuView → bootImpl → switchMode → identity.start 数组 |
| [player-dom.md](player-dom.md) | Player DOM 结构（buildNode/buildExtra 子节点表）+ 身份相关方法 |
| [identity-card.md](identity-card.md) | 身份牌渲染/颜色/猜测交互 + 4 子模式差异 |
| [css-layout.md](css-layout.md) | 布局主题/座位排布/配置项（identity 配置块 L5773-6676） |

## 相关文档

- [../game-startup-flow.md](../game-startup-flow.md) —— 游戏启动到 phaseLoop 主线（涵盖所有模式）
- [../menu-dialog.md](../menu-dialog.md) —— 主菜单对话框，含开始游戏入口（MenuView.vue）
- [../game-event/index.md](../game-event/index.md) —— 事件系统，理解 `event.trigger("gameStart")` 等

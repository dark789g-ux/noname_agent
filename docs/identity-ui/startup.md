# 身份场启动链路

用户从主菜单点击"开始游戏 → 身份场"到对局正式开始（`phaseLoop`）的完整调用链。

> 本文档只覆盖启动链路；UI 元素渲染见 [player-dom.md](player-dom.md) 与 [identity-card.md](identity-card.md)；布局见 [css-layout.md](css-layout.md)

## 1. 用户入口：主菜单 → reload

`MenuView.vue` 的 `onStartClick()` 处理用户点击"开始"按钮。

调用序列：

```text
game.saveConfig("mode", "identity")        保存当前模式到配置
localStorage.setItem("directstart", "true") 设置直启标志
game.reload()                               页面重新加载
```

`reload()` 后页面整体刷新，浏览器重新执行 `index.html → entry.ts → boot()`，进入 `bootImpl`。

## 2. bootImpl 与模式导入

`bootImpl()`（`apps/core/noname/init/index.ts`）在基础初始化完成后，检测到 `directstart` 标志，跳过 splash 模式选择界面，直接调用：

```text
importMode("identity")
```

`importMode()` 定义在 `apps/core/noname/init/import.ts:46-57`，内部执行：

```text
动态 import("/mode/identity.js")
→ game.import("mode", config)
→ 注册到 lib.imported.mode.identity
```

注册完成后，boot 通过 `loadMode()` 将模式导出的 `element/game/ai/ui/get` 混入全局单例，保存 `lib.init.start = mode.start`，最终调用 `game.loop()` 启动事件循环。

## 3. game.switchMode("identity")

`switchMode()` 定义在 `apps/core/noname/game/index.js:7781-7963`，三个关键步骤：

| 步骤 | 行号 | 说明 |
|------|------|------|
| 切换布局 | `L7886` 附近 | `lib.init.layout(config.layout)` 切换布局 CSS（详见 [css-layout.md](css-layout.md)） |
| 混入模式 | `L7904-7924` | `game.loadModeAsync("identity", callback)` 将 mode 导出的 `element/game/ai/ui/get` 挂载到全局单例 |
| 创建根事件 | **L7935** | `game.createEvent("game", false).setContent(exports.start)` → `_status.event = new GameEvent("game")` |

最终 `game.loop()`（L7956 或 L7960）触发 `_status.event.start()`，开始顺序执行 `identity.start` 数组中的 step 函数。

## 4. identity.start 数组（7 步）

`start: []` 数组定义在 `apps/core/mode/identity.js:10-472`，包含 7 个异步 step 函数，按索引顺序执行：

| Step | 行号 | 说明 |
|------|------|------|
| 0 | L11 | 新手向导检查，设置 `_status.mode = get.config("identity_mode")` |
| 1 | L42 | 录像回放处理；`game.prepareArena(num)` 创建玩家座位（`ui.create.players(N)` + `ui.create.me()` + `ui.arena.setNumber(N)`） |
| 2 | L76 | 新手向导交互流程（变更日志、教程等） |
| 3 | L175 | 联机模式设置（8 人固定）/ 本地身份列表处理 + `current.getId()` + `game.chooseCharacter()` |
| 4 | L268 | 身份展示、AI shown 初始化、主公增强技能分配 |
| 5 | L395-416 | `event.trigger("gameStart")`（**L416**）—— 标记游戏正式开始 |
| 6 | L455 | `game.gameDraw()` 发初始手牌（主公 N+1，其余 N） |
| 7 | L469 | `game.phaseLoop(event.beginner)` 进入阶段循环 |

> 数组索引即为 step 编号（从 0 开始）。每个 step 是 async 函数，由事件系统顺序 await 执行。

## 5. 完整调用链

```text
MenuView.vue :: onStartClick()
  ├─ game.saveConfig("mode", "identity")
  ├─ localStorage.setItem("directstart", "true")
  └─ game.reload()
       │
       ▼  (页面重载)
bootImpl()  [init/index.ts]
  ├─ 检测 directstart 标志
  ├─ importMode("identity")  [import.ts:46-57]
  │    ├─ import("/mode/identity.js")
  │    └─ game.import("mode", config)  → lib.mode.identity 注册
  └─ game.loop()
       │
       ▼
game.switchMode("identity")  [game/index.js:7781-7963]
  ├─ lib.init.layout(config.layout)     切换 layout CSS
  ├─ game.loadModeAsync()               mode exports mixin 到全局单例
  └─ createEvent("game").setContent(start)  [L7935]
       │
       ▼
identity.start[0..7]  [mode/identity.js:10-472]
  ① 新手向导检查（L11）
  ② game.prepareArena(N) → ui.create.players(N) + ui.create.me() + ui.arena.setNumber(N)（L42）
  ③ 新手向导交互（L76）
  ④ game.chooseCharacter()（L175）—— 选将 UI（详见 identity-card.md）
  ⑤ 身份分配 + 主公增强 + event.trigger("gameStart")（L268, L416）
  ⑥ game.gameDraw() 发牌（L455）
  ⑦ game.phaseLoop(event.beginner) 进入阶段循环（L469）
```

## 6. 关键边界：gameStart / gameDraw / phaseLoop

| 事件 | 行号 | 含义 |
|------|------|------|
| `event.trigger("gameStart")` | `identity.js:416` | 标记游戏正式开始，触发 `gameStart` 时机技能（`lib.skill` 中 `trigger: { global: "gameStart" }`）；同时发布 `Noname.Game.Event.GameStart`，设置 `_status.gameStarted = true`，显示牌堆按钮 |
| `game.gameDraw()` | `identity.js:455` | 发初始手牌：主公 N+1 张，其余玩家 N 张；内部创建 `gameDraw` 事件并按座次遍历发牌 |
| `game.phaseLoop(event.beginner)` | `identity.js:469` | 进入回合阶段循环（详见 [../game-startup-flow.md](../game-startup-flow.md)）：`phaseLoop → phase → phaseZhunbei/Judge/Draw/Use/Discard/Jieshu` |

## 修改指引

- **在 start 数组中插入新步骤**：在 `mode/identity.js:10-472` 的 `start` 数组中按位置插入新 step 函数。注意数组索引 = step 编号（从 0 开始），插入后下游 step 索引自动后移。
- **改启动流程**：step 函数是顺序异步执行，每个 step 内部可用 `event.goto(n)` 跳转到指定 step / `event.redo()` 重试当前 step。async content 的控制流见 [../async-guide.md](../async-guide.md)。
- **联机模式**：Step 3（L175）含联机分支，使用 `game.broadcast()` 同步，需注意联机环境下 `event.send()` / `_status.connectMode` 的差异。

## 相关文档

- [index.md](index.md)（身份场 UI 总览）
- [../game-startup-flow.md](../game-startup-flow.md)（游戏启动主线，所有模式共用）
- [../game-event/lifecycle.md](../game-event/lifecycle.md)（GameEvent 生命周期，理解 start/loop/step 机制）

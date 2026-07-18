# 菜单对话框代码索引

本文档整理游戏中「主菜单对话框」（顶部含「开始 / 选项 / 武将 / 卡牌 / 扩展 / 其它」六个标签页的弹窗）涉及的代码位置与职责，方便后续阅读或修改菜单时作为索引。

> 所有路径均相对于仓库根目录。
>
> **注意**：菜单已由 Vue 3 重写，旧版 DOM 实现（`menu/index.js` + `menu/pages/*`）已删除。当前唯一实现位于 `apps/core/noname/ui/create/menu/vue/`。

## 总览

```text
ui.create.menu()                 (ui/create/index.js:3101 / 3109，挂在 lib.onfree 或同步菜单直接调用)
  └─ menu(connectMenu)           (noname/ui/create/menu/vue/index.ts)
       ├─ 创建 .menu-container / .popup-container（全屏遮罩，点击空白关闭）
       ├─ createApp(MenuView).mount(menuContainer)        // 挂载 Vue 应用
       └─ 补接外部 API：ui.click.configMenu / connectMenu / menuTab / extensionTab / consoleMenu
            │
            ▼
       MenuView.vue                (menu/vue/components/MenuView.vue，菜单主组件)
       ├─ tab 栏 + 滑块            ← getTabDataMap(connectMenu)  (menu/vue/data/tabRegistry.ts)
       ├─ 左栏 .left.pane          ← LeftPaneItem 列表          (components/LeftPaneItem.vue)
       ├─ 右栏 .right.pane         ← 各 tab 的 menuData.getRightPane() 或自定义 rightPaneComponent
       └─ 启动按钮 .menubutton.round
```

核心目录：`apps/core/noname/ui/create/menu/vue/`

## 入口

| 文件 | 位置 | 说明 |
|------|------|------|
| `apps/core/noname/ui/create/index.js` | `2` | `import { menu } from "./menu/vue/index.js"` |
| `apps/core/noname/ui/create/index.js` | `3101` / `3109` | `ui.create.menu()` 的调用点：非同步菜单时挂进 `lib.onfree`，同步菜单（`game.syncMenu`）直接调用 |

## 装配层（`menu/vue/index.ts`）

菜单的容器创建与外部 API 桥接，容器导出（`menuContainer` / `popupContainer`）与旧版兼容。

| 名称 | 说明 |
|------|------|
| `menu(connectMenu)` | **菜单创建总入口**，可被多次调用（非联机菜单 + 联机菜单）。创建容器、挂载 `MenuView`、注册 `menuInits` 钩子（仅首次创建时执行一次，重复创建不重跑）、补接 `ui.click.*` API。`connectMenu` 为真时创建联机菜单（tab 变为「模式 / 武将 / 卡牌」） |
| `menuContainer` / `popupContainer` | 全屏遮罩 div（`.menu-container.hidden` / `.popup-container.hidden`），挂在 `ui.window`；后者承载下拉/弹出子菜单 |
| `clickContainer`（内部） | 点击遮罩关闭菜单：隐藏容器、`game.resume2()` 恢复游戏，或恢复联机状态 |
| `ui.click.configMenu` / `ui.click.connectMenu` | 打开/关闭（联机）菜单，切换时遍历执行 `menuUpdates` 刷新回调 |
| `ui.click.menuTab(tab)` | 按名称程序化切换 tab（经 `menuBridge.setActiveTab` 驱动 MenuView） |
| `ui.click.extensionTab(name)` / `ui.click.consoleMenu()` | 切到「扩展」/「其它」tab（经 `menuBridge`） |
| `ui.updateCharacterPackMenu` / `ui.updateCardPackMenu` | 动态加载包时的刷新回调数组，此处 push 对应 `refreshCharacterPack` / `refreshCardPack`；模块级稳定引用 + `includes` 去重注册，重复创建菜单不膨胀 |

## 主组件（`menu/vue/components/MenuView.vue`）

- tab 名列表来自 `getTabDataMap(connectMenu)`，保持插入顺序；`activeTab` + `activeLeftKey` 驱动左右栏。
- 左栏：`currentLeftPaneData`（优先用 `menuData.getLeftPaneData()` getter 以支持响应式刷新，过滤 `attrs.hidden` 项），点击经 `onLeftItemClick` 更新 `activeLeftKey`；`attrs.onClick` 的项（如帮助切换）直接执行回调。
- 右栏：两种渲染方式，二选一（见下节契约）：
  - `menuData.rightPaneComponent` 存在 → 渲染该自定义组件（如选项页 `OptionsRightPane`），传入 `:ctx="rightPaneCtx"`；
  - 否则 → 默认分支，用 `NonameConfig` 逐行渲染 `getRightPane(ctx)` 返回的配置项列表。
- 启动按钮 `.menubutton.round.highlight` 在 `.right.pane` 之外，引用经 `rightPaneCtx.startButtonEl` 传给数据层（用于 glowing 标记）。
- `onMounted` 时选中默认左栏项、定位 tab 滑块、对右栏 `lib.setScroll()`，并注册 `menuBridge` 回调；`onUnmounted` 时置空。
- **启动按钮** `.menubutton.round.highlight`（模板绑定 `@click="onStartClick"`）的 click handler 迁移自旧版 `pages/startMenu.js`，含 4 个分支：
  - 仅在模式 tab（`tabNames[0]`）点击有效，取 `activeLeftKey.value` 作 mode 名；
  - 联机 + `_status.waitingForPlayer`：广播房间配置（房主走 `game.send("changeRoomConfig")`，主机走 `game.broadcastAll` 同步 `lib.configOL` 并对身份局忠臣模式做 8 人修正）；
  - 联机 + `_status.enteringroom || _status.creatingroom`：`lib.configOL.mode = mode`，按 `enteringroomserver` 标志决定发完整配置还是简化版 `game.send("server", "create", ...)`；
  - 联机其他：保存 `directstartmode`、创建 `ui.exitroom` 退出按钮、`game.switchMode` + `game.requireSandboxOn`；
  - 非联机：`game.saveConfig("mode", ...)` + `localStorage` 置 `directstart=true` + `game.reload()`；
  - 运行时属性（`_status.*`、`lib.configOL`、`lib.connect*`、`game.online*` 等）通过函数开头的 `status` / `libAny` / `gameAny` 三个 `as any` 别名访问，避免逐行 `@ts-expect-error`。
- **对话框尺寸可调**：根 div 上设置 inline style（width/height + CSS 变量 `--menu-w` / `--menu-h`），尺寸从 `lib.config.menu_dialog_width` / `menu_dialog_height` 恢复。`onMounted` 中注册 `ResizeObserver` 监听根 div，拖拽过程中实时更新 CSS 变量（保证 `.center` 居中重算），300ms debounce 后 `game.saveConfig` 持久化。`onUnmounted` 中 `disconnect()` 清理。最小尺寸 320×240px（见 menu.css）。

## 尺寸与拉伸

- `.menu.main` 默认 400×300px，`resize: both` 允许右下角拖拽，最小 320×240px（`apps/core/layout/default/menu.css`）。
- 拖拽后的尺寸持久化到 `lib.config.menu_dialog_width` / `menu_dialog_height`，由 `MenuView.vue` 的 `ResizeObserver` 写入，打开菜单时通过根 div 的 inline style 恢复。
- 联机模式（`.center`）的居中定位用 CSS 变量 `var(--menu-w, 400px)` / `var(--menu-h, 300px)` 计算，随拉伸实时更新，保证对话框始终居中。
- 启动按钮 `.menubutton.round` 用 `right: 25px; bottom: 65px` 定位（与对话框尺寸解耦），拉伸后始终贴在右下角。

## ⚠ 右栏布局契约（踩坑记录）

右栏 CSS 有**两层契约**（`apps/core/layout/default/menu.css`），改右栏前必须同时满足。

### 第一层：`.right.pane` 三层结构（单包裹层）

```text
.right.pane                (menu.css:628，overflow: scroll)
  └─ > div  【包裹层】      (menu.css:634，position: absolute; top: 0)
       └─ .config  【配置行】(menu.css:655，position: relative + margin-top 竖排)
```

- `.right.pane` 的**每个直接子 div 都会被 absolute 定位到 `top:0`**。因此 `.right.pane` 下必须有且仅有一个包裹层 div，所有配置行放在包裹层内（`.config` 是 relative，靠 margin 逐行竖排）。
- **默认分支（开始/模式 tab）**：`MenuView.vue` 模板里 `<div v-else>` 就是那层包裹层，**不能省**。曾经写成 `<template v-else>`，导致每个 `NonameConfig` 配置行直接成为 `.right.pane` 的子元素，全部命中 absolute 定位重叠在一起（症状：右栏所有选项叠成一团）。
- **自定义右栏组件**（`OptionsRightPane` / `CharacterPackPane` / `CardPackPane` / `ExtensionPane` / `OtherPane`）：组件模板必须**自带单根元素**作为包裹层，同理不能多根。
- 新增自定义右栏组件或改动 `MenuView.vue` 默认分支时，务必保持此契约；样式改动同步检查 `menu.css` 的 `.right.pane > div` 相关规则。

### 第二层：`.menu-buttons` 内必须扁平

第一层只约束包裹层；卡牌页这类以 `.menu-buttons` 为根的右栏，包裹层**内部**还有一层契约：

- 全局规则 `div { display: inline-block; position: absolute }`（`apps/core/layout/default/layout.css:31-35`）；菜单内另有**后代选择器** `.menu-buttons div { position: absolute }`（menu.css:98-100，权重 (0,1,1)，压过 `.config { position: relative }` 的 (0,1,0)，见 menu.css:1100-1104）。
- 而复位规则全是**直接子代选择器**：`.menu-buttons > .toggle` / `.menu-buttons > .config.more(.pile)`（menu.css:125-144）、`.right.pane > div > .config`（menu.css:655）、卡名/花色缩放 `div:not(.handcards).menu-buttons > .button.card > .name/.info`（layout.css:1492-1507，含 `.card-pack-buttons` 包裹层变体）。
- 因此 `.menu-buttons` 内的一切配置行/按钮必须是其**直接子代**：任何无 class 包裹 div 自身会 absolute 脱流，其子树同时失去上述复位。
- **`display: contents` 例外**：命令式内容（如 `ui.create.buttons` 的卡牌网格）若必须有包裹容器，用 `display: contents` 消除其盒子——见 menu.css:146-150 的 `.menu-buttons > .card-pack-buttons` 规则；若原直挂选择器依赖 DOM 父子关系（如卡名缩放），需在 layout.css 同步补包裹层变体（layout.css:1500-1507）。
- **嵌套子组件用 fragment（多根）模板**（如 CardPileEditor / CardPileManager）：让其行直接渲染进父级 `.menu-buttons`。注意命令式插入父组件 DOM 的节点（rowNodes/pileNodes 数组跟踪）必须在 `onBeforeUnmount` 手动清理——Vue 卸载 fragment 时只清理模板节点，不会代为清理这些行。
- **踩坑**：卡牌页签曾因嵌套编辑器保留包裹层（无 class div / `.cardpile-manager`），导致牌堆配置行 absolute 脱流叠成一团、且丢失 margin 复位——本层契约即由此次修复确立。

## ⚠ 配置交互契约（数据驱动 + DOM 分叉）

配置项（switcher / toggle）有**两条渲染路径**，它们对 DOM 节点的 `_link` 字段与响应式假设不对齐，改 `configInteract.ts` / `NonameConfig.vue` / `configBuilder.ts` 前必须理解此契约。

### 两条路径

| 路径 | 使用方 | `config` 是否 reactive | `nodeEl._link` |
|------|--------|------------------------|----------------|
| **Vue 组件**（`NonameConfig.vue`） | 选项页、开始页等大多数配置（`optionsMenuData` / `startMenuData` 用 `reactive(get.copy(...))` 构造） | ✅ 是 | ❌ 组件模板**从不**给 configNodeRef 挂 `_link` |
| **命令式**（`configBuilder.ts:createConfig`） | `CharacterPackPane.vue` / `ExtensionPane.vue` | ❌ 否（裸对象） | ✅ `createConfig` 内 `node._link = { config }` 初始化 |

两条路径**共用** `configInteract.ts` 的 `doToggle` / `doMenuItem`。

### 三类陷阱（均由契约吸收）

1. **`nodeEl._link` 在 Vue 路径下为 undefined**：游戏源 `library/index.js` 的 onclick 有 40+ 处用 `this._link.config.mode`。`doToggle` / `doMenuItem` 开头**兜底** `if (!nodeEl._link) nodeEl._link = { config }`，为 Vue 路径补齐该字段。命令式路径下 `_link` 已存在，兜底不触发。

2. **DOM 操作会被 Vue 响应式覆盖**：直接 `nodeEl.lastChild.innerHTML = ...`（switcher）或 `classList.toggle("on")`（toggle）在 Vue 路径下会被下次重渲染按旧 `config.init` 回写，导致**显示回退**。因此 `doToggle` / `doMenuItem` 改为**数据驱动**：始终更新 `config.init`，DOM 操作用 `isReactive(config)` 分叉——
   - Vue 路径（`isReactive === true`）：**跳过所有 DOM 操作**，由 `NonameConfig.vue` 的 `choosingText` / `isToggleOn` computed 响应 `config.init` 自动重绘。
   - 命令式路径（`isReactive === false`）：保留与旧版逐字节一致的命令式 DOM 操作（`innerHTML` / `classList`）。

3. **回滚必须同步分叉**：onclick 返回 `false` 时，`config.init` 回滚无条件执行；DOM 回滚（`innerHTML = tmpName` / `classList.toggle("on")`）必须包在 `if (!reactive)` 内，否则 Vue 路径会误操作 DOM。

### 维护红线

- **新增 switcher / toggle 交互逻辑**：只能在 `configInteract.ts` 的 `doToggle` / `doMenuItem` 内加，且遵守"数据层无条件更新 + DOM 按 `isReactive` 分叉"模式。
- **改 `NonameConfig.vue` 的形态判定 / computed**：switcher 的当前值必须始终取自 `config.init`（经 `choosingText`），toggle 的 `.on` 必须始终取自 `config.init === true`（经 `isToggleOn`）；**不要**在组件内再做命令式 DOM 写入。
- **改 `configBuilder.ts` 的 toggle 分支**：初始化 `.on` class 必须用 `config.init === true`（严格相等，与 `NonameConfig.vue` 的 `isToggleOn` 一致），避免 truthy 非 bool 值（如 `1`、`"true"`）导致 DOM 与数据状态错位。
- **`config.init` 的语义**：toggle 项严格取 `true` / `false`；switcher 项取 `item` 对象的 key 之一。`isReactive` 是两条路径的唯一分叉判据，勿用其它标志（如 `config._vue` 等）。

## 配置项的下游行为（实例：`llm_thinking_effort`）

> **归属权衡**：本节描述的是配置值离开菜单后的**下游消费行为**，严格说属于 LLM 模块（`apps/core/noname/llm/`）而非菜单对话框本身。因其配置项从本菜单「选项-AI/LLM」消费，紧接上文契约节作为"值最终去了哪里"的实例参考收入。LLM 模块的完整行为以该模块代码为准。

「思考深度」（`llm_thinking_effort`，`library/index.js:5195-5204`，switcher 形态）的四个取值会被原样映射为 OpenAI 兼容 Chat Completions 接口的 `reasoning_effort` 字段。链路仅 3 个文件、无任何中间转换：

```
菜单选项 → lib.config.llm_thinking_effort → getLLMConfig().thinkingEffort → client.ts 构造 body → openai SDK client.chat.completions.create
```

### 取值 → 请求参数对照

| 菜单显示 | `llm_thinking_effort` | request body 的 `reasoning_effort` |
|----------|-----------------------|------------------------------------|
| 无 | `"none"` | **不传该字段** |
| 低 | `"low"` | `"low"` |
| 中（默认） | `"medium"` | `"medium"` |
| 高 | `"high"` | `"high"` |

### 关键代码

- `llm/index.ts:19`：`(lib.config.llm_thinking_effort as ...) || "medium"`——直接类型断言 + 默认回退，**无值校验**。
- `llm/client.ts:43-45`：唯一的转换逻辑——`none` 不传，其余原样赋给 `body.reasoning_effort`（顶层字段），通过 openai SDK 的 `client.chat.completions.create(body)`（`client.ts:47`）发送请求。
- `llm/client.ts:26-32`：openai SDK 初始化——`new OpenAI({ baseURL: config.url, ... })`，SDK 内部自动拼接 `/chat/completions` 等 endpoint 路径（见下节 `llm_url` 语义说明）。

### 注意点

- **字段语义绑定 OpenAI o1/o3 推理模型**：`reasoning_effort` 是 OpenAI 推理模型专用参数。非推理模型（GPT-4o、deepseek-chat 等）或其它厂商接口会忽略或报错；intro 里"非推理模型选「无」"正是为此——选 `none` 时**完全不传**该字段以规避。
- **不支持 Anthropic 风格 `thinking.budget_tokens`**：无法驱动 Claude extended thinking 类接口。
- **无任何联动**：不调整 `max_tokens` / temperature / context window。request body 固定字段为 `model` / `messages` / `tools` / `tool_choice`，加上可选的 `reasoning_effort`。
- **请求执行**：通过 openai SDK 的 `chat.completions.create` 发送（`client.ts:47`），SDK 接管了 HTTP 请求、鉴权（Bearer token）、超时及可配置重试（见菜单中的「最大重试次数」`llm_max_retries`，默认 0——即不重试，与旧版行为一致）。

### `llm_url` 语义（baseURL，非完整 endpoint）

> **破坏性变更**：`llm_url`（`library/index.js:5168-5176`，input 形态）的语义已从"完整 endpoint"改为"OpenAI 兼容 baseURL"。此变更源于 LLM 模块引入官方 openai SDK（`llm/client.ts:26-32`），SDK 以 `baseURL` 初始化 `new OpenAI({ baseURL })` 后，内部自动拼接 `/chat/completions`、`/responses` 等路径。

#### 正确 vs 错误示例

| 状态 | 值 | 说明 |
|------|----|------|
| ✅ 正确 | `https://api.openai.com/v1` | baseURL 格式；SDK 拼接为 `https://api.openai.com/v1/chat/completions` |
| ✅ 正确 | `http://localhost:11434/v1` | Ollama 等 OpenAI 兼容服务 |
| ❌ 错误（旧风格） | `https://api.openai.com/v1/chat/completions` | 旧版完整 endpoint；SDK 会拼接为 `.../chat/completions/chat/completions`，请求 404 |

#### 迁移说明

老存档中 `llm_url` 若仍保存完整 endpoint（含 `/chat/completions` 后缀），需手动更新——去掉末尾的 `/chat/completions`，只保留 baseURL 部分。否则 openai SDK 会将其当作 baseURL 再拼接一次路径，导致请求路径错误（404）。

#### CORS

浏览器模式需自建代理（CORS 限制），Electron 模式可直接使用——此限制与旧版一致（`library/index.js:5172` intro 文本）。

## 数据层（`menu/vue/types.ts` + `menu/vue/data/`）

### `menuData` 契约（`types.ts`）

每个 tab 提供一份 `menuData`，与 DOM 解耦：

| 字段 | 说明 |
|------|------|
| `leftPaneData` | 左栏数据源（`LeftPaneItem[]`，含 `name` / `key` / `attrs`） |
| `getLeftPaneData?` | 可选 getter，优先于 `leftPaneData`，用于响应式更新（如 togglePack 后刷新 `.off` 状态） |
| `getRightPane(ctx)` | 右栏配置项列表（`SelectConfigData[]`），`ctx` 含 `connectMenu` / 当前左栏选中项 / `startButtonEl` |
| `getDefaultActiveKey(connectMenu)` | 默认选中左栏项的 key，`null` 表示选第一个 |
| `rightPaneComponent?` | 右栏自定义 Vue 组件；未提供时走默认 `NonameConfig` 列表 |

> 注意与 `apps/core/typings/type.d.ts` 中旧版同名 `menuData` 区分（旧版耦合 DOM）。

### tab 注册与数据源（`data/tabRegistry.ts`）

`getTabDataMap(connectMenu)` 返回 `Map<tab名, menuData>`：

| Tab（非联机） | 数据源文件 | 右栏渲染 |
|------|------|----------|
| **开始**（联机时为**模式**） | `data/startMenuData.ts`（`createStartMenuData` 工厂） | 默认 NonameConfig 列表 |
| **选项** | `data/optionsMenuData.ts` | `OptionsRightPane.vue` |
| **武将** | `data/characterPackMenuData.ts` | `CharacterPackPane.vue` |
| **卡牌** | `data/cardPackMenuData.ts` | `CardPackPane.vue` |
| **扩展** | `data/extensionMenuData.ts` | `ExtensionPane.vue` |
| **其它** | `data/otherMenuData.ts` | `OtherPane.vue` |

## 组件清单（`menu/vue/components/`）

| 文件 | 说明 |
|------|------|
| `MenuView.vue` | 菜单主组件（见上） |
| `LeftPaneItem.vue` | 左栏单项 |
| `NonameConfig.vue` / `NonameToggle.vue` | 配置行 / 开关组件（默认右栏的渲染单元）。input 形态用 `<div contenteditable>`（`.config-input`），样式见 `apps/core/layout/default/menu.css`；`init` 为空时通过 `:empty::before` 显示占位符（取自模板的 `:data-placeholder="config.name"` 属性）。switcher 形态的当前选项由 `choosingText` computed（依赖 `config.init`）渲染，toggle 形态的 `.on` 由 `isToggleOn` computed（`config.init === true`）绑定——**二者均假设传入的 `config` 是 reactive**（见「配置交互契约」）。 |
| `PopupMenu.vue` | 弹出子菜单（下拉选项） |
| `OptionsRightPane.vue` / `CharacterPackPane.vue` / `ExtensionPane.vue` / `OtherPane.vue` | 各 tab 的自定义右栏（tab 级右栏组件均自带单根包裹层，见契约第一层） |
| `CardPackPane.vue` | 卡牌页右栏（tab 级组件，单根 `.menu-buttons.leftbutton`）：「开启」toggle 内嵌 `<NonameToggle />` 旋钮；包信息为 `<p v-html>` 直挂（p 非 div，天然在流内）；卡牌网格容器 `.card-pack-buttons`（`display: contents`，见契约第二层）；按左栏项内嵌 CardPileEditor / CardPileManager |
| `editors/CardPileEditor.vue` | 卡牌页牌堆编辑器，**fragment 多根**（各行渲染后即父级 `.menu-buttons` 的直接子代）：「编辑牌堆」折叠/展开（各行初始 `display:none`，与旧版一致）；defaultcards 行带 `div>div` 旋钮（`ui.create.div(ui.create.div(cfgnode))`，同 `utils/configBuilder.ts:285` 的 toggle 结构）；添加面板为纯 v-if；命令式创建的行以 rowNodes 跟踪并在 `onBeforeUnmount` 手动清理 |
| `editors/CardPileManager.vue` | 卡牌页「牌堆」左栏项视图，同为 **fragment 多根**：动态牌堆节点 `insertBefore` 到「重新启动」行锚点前；pileNodes 跟踪 + `onBeforeUnmount` 清理 |
| `editors/`（其余） | 扩展页内嵌编辑器：扩展制作（`extensionMaker/`）、文件管理、禁将方案、命令控制台、作弊面板、视频管理、扩展获取、信息页等 |

## 工具与共享状态（`menu/vue/utils/`、`menuState.ts`）

| 文件 | 说明 |
|------|------|
| `utils/menuBridge.ts` | `index.ts` 与 `MenuView` 的通信桥：`setActiveTab` / `setActiveLeftItem`，组件挂载时注册、卸载时置空 |
| `utils/configBuilder.ts` / `configAdapter.ts` | 配置项数据的构造与适配（`SelectConfigData` 等） |
| `utils/configInteract.ts` | 配置行交互（开关 `doToggle` / 切换器 `doMenuItem`）。**数据驱动 + DOM 分叉**：始终更新 `config.init`，按 `isReactive(config)` 决定是否操作 DOM（详见「配置交互契约」）。 |
| `utils/popupHost.ts` | 弹出子菜单的宿主定位（对应旧版 `openMenu`） |
| `menuState.ts` | 共享状态：`menuUpdates`（打开菜单时统一刷新）、`menuInits`（装配时执行的初始化钩子，避免 data 模块顶层副作用过早执行）、`updateActive` / `updateActiveCard`（武将/卡牌激活项更新） |

## 修改指引

- **改某个 tab 的内容/设置项**：编辑 `menu/vue/data/<对应>MenuData.ts` 的 `leftPaneData` / `getRightPane`；自定义右栏的交互改对应 `components/*Pane.vue`。
- **新增一个 tab**：在 `data/tabRegistry.ts` 的 `OFFLINE_TABS`（和/或 `ONLINE_TABS`）加入名称，新增 `data/xxxMenuData.ts` 实现 `menuData` 契约，并在 `getTabDataMap` 中挂接。
- **新增/修改右栏**：默认列表分支改 `MenuView.vue`（保持包裹层 div）；自定义组件务必单根（见「右栏布局契约」第一层）。在 `.menu-buttons` 内新增配置行/嵌套编辑器时，行必须直挂（嵌套子组件用 fragment + `onBeforeUnmount` 手动清理，见契约第二层）。
- **改菜单整体外观**：样式在 `apps/core/layout/default/menu.css`（选择器以 `.menu.main > .menu-content` 开头）；结构改 `MenuView.vue`。
- **弹出子菜单（下拉选项）行为**：看 `utils/popupHost.ts` 与 `components/PopupMenu.vue`。
- **外部代码驱动菜单**：用 `ui.click.menuTab` / `extensionTab` / `consoleMenu`（内部走 `menuBridge`），不要直接操作 DOM。

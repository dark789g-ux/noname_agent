# 菜单对话框代码索引

本文档整理游戏中「主菜单对话框」（顶部含「开始 / 选项 / 武将 / 卡牌 / 扩展 / 其它」六个标签页的弹窗）涉及的代码位置与职责，方便后续阅读或修改菜单时作为索引。

> 所有路径均相对于仓库根目录。

## 总览

```text
ui.create.menu()  (ui/create/index.js:3119)
  └─ menu()                              (noname/ui/create/menu/index.js:424)
       ├─ createMenu(tabs, config)       (noname/ui/create/menu/index.js:139)  // 生成弹窗外框 + 6 个 tab
       ├─ ui.create.startMenu()          (noname/ui/create/menu/pages/startMenu.js)
       ├─ ui.create.optionsMenu()        (noname/ui/create/menu/pages/optionsMenu.js)
       ├─ ui.create.characterPackMenu()  (noname/ui/create/menu/pages/characterPackMenu.js)
       ├─ ui.create.cardPackMenu()       (noname/ui/create/menu/pages/cardPackMenu.js)
       ├─ ui.create.extensionMenu()      (noname/ui/create/menu/pages/exetensionMenu.js)
       └─ ui.create.otherMenu()          (noname/ui/create/menu/pages/otherMenu.js)
```

核心目录：`apps/core/noname/ui/create/menu/`

## 入口

| 文件 | 位置 | 说明 |
|------|------|------|
| `apps/core/noname/ui/create/index.js` | `3119` / `3127` | `ui.create.menu()` 的真正调用点，挂在 `lib.onfree` 回调中（联机时直接调用） |
| `apps/core/noname/ui/create/index.js` | `877-889` | 把 `menu` 及各 `xxxMenu` 函数挂到 `ui.create.*` 上 |

## 菜单框架（`menu/index.js`）

菜单的创建、容器与交互逻辑都集中在 `apps/core/noname/ui/create/menu/index.js`。

### 容器与全局状态

| 名称 | 位置 | 说明 |
|------|------|------|
| `menuContainer` | `373` | 全屏 div（`.menu-container`），承载菜单栏本体；点击空白处关闭 |
| `popupContainer` | `380` | 全屏 div（`.popup-container`），承载下拉/弹出子菜单（如切换器展开的选项） |
| `menux` | `409` | `{ menu, pages }`，菜单 DOM 与各 tab 页数组 |
| `menuxpages` | `414` | `menux.pages` 的副本，各 page 函数内部用来取目标页 |
| `menuUpdates` | `419` | `Function[]`，打开菜单时统一调用的更新回调列表 |
| `updateActive` / `updateActiveCard` | `385` / `397` | 武将/卡牌菜单的激活项更新函数（由对应 page 通过 setter 注入） |

### 关键函数

| 函数 | 位置 | 说明 |
|------|------|------|
| `menu(connectMenu)` | `424` | **菜单创建总入口**。创建 `menuContainer`/`popupContainer`，调用 `createMenu()` 生成框架，再依次调用各 `xxxMenu()` 填充内容（`518-535`）。`connectMenu` 为真时创建联机菜单 |
| `createMenu(connectMenu, tabs, config)` | `139` | 生成弹窗外框（`.main.menu.dialog.popped.static`）、顶部 tab 栏（`.menu-tab`）、tab 滑块（`.menu-tab-bar`）、内容区（`.menu-content`），并为每个 tab 创建空的双栏 page。返回 `{ menu, pages }` |
| `clickTab`（createMenu 内） | `160` | tab 点击：切换 active、移动滑块、把对应 page 挂到内容区 |
| `ui.click.menuTab(tab)` | `174` | 按名称（如 `"选项"`）程序化切换 tab |
| `ui.click.configMenu` | `455` | 打开/关闭「选项」菜单的回调（非联机） |
| `ui.click.connectMenu` | `476` | 打开/关闭联机菜单的回调 |
| `openMenu(node, e, onclose)` | `3` | 在 `popupContainer` 里定位并显示一个弹出子菜单（计算 `top`/`left`、处理手机布局缩放） |
| `clickContainer(connectMenu)` | `103` | 点击遮罩/空白关闭菜单：隐藏容器、恢复游戏（`game.resume2()`）或联机状态 |
| `createConfig(config, position)` | `193` | **配置项渲染器**，把一个 config 描述对象渲染成 `.config` DOM 节点；所有页面里的设置项都通过它生成 |

### 配置项类型与 `createConfig`

`createConfig` 接收一个 `config` 对象，常见字段：

- `config.name`：显示名（如「屏蔽弱将」）
- `config.item`：下拉/切换器的可选项映射（`{ 值: 显示文本 }`）
- `config.onclick`：点击回调，返回 `false` 可撤销操作
- `config.update`：状态变更后的刷新回调
- `config.init`：默认选中项索引
- `config.clear`：是否清空类标记
- `config.intro`：说明文本

相关交互函数：`clickToggle`（`39`，开关型）、`clickSwitcher`（`54`，下拉型，会调用 `openMenu` 展开选项）、`clickMenuItem`（`124`，选项点击）。

## 各标签页

每个 tab 页都是一个函数 `xxxMenu(connectMenu)`，在 `menu()` 中通过 `ui.create.xxxMenu()` 调用，负责把内容填进 `menux.pages[对应索引]` 的左右两栏。它们统一从 `../index.js` 导入框架工具（`createConfig`、`openMenu` 等）。

| Tab | 文件 | 行数 | 导出函数 |
|-----|------|------|----------|
| **开始** | `menu/pages/startMenu.js` | 395 | `startMenu(connectMenu)` |
| **选项** | `menu/pages/optionsMenu.js` | 1091 | `optionsMenu(connectMenu)` |
| **武将** | `menu/pages/characterPackMenu.js` | 514 | `characterPackMenu(connectMenu)` |
| **卡牌** | `menu/pages/cardPackMenu.js` | 691 | `cardPackMenu(connectMenu)` |
| **扩展** | `menu/pages/exetensionMenu.js` | 2704 | `extensionMenu(connectMenu)`（注意文件名拼为 `exetension`） |
| **其它** | `menu/pages/otherMenu.js` | 1102 | `otherMenu(connectMenu)` |

各页函数返回的「更新函数」（如武将页返回的 `updateCharacterPackMenu`）会被推入 `ui.updateCharacterPackMenu` / `ui.updateCardPackMenu` 或 `menuUpdates`，在菜单打开或包数据变化时重新刷新。

## 配置项模板与组件

| 文件 | 说明 |
|------|------|
| `menu/nonameConfig.js` | 配置项的 Vue 组件与模板。导出 `NonameToggle`（开关组件）、`NonameConfig`（通用配置组件）、`menuConfigTemplate`（菜单配置模板） |

## 新版 Vue 菜单（开发中）

| 文件 | 说明 |
|------|------|
| `menu/views/index.vue` | 用 Vue 3 重写的菜单组件，顶部 tab 同样是六个标签。目前除「开始」外其余 tab 都临时映射到 `startMenuData`（占位），尚未完全接管 |
| `menu/startMenu.js`（根目录下，非 pages） | 新版「开始」页的数据源：导出 `startMenutabName`（`"开始"`）与 `startMenuData`（含 `leftPaneData`/`rightPaneApps`/`configDatas`），供 Vue 版菜单消费 |
| `menu/new.js` | 新版菜单的通用构造逻辑，导出 `defaultTemplate` 与 `menu(connectMenu, template, props)` |

> 当前实际生效的仍是 DOM 版（`menu/index.js` + `pages/*`）。Vue 版为未来的重写方向。

## 修改指引

- **改某个 tab 的内容/设置项**：编辑 `menu/pages/<对应页>.js`，找到该页往左右栏填内容的逻辑（通常用 `createConfig`）。
- **新增一个 tab**：在 `createMenu` 的 `tabs` 数组（`menu/index.js:470`）加入名称，新增 `pages/xxxMenu.js` 导出函数，在 `ui/create/index.js` 导入并挂到 `ui.create.xxxMenu`，最后在 `menu()`（`index.js:518-535`）调用。
- **改菜单整体外观/交互**：编辑 `menu/index.js` 的 `createMenu` 及容器相关逻辑，样式类见 `.main.menu.dialog.popped.static`、`.menu-tab`、`.menu-content`、`.left.pane`/`.right.pane`。
- **弹出子菜单（下拉选项）行为**：看 `openMenu`（`3`）与 `clickSwitcher`（`54`）。
- **配置项的渲染与交互**：看 `createConfig`（`193`）+ `nonameConfig.js`。

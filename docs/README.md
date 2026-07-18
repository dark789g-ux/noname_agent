# 无名杀文档索引

本目录是面向贡献者的文档库。下方按主题分组，并附「按场景快速定位」表，帮你找到该读哪一篇。

## 按场景快速定位

| 我想…… | 读这篇 |
|--------|--------|
| 把项目跑起来、搭环境、打包 | [how-to-start.md](./how-to-start.md) |
| 写一个新技能 / 查 `lib.skill` 字段 | [lib-skill-format.md](./lib-skill-format.md) |
| 学会用 async 写法写技能 content | [async-guide.md](./async-guide.md) |
| 把旧的 step 写法技能迁移为 async | [step-to-async-guide.md](./step-to-async-guide.md) |
| 理解游戏从启动到对局主循环的流程 | [game-startup-flow.md](./game-startup-flow.md) |
| 排查技能不触发 / 触发顺序 / 事件执行顺序问题 | [game-event/](./game-event/index.md)（事件系统专题） |
| 读 `gameEvent.ts` 源码时反查某方法属于哪个机制 | [game-event/source-mapping.md](./game-event/source-mapping.md) |
| 给技能/武将配语音、写台词翻译 | [audio-guide.md](./audio-guide.md) |
| 给武将做换原画（多形态）/ 换肤 | [skin-guide.md](./skin-guide.md) |
| 修改主菜单弹窗（开始/选项/武将/卡牌/扩展） | [menu-dialog.md](./menu-dialog.md) |
| 改身份场游戏界面（启动链路/Player DOM/身份牌/布局/配置项） | [identity-ui/](./identity-ui/index.md) |

## 入门

- **[how-to-start.md](./how-to-start.md)** — 《如何运行无名杀》：Node.js 与 pnpm 环境要求、`pnpm install` / `pnpm dev` / `pnpm build` / `pnpm lint` 等常用命令、Electron 本地打包与本地联机服务器的 Q&A。新贡献者第一篇阅读。

## 技能开发

三篇配合阅读：字段速查 → async 写法入门 → 旧写法迁移手册。

- **[lib-skill-format.md](./lib-skill-format.md)** — 《lib.skill 格式速查》：技能对象的字段参考。`trigger` 时机写法、`cost` 与 `content`、主动技选择字段（`filterCard`/`selectTarget` 等）、`viewAs`、`mod`、`group`/`subSkill`、标记（`mark`/`intro`）、`ai` 字段，并附 5 套技能模板。写技能前的第一参考。
- **[async-guide.md](./async-guide.md)** — 《Async 章节》：`Async Content` 写法入门教程。`async`/`await` 概念、与 Step Content 的对比、`forResult()` 取结果、`event.finish`/`goto`/`redo` 的替代写法（`return`/循环）、`delay` 等实战细节。适合 JS 异步基础薄弱的扩展作者。
- **[step-to-async-guide.md](./step-to-async-guide.md)** — 《Step Content 转 Async Content 指南》：旧 step 写法 → async 写法的迁移操作手册。三种 content 形式与编译链、核心区别对照表、不能 `await` 的改挂事件专题（`insertAfter`/`showCharacter`/`changeZhuanhuanji` 等）、6 条转换规则 + 5 个完整转换例、检查清单与常见坑。

## 引擎机制

- **[game-startup-flow.md](./game-startup-flow.md)** — 《游戏启动到进行时流程速查》：从 `index.html` 到对局主循环 `phaseLoop` 的完整主线。`entry.ts` 平台分支、`boot()` 初始化、模式加载与 mixin、`ui.create.arena()`、身份模式 start 主线（chooseCharacter → gameStart → phaseLoop）、六个标准阶段、技能如何经 `trigger(name)` 穿插进流程。改启动流程/模式/阶段事件时必读。

### game-event/ —— 事件系统专题（10 篇）

游戏中一切行为都是 GameEvent。系列组织严密，以 [index.md](./game-event/index.md) 为总纲与导航枢纽，内部有显式的依赖标注。

推荐阅读顺序（新手）：`index.md` → `interaction.md` → `lifecycle.md` → `trigger.md` → `relationships.md` → `content.md`。

- **[index.md](./game-event/index.md)** — 事件系统总纲：事件树概念、三种 content 写法推荐度、五模块架构图、按场景的阅读指引。接触事件系统的第一站。
- **[interaction.md](./game-event/interaction.md)** — 外部交互：GameEvent 的对外合约面。`set`/`then`/`forResult`/`send` 接口、常用参数属性表（`player`/`targets`/`card`/`num` 等）、`result` 与 `cost_data`、联机发送。写 content 时查"事件上能读/写什么"。
- **[lifecycle.md](./game-event/lifecycle.md)** — 内部生命周期：单个事件从 `start()` 到结束的状态机。`_triggered` 0–5 状态表（对应 XXXBefore/Begin/Omitted/End/After 时机）、`loop()` 主循环、`checkSkipped()`、`finish()`/`cancel()` 中断语义。
- **[trigger.md](./game-event/trigger.md)** — Trigger 触发系统：技能与事件之间的桥梁。`trigger(name)` 六步流程、`lib.relatedTrigger` 共联时机、`arrangeTrigger` 优先级分组与执行流程、`addTrigger`/`removeTrigger` 动态增删。写触发技、排查技能不触发/顺序问题时必读。
- **[relationships.md](./game-event/relationships.md)** — 事件关系：事件树结构与时序调度。`parent`/`childEvents`、`next` 串行队列与 `after` 延迟队列、`insert`/`insertAfter`、`waitNext()`、`_status.event` 指针与事件栈，附"出牌→触发技能"完整执行示例。调试事件流时重点读。
- **[content.md](./game-event/content.md)** — Content 编译系统：三种 content 写法统一编译为 `(event) => Promise<void>` 的机制。`ContentCompiler` 门面、AsyncCompiler/ArrayCompiler（唯一执行引擎）、共享钩子；**附录收录已废弃的 Step 语法与数组写法**及迁移路线——做 step→async 迁移时配合 [step-to-async-guide.md](./step-to-async-guide.md) 阅读。
- **[chooseToUse.md](./game-event/chooseToUse.md)** — chooseToUse（待重构）：技能出牌/选目标时筛选配置的备份-恢复机制（`event.custom`/`backup`/`restore`）。改 chooseToUse 交互、viewAs 选牌逻辑出问题时读。
- **[source-mapping.md](./game-event/source-mapping.md)** — `gameEvent.ts` 方法/属性归属映射速查表：每个成员归属于哪篇模块文档。读源码时的反查工具。
- **[cache.md](./game-event/cache.md)** — ⚠️ 已废弃存档：事件级步骤缓存（stepCache/tempCache）。新代码勿用，仅维护旧代码时查阅。
- **[eventHandlers.md](./game-event/eventHandlers.md)** — ⚠️ 已废弃存档：旧式全局回调注册机制（`game.globalEventHandlers`、`onXxx` 钩子）。仅解读旧代码时查阅。

## 素材（音频与皮肤）

- **[audio-guide.md](./audio-guide.md)** — 《Audio 章节》：技能/阵亡音频约定。`audio` 属性格式（`true`/数字/引用字符串/`ext:` 路径/数组组合）、`:` 分隔符易错点、台词配对规则（`#[音频地址][:后缀]` 键）、`audioname`/`audioname2`、`dieAudios` 与 `die:` 前缀。
- **[skin-guide.md](./skin-guide.md)** — 《skin 章节》：两套机制——`lib.characterSubstitute` 换原画（多形态武将）与 `player.changeSkin()` 换肤，含原画/阵亡语音路径写法与多个实战用例；「本体换肤」为半废弃机制，慎用。

## UI

- **[menu-dialog.md](./menu-dialog.md)** — 《菜单对话框代码索引》：主菜单弹窗（开始/选项/武将/卡牌/扩展/其它六 tab，Vue 3 实现）的代码地图。`ui.create.menu()` 调用链、装配层与 `MenuView.vue`、右栏布局 CSS 契约、`menuData` 数据契约与 tab 注册表、组件清单与修改指引。改动主菜单前必读。
- **[identity-ui/](./identity-ui/index.md)** —— 《身份场游戏界面代码索引》：身份场（mode=identity）UI 相关代码的子目录（5 份文档）。启动链路（MenuView → switchMode → identity.start）、Player DOM 结构（buildNode/buildExtra 子节点）、身份牌渲染与 4 子模式差异（标准/明忠/谋攻/3v3v2，含 25 个 data-color 颜色全表）、布局主题与 identity 配置块（L5773-6676）。改身份场 UI 前必读。

## 备注

- 仓库根目录的 [AGENTS.md](../AGENTS.md) 引用了其中 8 篇作为「修改玩法前必读」：lib-skill-format、async-guide、step-to-async-guide、game-event 的 content/lifecycle/trigger、game-startup-flow、audio-guide、skin-guide。
- 各文档时效性不同：如发现文档与代码不一致，以代码为准并欢迎提 PR 修正。

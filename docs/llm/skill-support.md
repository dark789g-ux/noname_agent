# 标准包与界限突破技能适配

本次固定范围为 `standard/character.js` 的 33 名武将，以及 `refresh/sort.js` 中 `refresh_standard` 的 29 名武将。标准包覆盖可选决策；界限突破覆盖主动技能和必要后续流程。技能名单由 `noname/llm/support-scope.ts` 固定，测试加载真实武将、技能模块并展开 `group`、`subSkill` 和觉醒获得关系核对。

## 执行与审核契约

- 显式 `selectionSpec`（`true` / 对象 / 函数）保持最高优先级并继续执行严格审核契约；`selectionSpec: false` 显式禁止 LLM 使用对应技能、事件或移动；`selectionSpec === undefined` 自动进入通用引擎推导路径。
- `true` 使用已审核的普通选牌、目标和视为牌规则；未声明 `selectionSpec` 的主动技能、`viewAs`/装备技能（如丈八蛇矛）、`chooseButton.backup`（含无 `viewAs` 的纯技能确认与额外目标）、`_recasting`、零目标重铸切换、`singleCard + filterAddedTarget`、`complexSelect`/`complexTarget`/`changeTarget` 及未自定义 `filterMove` 的 `chooseToMove`/`chooseToMove_new` 均由 `generic-skill-plan.ts` 与 `legacy-bridge.ts` 通用承接。
- 通用路径对读取 `ui.selected`、`_status.event` 与 `event._backup` 的传统过滤器通过 `withVirtualSelection` 提供同步虚拟上下文并在 `finally` 中完整恢复；通用单项失败隔离到 `skippedActions`，仅显式 `selectionSpec` 报错或强制事件零可执行动作时回退原生 AI。
- 动态步骤在前一步完成后生成；短引用按对象身份保持稳定，会前校验与提交前 `revalidate()` 继续在实时事件上严格重验，且不会自动放宽。
- 观星、恂恂、攻心及等量交换类（`"swap"`）事件使用显式 `move` 声明（`"swap"` 强校验各堆保持初始张数并允许任意 `>= 1` 堆）；其余未设置 `selectionSpec: false` 且无自定义 `filterMove`（引擎默认占位函数会通过内部 Symbol 自动识别放行）的 `chooseToMove`/`chooseToMove_new` 可由通用移动会话完成守恒分堆并运行 `filterOk`。
- 每个子事件按实际决策者重新建立私有上下文。他人区域的 `blank` 按钮、`x`/`s` 扩展区未明置且未对当前角色公开的牌均只输出匿名数量，不泄露牌面内容。
- 已提交的技能效果继续由原引擎结算；后续模型失败只回退当前未提交选择，不重跑父技能。日志的 `traceId`、`skill` 和 `automatic_steps` 用于区分关联选择与引擎自动推进。
- 提示包含当前判定牌、触发来源及实际可见的材料牌信息；已经选定的 backup 若只剩自动步骤，由引擎直接完成，日志记录 `execution: "automatic"`，不增加模型请求。

## 配置

启用 LLM 即允许多轮选择。旧 `llm_multi_turn: false` 不再限制决策；菜单已移除此开关。默认最多 4 次请求，保存的 1–8 轮预算、单次请求超时、决策总超时继续生效。服务端拒绝多轮工具消息时仍安全回退。

## 模块职责

| 位置                                                     | 职责                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------- |
| `noname/library/element/content.ts`                      | 保留原事件注册顺序的组合入口                                                |
| `noname/library/element/content/`                        | 按事件职责组合；`useCard` 保留步骤数组顺序；移动 UI 分离批量移动和拖拽状态  |
| `character/refresh/skill.js`、`character/extra/skill.js` | 保留原路径和默认导出，组合技能组对象                                        |
| `character/*/skills/`                                    | 原技能定义及少量显式选择契约，保持原技能对象身份                            |
| `noname/llm/decision-selection.ts`                       | 稳定引用、动态步骤、自动步骤、过滤、检查点回滚与最终校验                    |
| `noname/llm/legacy-bridge.ts`                            | `withVirtualSelection` 同步桥接 `ui.selected`、`_status.event` 与 `_backup` |
| `noname/llm/generic-skill-plan.ts`                       | `selectionSpec` 优先级、复杂目标标志识别与通用技能步骤推导                  |
| `noname/llm/prompt-state-extras.ts`                      | 标记、扩展区/特殊区隐私边界与转换/限定/觉醒技能状态采集                     |
| `noname/llm/apply.ts`                                    | 技能、响应、直接选择与 backup 结果生成                                      |
| `noname/llm/move-session.ts`                             | 显式及通用（无自定义 `filterMove`）分堆、排序与守恒协议                     |
| `noname/llm/support-scope.ts`                            | 固定范围、决策节点与觉醒获得关系                                            |
| `noname/llm/testing/`                                    | 真实模块装载、模拟模型流程、WebSocket 控制归属检查、浏览器冒烟及 500 行检查 |

入口、实现、类型、受影响测试和检查器均受 500 个物理行限制，空行和注释计入。范围由 `testing/code-scope.json` 与新增目录递归清单组成，避免将执行前已有的无关修改纳入重构。超限报告路径和实际行数。

## 验证层次

本次执行的命令结果、类型基线对比和浏览器实测边界见 [验证记录](skill-support-validation.md)。

`test:llm-skills` 对 30 个不同的范围内主动技能 ID 使用真实声明运行候选生成、阶段选择和结果校验；另对已有 7 个适配技能回归。支持清单的存在与进入候选分别验证，不以原生 AI 回退作为成功。

完整流程测试还包含鬼才与流离的代价选择、义绝黑红分支、荐言和势斩。完整流程测试包括激将、护驾的席位顺序及全部拒绝，遗计的重复分配与守恒，反间的决策归属与匿名手牌，攻心结算，以及勤学、潜心的获得顺序。分堆与有序校验另覆盖观星、恂恂、离间、过期引用、取消和非法提交。预算测试验证超轮次、超时及截止时间之后到达的响应不会提交。

结构迁移保留原断言；需要检查可序列化广播函数的旧测试，从真实装载的导出生成检查源，不再依赖大文件布局。开局发牌和换手牌另以整段真实事件函数执行。

启动冒烟页为 `/noname/llm/testing/game-smoke.html`，仅在该页内关闭 LLM 并屏蔽模型请求，不保存配置。

浏览器入口：开发服务启动后打开 `/noname/llm/testing/browser-smoke.html`。该页加载真实技能、校验器、工具与 OpenAI SDK，仅在页面内模拟响应，不访问外部模型服务或保存配置。

联机自动化测试验证真实主机选择事件调用模型、经本机 WebSocket 传递结果，以及远端结果恢复不重复调用模型；不等同于双浏览器完整联机对局或断线重连实测。原生 Electron、Android、Safari 和双浏览器完整对局尚需独立实测。

## 支持矩阵

以下清单由执行时的真实模块展开核对。`active` 表示显式主动选择契约；`decision` 表示标准包已审核的可选节点；`automatic` 表示本期范围内由引擎结算或随技能关联展开的节点。界限突破的非主动节点不因此被扩大为本期全部触发决策承诺。

### standard

| 技能 ID           | 武将          | 审核范围  | 决策与后续流程                                                |
| ----------------- | ------------- | --------- | ------------------------------------------------------------- |
| `stdxiaoguo`      | std_yuejin    | decision  | chooseToDiscard → chooseToDiscard                             |
| `xunxun`          | old_re_lidian | decision  | chooseBool → chooseToMove                                     |
| `wangxi`          | old_re_lidian | decision  | chooseBool                                                    |
| `stdshushen`      | ganfuren      | decision  | chooseTarget → chooseDrawRecover                              |
| `shenzhi`         | ganfuren      | decision  | chooseBool                                                    |
| `stdkuangfu`      | std_panfeng   | decision  | chooseBool → discardPlayerCard → chooseBool → chooseUseTarget |
| `stdkuangfu_used` | std_panfeng   | automatic | 引擎自动结算／关联节点                                        |
| `jianxiong`       | caocao        | decision  | chooseBool                                                    |
| `hujia`           | caocao        | decision  | chooseBool → chooseToRespond                                  |
| `fankui`          | simayi        | decision  | chooseBool → gainPlayerCard                                   |
| `guicai`          | simayi        | decision  | chooseCard                                                    |
| `ganglie`         | xiahoudun     | decision  | chooseBool → chooseToDiscard                                  |
| `tuxi`            | zhangliao     | decision  | chooseTarget → gainPlayerCard                                 |
| `luoyi`           | xuzhu         | decision  | chooseBool                                                    |
| `tiandu`          | guojia        | decision  | chooseBool                                                    |
| `yiji`            | guojia        | decision  | chooseBool → chooseButton → chooseTarget                      |
| `luoshen`         | zhenji        | decision  | chooseBool                                                    |
| `qingguo`         | zhenji        | active    | 黑色手牌 → 闪响应                                             |
| `rende`           | liubei        | active    | 选手牌 → 其他角色 → 交给 → 达到两张后的回复                   |
| `jijiang`         | liubei        | active    | 杀目标 → jijiang1 → 蜀势力依次 chooseToRespond                |
| `jijiang1`        | liubei        | automatic | 引擎自动结算／关联节点                                        |
| `wusheng`         | guanyu        | active    | 红色材料 → 杀 → 动态目标／响应                                |
| `paoxiao`         | zhangfei      | automatic | 引擎自动结算／关联节点                                        |
| `guanxing`        | zhugeliang    | decision  | chooseBool → chooseToGuanxing → chooseToMove                  |
| `kongcheng`       | zhugeliang    | automatic | 引擎自动结算／关联节点                                        |
| `kongcheng1`      | zhugeliang    | automatic | 引擎自动结算／关联节点                                        |
| `longdan`         | zhaoyun       | automatic | 引擎自动结算／关联节点                                        |
| `longdan_sha`     | zhaoyun       | active    | 闪材料 → 杀 → 目标／响应                                      |
| `longdan_shan`    | zhaoyun       | active    | 杀材料 → 闪响应                                               |
| `longdan_draw`    | zhaoyun       | automatic | 引擎自动结算／关联节点                                        |
| `mashu`           | machao        | automatic | 引擎自动结算／关联节点                                        |
| `tieji`           | machao        | decision  | chooseBool                                                    |
| `jizhi`           | huangyueying  | decision  | chooseBool                                                    |
| `qicai`           | huangyueying  | automatic | 引擎自动结算／关联节点                                        |
| `zhiheng`         | sunquan       | active    | 任意张材料 → 弃置 → 等量摸牌                                  |
| `jiuyuan`         | sunquan       | automatic | 引擎自动结算／关联节点                                        |
| `qixi`            | ganning       | active    | 黑色材料 → 过河拆桥 → discardPlayerCard                       |
| `keji`            | lvmeng        | decision  | chooseBool                                                    |
| `kurou`           | huanggai      | active    | 失去体力 → 摸牌                                               |
| `yingzi`          | zhouyu        | decision  | chooseBool                                                    |
| `fanjian`         | zhouyu        | active    | 目标 → 目标 chooseControl 花色 → gainPlayerCard → 花色结算    |
| `guose`           | daqiao        | active    | 方块材料 → 乐不思蜀 → 合法目标                                |
| `liuli`           | daqiao        | decision  | chooseCardTarget                                              |
| `qianxun`         | luxun         | automatic | 引擎自动结算／关联节点                                        |
| `lianying`        | luxun         | decision  | chooseBool                                                    |
| `xiaoji`          | sunshangxiang | decision  | chooseBool                                                    |
| `jieyin`          | sunshangxiang | active    | 两张手牌 → 受伤男性 → 双方回复                                |
| `qingnang`        | huatuo        | active    | 一张手牌 → 受伤角色 → 回复                                    |
| `jijiu`           | huatuo        | active    | 回合外红色材料 → 桃 → 救援目标                                |
| `wushuang`        | lvbu          | automatic | 引擎自动结算／关联节点                                        |
| `wushuang1`       | lvbu          | automatic | 引擎自动结算／关联节点                                        |
| `wushuang2`       | lvbu          | automatic | 引擎自动结算／关联节点                                        |
| `lijian`          | diaochan      | active    | 一张代价牌 → 两名有序男性目标 → 决斗 → 杀响应                 |
| `biyue`           | diaochan      | decision  | chooseBool                                                    |
| `yaowu`           | huaxiong      | decision  | chooseDrawRecover                                             |
| `reyicong`        | gongsunzan    | automatic | 引擎自动结算／关联节点                                        |
| `xinfu_jijie`     | xf_yiji       | active    | 查看牌堆底牌 → chooseTarget → 交给                            |
| `xinfu_jiyuan`    | xf_yiji       | decision  | chooseBool                                                    |
| `rewangzun`       | re_yuanshu    | automatic | 引擎自动结算／关联节点                                        |
| `retongji`        | re_yuanshu    | decision  | chooseToDiscard                                               |

### refresh

| 技能 ID          | 武将             | 审核范围 | 决策与后续流程                                                                    |
| ---------------- | ---------------- | -------- | --------------------------------------------------------------------------------- |
| `ollongdan`      | re_zhaoyun       | active   | 合法杀闪桃酒材料 → 相应视为牌 → 动态目标／响应                                    |
| `new_rewusheng`  | re_guanyu        | active   | 红色或主公技允许的材料 → 杀 → 目标／响应                                          |
| `new_yijue`      | re_guanyu        | active   | 弃一牌 → 目标 chooseCard 展示 → 黑色封锁／红色 chooseBool 回复                    |
| `refanjian`      | re_zhouyu        | active   | 材料交给目标 → 目标选项 → 展示弃牌／失去体力                                      |
| `gongxin`        | re_lvmeng        | active   | 由 qinxue 获得；有手牌的目标 → 查看手牌 → chooseToMove_new → 红桃弃置／置顶       |
| `qixi`           | re_ganning       | active   | 黑色材料 → 过河拆桥 → discardPlayerCard                                           |
| `reguose`        | re_daqiao        | active   | 方块材料 → 延后目标 → 移除乐不思蜀／使用乐不思蜀 → 摸牌                           |
| `rekurou`        | re_huanggai      | active   | 弃牌 → 失去体力 → 诈降后续                                                        |
| `jijiu`          | re_huatuo        | active   | 回合外红色材料 → 桃 → 救援目标                                                    |
| `new_reqingnang` | re_huatuo        | active   | 弃牌 → 未被标记的受伤目标 → 回复 → 黑牌禁用后续                                   |
| `rerende`        | re_liubei        | active   | 材料 → 未给过的目标 → 交给 → chooseButton 基本牌 → chooseUseTarget                |
| `rejijiang`      | re_liubei        | active   | 杀目标 → rejijiang1 → 蜀势力依次 chooseToRespond → 次数后续                       |
| `lijian`         | re_diaochan      | active   | 一张代价牌 → 两名有序男性目标 → 决斗 → 杀响应                                     |
| `rezhiheng`      | re_sunquan       | active   | 材料 → 弃置 → 摸牌与全手牌奖励                                                    |
| `rejieyin`       | re_sunshangxiang | active   | 材料 → 延后男性目标 → chooseControl 装备／弃置 → 摸牌与回复                       |
| `qingguo`        | re_zhenji        | active   | 黑色手牌 → 闪响应                                                                 |
| `shizhan`        | re_huaxiong      | active   | 可对自己使用决斗的其他角色 → 目标对自己使用决斗 → 杀响应                          |
| `jianyan`        | re_xushu         | active   | 由 qianxin 获得；chooseControl 颜色／类别 → 检索并展示 → chooseTarget 男性 → 交给 |

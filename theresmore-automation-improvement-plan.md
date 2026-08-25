# Theresmore Automation 改进调研与设计建议

## 结论

当前 Theresmore Automation 的核心问题不是自动点击能力弱，而是决策模型太静态。它要求玩家为建筑、人口、军队等项目提前填 max 和 priority；但 Theresmore 的最优目标会随声望、传承、时代、路径、解锁科技、资源瓶颈变化而频繁变化，所以手动维护配置很累。

更好的方向是：保留现有脚本的导航、按钮识别、点击、资源读取、战斗计算等能力，在建筑自动化前加一层“动态目标规划器”。用户只选策略模式，例如“稳健推进”“冲声望”“冲科技”“冲遗产点”“低维护挂机”，脚本实时计算每个建筑当前应该建到多少。

## 本地脚本现状

本地文件：

`C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\Theresmore-Automation_4.14.4_加入汉化json版_2次修改版_修复空配置.js`

关键观察：

- 脚本版本是 `4.14.4`，来源是 Theresmore Automation 打包用户脚本。
- 配置保存在浏览器 `localStorage`，前缀为 `TA_`，主要配置键是 `TA_options`。
- 建筑自动化通过 `state.options.pages.Build.subpages[City/Colony/Abyss].options` 保存。
- 每个建筑有两个关键值：
  - `building_id`: max，`0` 表示不建，`-1` 表示近似无限，正数表示建到指定数量。
  - `prio_building_id`: priority，数值越高越优先。
- 建筑执行逻辑会把当前页面可建按钮映射为建筑 id，然后只判断 `count < max` 和 priority 排序。
- 脚本已经能读取 React 内部 `MainStore`，包括 `run`、`idxs.buildings`、`ResourcesStore`、`BuildingsStore` 等。
- 脚本已包含建筑静态数据表 `buildings`，其中有类别、上限、消耗、产出/容量效果等数据。

这意味着改进可以少动底层点击逻辑，重点改“max/prio 从哪里来”。

## 推荐方案

### 方案 A：动态建筑目标规划器

新增一个 `autoPlanner` 模块，在每次 Build 页执行前生成临时建筑列表：

1. 读取当前资源状态：当前值、上限、产速、多久满仓、多久耗尽。
2. 读取当前已建建筑数量和已解锁建筑。
3. 读取建筑静态数据：成本、产出、容量、人口、负产出、副作用。
4. 计算每个建筑的分数。
5. 把分数转换成临时 `max` 和 `prio`。
6. 交给原本 `getBuildingsList()` 和 `executeAction()` 去建。

推荐评分思路：

```text
score =
  bottleneckBonus
  + unlockGoalBonus
  + capPressureBonus
  + populationNeedBonus
  + prestigeStrategyBonus
  - negativeResourceRisk
  - overbuildPenalty
  - paybackTimePenalty
```

这样用户不用填每个建筑的数量，只需要选择策略。

### 方案 B：预设阶段变成“规则”，不是“数量表”

不要维护“声望 1 建筑配置”“声望 2 建筑配置”这种硬表。改成规则：

- 粮食产速小于安全线，优先农场/粮食链。
- 木头、石头、工具任一资源等待时间过长，优先对应产线。
- 资源经常满仓，优先仓库/容量建筑。
- 人口不足或工种不足，优先住宅/人口/工种建筑。
- 有关键科技等待资源，优先服务这个科技的资源链。
- 冲声望模式下，减少长期回本建筑，优先短期解锁、军队、关键战斗。
- 传承后早期模式自动进入 bootstrap，建出基础资源链后再切通用策略。

这种规则可以跨声望、跨传承复用。

### 方案 C：目标导向 UI

把 UI 从“几百个 max 输入框”升级成两层：

- 简单模式：
  - 挂机策略：稳健 / 快速推进 / 冲声望 / 冲军队 / 冲科技
  - 风险：保守 / 普通 / 激进
  - 自动处理互斥建筑：关闭 / 只推荐 / 自动选择
  - 最大等待时间：例如 30 秒、2 分钟、5 分钟

- 高级模式：
  - 仍保留原来的 max/prio。
  - 支持把动态规划器的结果预览为“临时 max/prio”。
  - 支持锁定某个建筑，用户锁定后规划器不覆盖它。

这样新手能直接用，老玩家也能微调。

## 最小可行改造

第一版不需要做复杂 AI，只做一个可控的启发式规划器：

1. 新增 `smartBuild.enabled` 开关。
2. 新增 `smartBuild.strategy`：balanced / prestige / research / military。
3. 在 `getBuildSubpage().getBuildingsList()` 里，如果 smartBuild 开启，先调用 `buildPlanner.getTargets(subpage)`。
4. `getTargets()` 返回与旧配置兼容的结构：

```js
{
  farm: 12,
  prio_farm: 6,
  lumberjack_camp: 10,
  prio_lumberjack_camp: 5
}
```

5. 原脚本后续逻辑不用大改。

这个切入点风险最低，因为不重写页面导航、不重写点击、不重写战斗。

## 推荐的第一阶段规则

- 基础保障：
  - 食物产速低于 `minimumFood`，提高粮食建筑优先级。
  - 任一关键资源 `ttf < 60s`，提高容量建筑优先级。
  - 任一关键资源产速为负且资源少于 30% 仓位，暂停消耗该资源的建筑。

- 瓶颈资源：
  - 计算可见建筑/科技成本中最常缺的资源。
  - 优先能提升该资源产速或容量的建筑。

- 回本控制：
  - 如果建筑新增产出很小、成本很高，且当前策略是冲声望，则降低优先级。
  - 如果策略是长期挂机，则允许建更多容量和复合产线。

- 互斥/危险建筑：
  - 奇观、神殿、路线建筑默认只推荐，不自动选择。
  - 用户选择一次后保存偏好。

## 为什么这样更好用

- 用户不再维护每轮几百个 max。
- 声望/传承变化后，脚本自然从当前状态重新规划。
- 旧配置仍可作为兜底和高级覆盖。
- 可以一步步改，不需要推翻现有 Theresmore Automation。

## 建议后续开发顺序

1. 先做只读诊断面板：显示当前瓶颈资源、推荐建造 Top 10，不自动点击。
2. 再接入 `getBuildingsList()`，让推荐结果变成临时 max/prio。
3. 增加用户锁定项和互斥建筑选择。
4. 加入“冲声望/传承”策略，让长期建筑和短期目标权重不同。
5. 最后再考虑自动导入/导出不同策略，而不是导入/导出硬编码数量表。


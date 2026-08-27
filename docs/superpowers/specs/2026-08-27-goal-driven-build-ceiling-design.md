# 建筑数量上限改为纯结构性驱动，砍掉打分驱动的通用上限 —— 设计 spec

日期：2026-08-27
范围：`automation-src/fragments/smart-build-planner/40-build-scoring.js`（`getTargets`/`scoreBuilding`
及相关辅助函数）
关系：建立在同一天已完成的两次改动之上——①移除 `getProductionStorageCap`
（`docs/superpowers/specs/2026-08-27-remove-production-storage-cap-design.md`）、②moonlightNight
危险科技安全阀例外（`docs/superpowers/specs/2026-08-27-goal-scoped-dangerous-research-override-design.md`）。
这两次改动分别去掉了"仓储保护"和"危险科技无脑安全阀"两个会跟目标推进冲突的软节流点，本次是同一条
思路的收尾：去掉最后一个、也是影响面最大的一个软节流源——打分驱动的通用建筑数量上限。

## 背景与问题

用户反馈：移除仓储保护后（改动①），粮仓不再卡在1个的问题确认已修复，但暴露出更根本的问题——
选定目标（比如 `moonlightNight`）后，脚本依然会持续建造大量跟目标推进无关的"通用生产类"建筑
（用户举的例子：20个采石场、大量石匠坊），浪费时间和资源在目标不需要的产能上，而不是优先推进
到目标本身（用户原话："既然选定了目标就应该以目标为优先，以尽快推进游戏阶段到达月明之夜为
目的，而不是一直纠缠在没必要那么多的生产建筑上"、"一切的规范方向都是达到目标"）。

排查发现根因：`getTargets` 里每个建筑的数量上限（`softMax`）目前由两部分叠加驱动——
1. 结构性硬需求（`structuralFloor`：科技树/传承解锁对建筑数量的硬性要求，如 `common_house`
   需要15个才能解锁 `municipal_administration`；`farm` 需要5个才能解锁 `breeding`）——这部分
   是对的，应该保留。
2. **打分驱动的通用软上限**（`count + Math.min(maxExtra, toExtra(score))` 的逐 tick 递增，
   外加 `getStageCap` 给的"当前时代默认约80"的上限）——这部分只要 `scoreBuilding` 给出正分
   （比如资源打分/瓶颈打分/仓储压力打分），建筑就会一直被允许往上加，直到接近 `getStageCap`
   的上限（当前时代基本形同虚设，约80），**跟这个建筑是否真的在目标路线上完全无关**。

`moonlightNight` 目标的 `buildingFocus` 里虽然列了 `quarry`（采石场）、`artisan_workshop`
（工匠作坊），但这两个只贡献了 `getStructuralFloor` 里默认 `target:1` 的"下限"，实际建到多少
完全由第2部分的打分软上限决定——这就是"20个采石场"的直接原因：`buildingFocus`/路线目标本该是
"上限"，实际却只是个形同虚设的"下限"。

用户进一步明确排除了两种"看起来能治标但方向不对"的方案：
- 不要用**实时资源产速**（`res.speed`）做判断依据——"不要再纠缠现有的资源速率来判断了"，因为
  这是被动、滞后的信号，跟"仓储保护"翻车的教训（改动①）是同一类问题。
- 不要给每个通用建筑**硬编码一个固定数量**（比如统一封3-5个）——用户随后举了 farm 的反例：
  farm 实际需要5个才能解锁 `breeding`，这个数字不该是拍脑袋定的固定值，而应该是从游戏结构性
  数据（科技树 `req`）里自动推导出来的——**这正是 `getStructuralTechFloor` 已经在做的事**，
  经查证 `breeding` 科技的 `req` 里确有 `{type:'building', id:'farm', value:5}` +
  `{type:'tech', id:'storage'}`，`getStructuralTechFloor` 会在 `breeding` 未完成时自动算出
  `farm` 的结构性下限为5，不需要新增任何硬编码表。

结论：**建筑数量的"上限"应该完全由结构性数据决定（科技树/传承解锁的硬性要求 + 路线/焦点的显式
目标数），不该再有一条独立的、打分驱动的"通用经济上限"**。打分（`scoreBuilding`）应该继续存在，
但只用来决定"多个建筑都需要建的时候先建哪个"（点击优先级），不该再决定"建到多少个"。

## 目标

1. `getTargets` 里每个建筑的目标数量上限，改为只由以下三类结构性信号决定：
   - `structuralFloor`（科技树/传承解锁硬性建筑数量要求，`getStructuralTechFloor`，不变）。
   - 路线/建筑焦点的显式目标数（`getExpandedRouteTargets`/`getExpandedGoalFocusTargets` 给出的
     `target` 字段，含 `expandPrerequisiteTargets` 推导出的前置建筑数量链）。
   - 结构性资源缺口桥接（`applyCapBridgeTargets`/`applyDangerousBattleBuildingTargets`，判断
     路线/科技接下来要花的资源、当前仓储上限扛不住时才临时突破——这两个已有机制不变）。
2. 去掉打分驱动的通用软上限：`count + Math.min(maxExtra, toExtra(score))` 与 `getStageCap`
   不再作为 `getTargets` 主循环里独立的上限来源。
3. 没有任何结构性要求、也不在路线/焦点里的建筑（比如石匠坊），目标数量默认等于当前已建数量
   （不主动新增），只有被 ①②③ 三类结构性信号命中才会被推高。
4. `scoreBuilding`/`toPriority` 保留，继续用于计算 `prio`（多个建筑都需要建时，决定先点哪个），
   跟数量上限彻底解耦。

## 非目标

- 不改动 `getStructuralTechFloor`/`getStructuralFloor` 本身的计算逻辑——它们已经能正确从
  科技树 `req` 数据里推导硬性数量要求（farm=5 的例子已验证），本次只是把它的地位从"下限之一"
  提升为"（连同路线/焦点目标）唯一的上限来源"。
- 不改动 `applyCapBridgeTargets`/`applyDangerousBattleBuildingTargets`/`applyTitanOverrides`/
  `applyRouteTargets`（优先级部分）——这几个都是既有的结构性/场景驱动兜底机制，本次改动之后
  它们是"通用建筑"唯一还能继续新增数量的入口，逻辑本身不需要变。
- 不改动 `scoreBuilding` 内部的打分公式——它继续决定 `prio`（点击顺序），只是不再影响
  `getTargets` 的数量上限计算。
- 不新增任何"泰坦建筑替代表"/"资源速率阈值"之类的新判断依据——已经在讨论中被用户明确排除。
- 不处理"持续性消耗但既无结构性要求、也不构成仓储缺口"的资源风险（比如人口增长带来的食物
  持续消耗，如果哪天不再被任何科技/建筑成本或结构性下限覆盖）——这是已知的、用户认可的取舍
  （见"影响评估"），不在本次范围内额外兜底。

## 设计

`40-build-scoring.js` 的 `getTargets` 主循环，把"结构性下限"和"路线/焦点目标"合并为统一的
`floor`，直接当作上限使用（仍然被 `cap`/`maxTargetOption` 兜底，不会突破奇观单体上限或用户
配置的总上限）：

```js
const getFocusOrRouteTarget = (building, goal, route) => {
  const focusEntry = getExpandedGoalFocusTargets(goal).find(target => target.id === building.id);
  const routeEntry = getRouteEntry(building, route);
  return Math.max(focusEntry ? focusEntry.target : 0, routeEntry ? routeEntry.target : 0);
};

const getTargets = (subpage, manualOptions = {}) => {
  const options = getOptions();
  if (!options.enabled) return null;
  const resourceMap = getResourceMap();
  const goal = getGoal(options);
  const route = getRoute(options);
  const targets = {};
  buildings.filter(building => building.tab === CONSTANTS.SUBPAGES_INDEX[subpage] + 1).forEach(building => {
    const score = scoreBuilding(building, resourceMap, options);
    const prio = toPriority(score);
    const structuralFloor = getStructuralTechFloor(building);
    const focusOrRouteTarget = getFocusOrRouteTarget(building, goal, route);
    const floor = Math.max(structuralFloor, focusOrRouteTarget);
    if (!floor) return;
    const count = getCount(building);
    const cap = building.cap || Number(options.maxTarget) || smartBuildDefaults.maxTarget;
    const maxTargetOption = Number(options.maxTarget) || smartBuildDefaults.maxTarget;
    const max = Math.min(Math.max(floor, count), cap, maxTargetOption);
    if (max <= count) return;
    targets[building.id] = max;
    targets[`prio_${building.id}`] = prio;
  });
  applyCapBridgeTargets(targets, subpage, resourceMap, options);
  applyDangerousBattleBuildingTargets(targets, subpage, options);
  applyRouteTargets(targets, subpage, options);
  applyTitanOverrides(targets, options);
  return applyManualOverrides(targets, manualOptions, options);
};
```

要点：
- `getStructuralFloor`（旧的、把 `buildingFocus` 默认 target 也算进去的版本）不再需要，拆成
  `getStructuralTechFloor`（纯科技树/传承部分，不变）+ `getFocusOrRouteTarget`（路线/焦点部分，
  新增，合并了原来分散在 `routeTargetIds`/`getRouteEntry` 的判断）。
- 不再有 `prio && !floor` 的判断分支——没有 `floor`（三类结构性信号都没命中）的建筑直接跳过，
  不进入 `targets`，等着被 `applyCapBridgeTargets`/`applyDangerousBattleBuildingTargets` 结构性
  兜底捡起来。
- `toExtra`/`getStageCap` 函数本身不删除——`applyCapBridgeTargets`/`applyDangerousBattleBuildingTargets`
  内部仍在用 `getStageCap` 作为它们自己新增数量的上限参考，`60-research-scoring.js`/
  `80-prayer-scoring.js` 里 `getTechUnlockBonus`/`getPrayerUnlockBonus` 也仍在用它做打分参考，
  这些用法不变，只是不再出现在 `getTargets` 主循环的上限计算里。
- `toExtra`/逐 tick 递增节流（`maxExtra`）不再单独使用，但 `applyCapBridgeTargets`/
  `applyDangerousBattleBuildingTargets` 内部各自已经有自己的 `count + Math.max(1, maxExtra)`
  递增逻辑，不受影响。

## 影响评估

- **预期改变**：`moonlightNight` 目标下，`stonemason`（石匠坊）等不在 `buildingFocus`/路线、
  也没有科技把它列为数量前置的建筑，会冻结在当前已建数量，不再继续新增——这正是本次改动的目的。
  `quarry`/`artisan_workshop`（在 `buildingFocus` 里但目前只有默认 `target:1`）会真正被限制在
  1个，除非被 `applyCapBridgeTargets` 判定为石头/工具仓储缺口而临时突破——如果实测发现1个明显
  不够用，需要在 `moonlightNight` 的 `buildingFocus` 里给这两个建筑显式指定更合理的 `target`
  数字（这是数据调整，不需要再改这次的逻辑本身）。
- **已知取舍**：某些资源如果只靠"持续消耗"（不是某次性的科技/建筑成本）不断增长压力，且没有
  任何结构性下限或仓储缺口信号覆盖，本次改动后不会再被主动追加产能——用户已在讨论中明确认可
  这个方向（"一切的规范方向都是达到目标"），不作为本次需要额外兜底的问题。
- 影响面覆盖所有目标（不只是 `moonlightNight`），其余目标（`progress`/`wonderRush`/
  `religionGrowth`/`richPath`/`lategame`）下同样会从"打分决定建多少"变成"结构性数据决定建
  多少"——这些目标的 `buildingFocus`/`targetTechs` 列表如果也存在"默认 target:1 但实际需要
  更多"的情况，会有类似 `quarry` 的表现变化，需要用户实机验证后按需调整对应 goal 的
  `buildingFocus`/`routes` 数据（数据调整，不涉及本次逻辑改动）。

## 影响文件

- `automation-src/fragments/smart-build-planner/40-build-scoring.js`：重写 `getTargets`
  主循环上限计算；新增 `getFocusOrRouteTarget`；`getStructuralFloor`（旧版）替换为直接在
  `getTargets` 里用 `getStructuralTechFloor` + `getFocusOrRouteTarget`（若 `getStructuralFloor`
  没有其他调用方则一并删除，若被其他文件引用则保留但不再在 `getTargets` 里使用）。
- 完成后：`automation-src/build.ps1` 重新构建 → `node --check` 校验 → `codemap regen --repo
  theresmore` → 同步更新 `.codemap-conventions.md`。

## 测试/验证方式

本项目没有自动化测试，构建 + 语法检查后交由用户实机验证，建议验证点：

1. `moonlightNight` 目标下，`stonemason` 等通用生产建筑是否不再持续新增，维持在当前已建数量。
2. `quarry`/`artisan_workshop` 是否被限制在合理数量（1个或由仓储缺口机制临时提升），不再无脑
   冲到接近80。
3. `farm` 是否依然能正常建到5个（验证 `getStructuralTechFloor` 从 `breeding` 科技 `req` 自动
   推导的结构性下限没有被这次重构破坏）。
4. `common_house` 是否依然能建到15个（验证已有的科技树结构性下限继续生效）。
5. 整体游戏推进速度是否感觉上更快地朝目标（`moonlight_night` 研究/建筑链）前进，而不是被无关
   生产建筑拖慢。

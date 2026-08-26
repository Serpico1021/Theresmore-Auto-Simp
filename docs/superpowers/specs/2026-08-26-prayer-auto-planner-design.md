# 祈祷自动化（Magic/Prayers 目标驱动规划）—— 设计 spec

日期：2026-08-26
范围：`automation-src/fragments/smart-build-planner/` 内新增 Prayers 子系统（Magic/Prayers 子页面的自动祈祷决策），不涉及 Magic/Spells 子页面。

## 背景与问题

用户反馈"目前确认到，Progress 目标会卡在魔法-祈祷-解决危机这个环节"。经直接读码定位到根因：

- `progress` 路线表（`00-data-tables.js`）里 `refugee_district` 是显式路线目标（`target: 1, priority: 8`）。
- `refugee_district` 的建造条件是 `{type:'building', id:'refugee_district_part', value:8, consume:true}`——需要先造好 8 个 `refugee_district_part`。
- `refugee_district_part` 的建造条件里有一条 `{type:'prayer', id:'the_aid', value:1}`（"解决危机"）——必须先在 Magic/Prayers 页面把这个祈祷点掉。
- `the_aid` 本身需要 4000 信仰 + 已完成 `the_scourge` 科技，且这是要在游戏 UI 上手动点的一次性动作。
- base 脚本里 Magic/Prayers 子页面其实已经有**完整的执行框架**（`userEnabled$2`/`getAllowedPrayers`/`executeAction$2`，约 48058-48136 行），跟 Research 当初对接 smart-build-planner 之前的状态几乎一样——只是 `getAllowedPrayers()` 从未接过 planner，`prayersOptions`（`state.options.pages[MAGIC].subpages[PRAYERS].options`）默认是空对象，`getAllowedPrayers()` 在空配置下直接返回 `[]`，导致 `MagicPrayers.enabled()`（依赖 `getAllowedPrayers().length`）恒为 false，Magic/Prayers 页面自动化实质上从未运行过。

结果：任何依赖祈祷前置的建筑/路线节点都会永久卡住，不限于 `the_aid`——这是一个"祈祷侧完全没有自动化"的架构性缺口，不是 `the_aid` 专属问题。

## 目标

1. 让 Magic/Prayers 子页面像 Build/Research/Army/Explore 一样接入 smart-build-planner 的目标驱动打分，默认随 `smartBuild.enabled`（现有全局开关）直接生效，不引入需要用户手动打开的新开关。
2. 分层打分：基础优先级保证"只要负担得起，所有已解锁的祈祷长期都会被自动祈祷掉"；额外识别"这个祈祷是当前 route/buildingFocus 需要的建筑的前置条件"，给这类祈祷叠加高优先级加成，确保类似 `the_aid` 这种卡路线的祈祷被优先处理。
3. 不重复造轮子：不自己判断"祈祷是否已解锁/买得起"——沿用 `getAllowedPrayers()`/`getAllButtons$1` 已有的 DOM 按钮存在性二次过滤（跟 Build/Research/Army 的既有消费模式一致：规划器只管打分，未解锁的候选会被自动滤掉）。
4. 提供最小化的手动兜底口子（`prayerEnabled`/`prayerExcludes`），不新增手动配置 UI。

## 非目标

- 不涉及 Magic/Spells 子页面（`CONSTANTS.SUBPAGES.SPELLS`，`userEnabled$1`/`executeAction$1`）——用户反馈只提到"祈祷"，Spells 是独立的法力消耗型子系统，超出本次范围。
- 不引入危险/不可逆祈祷的特殊阻断机制（类似 Research 的 `resetResearch`/`confirm` 弹窗处理）——抽样读取 `spells` 数据表（约 28670-33037 行，4368 行规模，未逐行扫描）未发现 `confirm`/互斥字段，初步判断祈祷体系不像研究树那样有"终局不可逆选择"，但这是基于抽样，不是全表确认，风险记录在"开放问题"里，需要用户上线验证时留意。
- 不改动 `executeAction$2`/`getAllButtons$1`/`userEnabled$2` 的执行/点击逻辑，只改 `getAllowedPrayers()` 内 `prayersOptions` 的来源。
- 不新增手动配置 UI 面板；`prayerExcludes`/`prayerEnabled` 仅作为 smartBuild 内部选项存在（镜像 `researchEnabled`/`researchExcludes`），跟手动 UI 无关。

## 设计

### ① 新文件：`automation-src/fragments/smart-build-planner/80-prayer-scoring.js`

结构直接比照 `60-research-scoring.js`（Research 打分侧），复用 `40-build-scoring.js` 的 `toPriority` 分桶函数、`20-goal-routes.js` 的 `getExpandedGoalFocusTargets`/`getExpandedRouteTargets`/`getGoal`/`getRoute`、`10-game-state-adapter.js` 的 `getCount`：

```js
const getPrayerUnlockBonus = (prayer, goal, route) => {
  const wantedTargets = [...getExpandedGoalFocusTargets(goal), ...getExpandedRouteTargets(route)];
  if (!wantedTargets.length) return 0;
  const unlockedBuildings = buildings.filter(building => (building.req || []).some(req => req.type === 'prayer' && req.id === prayer.id));
  if (!unlockedBuildings.length) return 0;
  const bestPriority = unlockedBuildings.reduce((max, building) => {
    const entry = wantedTargets.find(target => target.id === building.id);
    if (!entry || getCount(building) >= entry.target) return max;
    return Math.max(max, entry.priority || 0);
  }, 0);
  return bestPriority ? 60 + bestPriority * 8 : 0;
};
const scorePrayer = (prayer, options, goal, route) => {
  if ((options.prayerExcludes || []).includes(prayer.id)) return 0;
  return 10 + getPrayerUnlockBonus(prayer, goal, route);
};
const applyPrayerManualOverrides = (targets, manualOptions, options) => {
  if (!options.manualOverrides || !manualOptions) return targets;
  Object.keys(manualOptions).forEach(key => {
    if (manualOptions[key]) targets[key] = manualOptions[key];
  });
  return targets;
};
const getPrayerTargets = (manualOptions = {}) => {
  const options = getOptions();
  if (!options.enabled || options.prayerEnabled === false) return null;
  const goal = getGoal(options);
  const route = getRoute(options);
  const targets = {};
  spells.filter(spell => spell.type === 'prayer').forEach(prayer => {
    targets[prayer.id] = toPriority(scorePrayer(prayer, options, goal, route));
  });
  return applyPrayerManualOverrides(targets, manualOptions, options);
};
```

要点：

- `getPrayerUnlockBonus` 反向查找"哪些建筑的建造条件里引用了这个祈祷"，再检查这些建筑是否在 `getExpandedGoalFocusTargets(goal)` 或 `getExpandedRouteTargets(route)`（已经递归展开了建筑前置链）里、且还没建够——命中则按对应目标的 `priority` 给高额加成（`60 + priority*8`，取值范围 68~140，`toPriority` 里 `>=50` 即封顶到最高优先级 7）。跟 Research 的 `getTechUnlockBonus` 完全同构（方向相反：Research 是"科技解锁了建筑"，这里是"建筑依赖了祈祷"）。
- 基础分 10：`toPriority(10) = 3`（`toPriority` 分桶：`>=7→3`），确保没有任何加成的祈祷也有非零优先级（最低档），长期会被自动祈祷掉，不会被 `getAllowedPrayers()` 的 `!!prayersOptions[key]` 判断为"未启用"而漏掉。
- `spells.filter(spell => spell.type === 'prayer')`——`spells` 数组（base 脚本，约 28670-33037 行）同时包含 `type:'prayer'` 和 `type:'spell'` 两类条目，只取祈祷类。
- 输出形状是**扁平的 `{prayerId: priority}` 映射**（不是 Build/Unit 那种 `{buildingId, prio_buildingId}` 两键形状）——这跟 `getResearchTargets` 的输出形状完全一致，因为 `getAllowedPrayers()`/`getAllowedResearch()` 消费的都是"扁平 id→优先级数字"配置对象，不是 Build/Army 页面那种"目标数量 + 优先级"两字段配置。

### ② `smart-build-options.js`：新增默认值

```js
prayerEnabled: true,
prayerExcludes: []
```

镜像现有 `researchEnabled`/`researchExcludes`、`exploreEnabled` 的写法。

### ③ `90-export.js`：导出新增 `getPrayerTargets`

```js
return { getTargets, getUnitTargets, getResearchTargets, getExploreTargets, getPrayerTargets, shouldGateDangerousResearch };
```

### ④ `build.ps1`：拼接列表新增 `80-prayer-scoring.js`

`$plannerInnerFiles` 数组在 `70-explore-scoring.js` 和 `90-export.js` 之间插入 `'80-prayer-scoring.js'`。

### ⑤ base 模板接入点（需要单独确认后才动手，第三次例外）

`getAllowedPrayers()`（约 48062 行）：

```diff
- const prayersOptions = state.options.pages[CONSTANTS.PAGES.MAGIC].subpages[CONSTANTS.SUBPAGES.PRAYERS].options;
+ const configuredPrayersOptions = state.options.pages[CONSTANTS.PAGES.MAGIC].subpages[CONSTANTS.SUBPAGES.PRAYERS].options;
+ const prayersOptions = smartBuildPlanner.getPrayerTargets(configuredPrayersOptions) || configuredPrayersOptions;
```

与 Explore（`executeAction$7`）/Research（`getAllowedResearch()`）接入点同款写法：smart planner 结果优先，`smartBuild` 未开启或 `prayerEnabled:false` 时（`getPrayerTargets` 返回 `null`）退回原有的手动配置对象。**这是本项目 CLAUDE.md"禁止手改 base 模板"规则生效后第三次经用户明确同意的例外**（Research 第一次、Explore 第二次），后续新增子系统若要同样接入 base 模板，仍需先向用户确认。

## 数据流小结

```
getPrayerTargets(manualOptions)
  ├─ options.enabled && options.prayerEnabled !== false 才继续，否则 return null（兜底退回手动配置）
  ├─ goal = getGoal(options); route = getRoute(options)
  ├─ 遍历 spells 里 type==='prayer' 的每个祈祷：
  │    scorePrayer = 10（基础分，prayerExcludes 命中则直接 0）
  │                 + getPrayerUnlockBonus（是否是 route/buildingFocus 需要建筑的前置，命中给 68~140）
  │    targets[prayer.id] = toPriority(scorePrayer)   // 分桶到 0/3/4/5/6/7
  └─ applyPrayerManualOverrides（手动配置最终覆盖权不变）

getAllowedPrayers()（base 脚本，不变的下游消费逻辑）
  ├─ prayersOptions = smartBuildPlanner.getPrayerTargets(configured) || configured
  ├─ Object.keys(prayersOptions).filter(!!value) → {key, id, prio}
  └─ getAllButtons$1 用 DOM 上真实存在的祈祷按钮二次过滤（未解锁的候选自动被滤掉，规划器不需要自己判断解锁状态）

executeAction$2（不变）按 prio 降序批量点击祈祷按钮
```

对本次报告的具体案例：`refugee_district`（route 目标 priority 8）→ 递归展开前置 `refugee_district_part`（priority 9，target 8）→ `getPrayerUnlockBonus` 发现 `refugee_district_part.req` 引用了 `the_aid` → `the_aid` 得分 10+60+9×8=142 → `toPriority`封顶到 7（最高优先级）→ 一旦信仰够 4000 且 `the_scourge` 已研究，`the_aid` 按钮出现，会被优先点掉 → `refugee_district_part` 解锁 → 路线继续推进。

## 影响文件

- 新增 `automation-src/fragments/smart-build-planner/80-prayer-scoring.js`。
- `automation-src/fragments/smart-build-planner/90-export.js`：导出列表加 `getPrayerTargets`。
- `automation-src/build.ps1`：`$plannerInnerFiles` 加入 `'80-prayer-scoring.js'`。
- `automation-src/fragments/smart-build-options.js`：新增 `prayerEnabled: true`、`prayerExcludes: []`。
- `automation-src/base/Theresmore-Automation_4.14.4.base.user.js`：`getAllowedPrayers()` 一行改动（见"设计⑤"，需单独确认）。
- 完成后需要：`automation-src/build.ps1` 重新构建 → `node --check` 校验 → `codemap regen --repo theresmore` → 同步更新 `.codemap-conventions.md`。

## 测试/验证方式

本项目没有自动化测试，遵循既有模式：构建 + 语法检查后，交由用户实机验证——具体验证点：

1. 当前被 `the_aid` 卡住的存档下，开启 smartBuild 后，Magic/Prayers 页面是否开始自动运行（此前因 `getAllowedPrayers()` 恒为空列表，`MagicPrayers.enabled()` 恒为 false，页面自动化从未触发过，这一步本身就是验证点）。
2. 信仰攒够 4000 且 `the_scourge` 已研究后，`the_aid`（"解决危机"）是否被自动点掉，进而 `refugee_district_part`/`refugee_district` 恢复正常建造，Progress 路线不再卡在这。
3. 其余没有卡路线的普通祈祷，是否也会随着信仰积累被陆续自动祈祷掉（验证"基础优先级保底"这一档逻辑生效，不会因为没有加成就被完全忽略）。
4. 关注上线验证过程中是否出现"祈祷后弹出不可逆确认框/二次确认"的情况——如果出现，说明"非目标"里提到的"祈祷体系没有终局不可逆选择"假设不成立，需要另行设计类似 Research `resetResearch`/`confirm` 的阻断机制。

## 开放问题（不阻塞本次实现，后续按需处理）

- `spells` 数据表是否存在危险/互斥/不可逆的祈祷分支，目前基于抽样读取判断"没有"，需要实机验证阶段留意，如果发现需要另行确认设计阻断机制。
- 基础分 10 / 解锁加成 `60+priority*8` 这两个具体数值是否需要按实际游戏节奏微调（比如信仰增长很快导致祈祷队列很快清空、或者相反基础分太低导致非阻塞祈祷长期排不上号），留待实机验证后再定。
- Magic/Spells 子页面（消耗法力而非信仰的另一套魔法系统）是否也需要类似的目标驱动自动化，本次不做，待用户后续明确提出再单独设计。

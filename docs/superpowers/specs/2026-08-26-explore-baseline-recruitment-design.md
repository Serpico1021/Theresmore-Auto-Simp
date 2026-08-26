# 探索单位保底招募 —— 设计 spec

日期：2026-08-26
范围：`automation-src/fragments/smart-build-planner/` 内 Army 招募子系统（Army/Army 子页面的自动招募逻辑），不涉及 Build/Research 子系统。

## 背景与问题

用户反馈"军队探索并没有自动触发（在 Progress 目标下）"。经直接读码定位到根因（与具体 goal 无关，是架构性缺口）：

- `70-explore-scoring.js` 的 `getExploreTargets` 只负责"把已有存量的探索单位派出去"：只有 `getUnitCount(unit) > 0` 时才会给出非零的 `min/max` 派遣目标，存量为 0 时该单位目标恒为 0。
- 唯一驱动自动招募的入口是 `50-unit-scoring.js` 的 `getUnitTargets`，但它：
  1. `if (!blockedFights.length) return null;`——没有"当前被危险战斗阻塞的研究"时直接整体返回 `null`，招募退回手动配置（`configuredUnitsObject`，通常为空）。
  2. 即使触发了，`getUnitScore` 只按 `defense/attack/splash/trample/category` 打分，scout/explorer/familiar 这类非战斗单位分数恒为 0，被 `.filter(item => item.score > 0)` 过滤掉，永远进不了招募候选列表。
- 结果：不管什么 goal，只要用户没有手动在 Army 页面填 scout/explorer/familiar 的招募数量，这三种单位存量永远是 0 → `getExploreTargets` 永远算出全 0 → 探索自动化实质上永远不会触发。

## 目标

1. 让 scout/explorer/familiar 三种探索单位能够脱离"是否存在危险战斗备战需求"这一门槛，自动维持一个保底存量，从而让 `getExploreTargets` 的派遣逻辑能够真正生效（解决"从 0 到有存量"的冷启动问题）。
2. 不引入需要用户在 UI 里手动打开的新开关；只要 `smartBuild.enabled && smartBuild.armyEnabled`（现有全局开关）为真就默认生效。
3. 保底招募与战斗备战招募共享同一个 Army 招募队列/优先级排序时，不能抢占战斗备战单位的资源——用固定中低优先级体现"不紧急但持续需要"的定位。
4. `moonlightNight`（自动月明之夜自杀重置）目标下不生效——该目标全程资源都应优先投入防御/生产建筑冲刺，不应被保底招募分流。

## 非目标

- 不改动 `getExploreTargets`（`70-explore-scoring.js`）的派遣逻辑本身——保底招募只解决"有没有单位可派"，不改变"派多少个出去探索"的计算方式。
- 不为保底招募数量引入基于资源可负担度的动态缩放（如 `getExploreAffordabilityFactor` 的思路）——固定小常量，招募执行层已有的 `shouldHire`（资源速率检查，`state.MainStore.ArmyStore.addArmy` 前的判断）会自然阻止在资源不够时强行招募。
- 不改动 `moonlightNight` 之外的其他 goal 的行为——首版黑名单只包含 `moonlightNight`，未来如果发现其他 goal（如 `annihilator` 后期消耗战阶段）也需要排除，另行单独确认后再加。
- 不改动 Army 页面招募执行逻辑（`executeAction$8`/`getControls`/`getUnitsList`，均在 base 脚本内）——沿用现有"`smartBuildPlanner.getUnitTargets(configuredUnitsObject) || configuredUnitsObject`，按 `prio` 降序批量招募"的消费方式，不改调用点。

## 设计

### ① 触发方式：独立于战斗备战门槛

新增函数 `getExploreBaselineTargets(options)`，放在 `50-unit-scoring.js`：

```js
const smartBuildExploreBaselineExcludedGoals = ['moonlightNight'];
const EXPLORE_BASELINE_COUNT = 3;
const getExploreBaselineTargets = options => {
  if (!options.enabled || !options.armyEnabled) return {};
  if (smartBuildExploreBaselineExcludedGoals.includes(options.goal)) return {};
  const targets = {};
  smartBuildExploreUnits.forEach(entry => {
    const unit = units.find(candidate => candidate.id === entry.unitId);
    if (!unit) return;
    const count = getUnitCount(unit);
    const target = Math.min(unit.cap || EXPLORE_BASELINE_COUNT, EXPLORE_BASELINE_COUNT);
    if (target <= count) return;
    targets[unit.id] = target;
    targets[`prio_${unit.id}`] = 4;
  });
  return targets;
};
```

`smartBuildExploreUnits`（`unitId`/`minKey`/`maxKey` 映射表）在 `70-explore-scoring.js` 中已定义，本次复用其中的 `unitId` 字段（`scout`/`explorer`/`familiar`），不重复定义单位列表。按当前 `build.ps1` 的拼接顺序（`10` → `90`，`50-unit-scoring.js` 先于 `70-explore-scoring.js`），`getExploreBaselineTargets` 无法在定义时直接引用尚未加载的 `smartBuildExploreUnits`；由于最终产物是拼接成同一个 IIFE 作用域，函数体内引用（而非定义时求值）在调用时该常量已存在，不存在时序问题——只要不在模块顶层（文件级）立即执行读取它即可。

### ② 目标数量：固定小常量

- `EXPLORE_BASELINE_COUNT = 3`（写死，不开放 UI，后续如需调整直接改常量）。
- 若单位有 `unit.cap`（游戏自带数量硬上限），取 `min(cap, 3)`，避免对有更低硬上限的单位设置一个达不到的目标。
- 若当前存量已 `>= target`，跳过（不设置该 key），与现有战斗单位招募逻辑一致的语义：只表达"最少要有多少"，不会主动裁撤多余单位。

### ③ 优先级：固定中低（4）

- 三种探索单位统一 `prio_xxx = 4`。
- 战斗备战单位优先级通常在 8~10 区间（`templateEntry.priority || 8`，或 `Math.max(3, 10 - Math.floor(index/4))`），保底招募的 4 低于绝大多数战斗备战单位，只在没有危险战斗需要备战、或战斗单位已经招够时才会被 Army 页面招募循环处理到。

### ④ 与现有 `getUnitTargets` 合并

修改 `getUnitTargets`（`50-unit-scoring.js`）：

```js
const getUnitTargets = (manualOptions = {}) => {
  const options = getOptions();
  if (!options.enabled || !options.armyEnabled) return null;
  const targets = getExploreBaselineTargets(options);
  const blockedFights = getBlockedDangerousFights(options);
  if (blockedFights.length) {
    const unitExtra = Math.max(1, Number(options.armyMaxExtra) || smartBuildDefaults.armyMaxExtra);
    const unitMaxTarget = Math.max(1, Number(options.armyMaxTarget) || smartBuildDefaults.armyMaxTarget);
    const template = getBattleTemplate(blockedFights);
    units.filter(unit => unit.type !== 'enemy' && unit.type !== 'settlement' && unit.type !== 'spy').map(unit => ({
      unit,
      score: getUnitScore(unit, template)
    })).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 24).forEach((item, index) => {
      const unit = item.unit;
      const templateEntry = getTemplateUnitEntry(unit, template);
      const count = getUnitCount(unit);
      const cap = unit.cap || unitMaxTarget;
      const target = Math.min(cap, unitMaxTarget, count + unitExtra);
      if (target <= count) return;
      targets[unit.id] = target;
      targets[`prio_${unit.id}`] = templateEntry ? templateEntry.priority || 8 : Math.max(3, 10 - Math.floor(index / 4));
    });
    logger({
      msgLevel: 'debug',
      msg: `Smart army planner is preparing for next dangerous fight: ${blockedFights.map(item => `${item.techId}->${item.fightId}`).join(', ')}${template ? ` (${template.label})` : ''}`
    });
  }
  if (!Object.keys(targets).length) return null;
  return applyUnitManualOverrides(targets, manualOptions, options);
};
```

要点：
- 原先"没有 `blockedFights` 就整体 `return null`"的分支被拆开——`targets` 先由 `getExploreBaselineTargets` 填充，`blockedFights` 存在时再往同一个 `targets` 对象里追加战斗单位目标。
- 两部分理论上不会出现 key 冲突（scout/explorer/familiar 在 `getUnitScore` 里恒为 0 分，不会进入战斗单位候选列表），无需额外去重逻辑。
- 兜底语义保留：合并后如果 `targets` 仍是空对象（`armyEnabled` 关闭、goal 是 `moonlightNight`、且没有战斗备战需求），照旧返回 `null`，调用方退回手动配置。
- `applyUnitManualOverrides` 仍在最后统一应用，手动配置依旧对两部分目标都有最终覆盖权。

`70-explore-scoring.js`/`getExploreTargets` 不改动。

## 数据流小结

```
getUnitTargets(manualOptions)
  ├─ targets = getExploreBaselineTargets(options)        // ① 独立于 blockedFights，goal≠moonlightNight 时生效，prio=4
  ├─ if (blockedFights.length) { ...合并战斗备战目标... }  // 不变，prio 通常 8~10
  ├─ if (!Object.keys(targets).length) return null;       // 兜底语义不变
  └─ applyUnitManualOverrides(targets, ...)               // 不变，手动配置最终覆盖

Army 页面 executeAction$8 按 prio 降序批量招募（不变）
  └─ 探索单位存量从 0 涨到 EXPLORE_BASELINE_COUNT
       └─ getExploreTargets（70-explore-scoring.js，不变）开始给出非零派遣目标
            └─ executeAction$7 自动派遣探索（不变）
```

## 影响文件

- `automation-src/fragments/smart-build-planner/50-unit-scoring.js`：新增 `smartBuildExploreBaselineExcludedGoals`、`EXPLORE_BASELINE_COUNT`、`getExploreBaselineTargets`；修改 `getUnitTargets` 的分支结构（不再无条件 `return null`）。
- 完成后需要：`automation-src/build.ps1` 重新构建 → `node --check` 校验 → `codemap regen --repo theresmore` → 同步更新 `.codemap-conventions.md`。

## 测试/验证方式

本项目没有自动化测试，遵循既有模式：构建 + 语法检查后，交由用户实机验证——具体验证点：
1. 在没有任何危险战斗待处理、且当前 goal 不是 `moonlightNight` 的情况下（如 `progress`），Army 页面是否会自动招募 scout/explorer/familiar 各到 3 个（或各自 `unit.cap`，取更小值）。
2. 探索单位存量达到保底数量后，Explore 子页面是否开始自动派遣（`getExploreTargets` 给出非零 `min/max`，UI 上探索按钮被自动点击）。
3. 手动把 goal 切到 `moonlightNight`，确认保底招募不再生效（不会新增招募 scout/explorer/familiar 的目标，除非用户手动配置）。
4. 出现危险战斗需要备战时（`blockedFights` 非空），确认战斗单位仍然优先于探索单位被招募（探索单位保底目标的 `prio=4` 低于战斗单位）。

## 开放问题（不阻塞本次实现，后续按需处理）

- `EXPLORE_BASELINE_COUNT`（默认 3）和探索单位保底招募的固定优先级（4）是否需要按具体游戏数值微调，留待实机验证后再定。
- `moonlightNight` 之外是否还有其他 goal 需要排除保底招募（如 `annihilator` 后期消耗战阶段），首版不预先加入，待用户后续明确指出再补充到 `smartBuildExploreBaselineExcludedGoals`。

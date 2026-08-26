# 存储上限驱动的建筑数量规划 —— 设计 spec

日期：2026-08-26
范围：`automation-src/fragments/smart-build-planner/` 内 Build 子系统（不涉及 Research/Explore/Army）

## 背景与问题

`smart-build-planner` 目前对"某类产出建筑该建多少个"没有基于存储容量的显式上限计算：

- `40-build-scoring.js` 的 `getTargets`/`scoreBuilding` 只有被动信号：`getCapPressure`（存储快满/见底时给分）、`count - 6` 的边际衰减评分。两者都只影响优先级排序，不会给出一个具体的"最多建 N 个"的数字。
- 实际生效的数量上限来自 `building.cap`（游戏自带的建筑数量硬上限，个别建筑才有）和 `options.maxTarget`（全局统一默认 80，与具体资源/存储状况无关）。
- 手动兜底方式是 `state.options.smartBuild.manualOverrides` 开关 + UI 逐建筑填写数量上限和优先级（`applyManualOverrides`/`applyResearchManualOverrides`）——这正是本次要让用户彻底脱离的日常操作方式。

已确认但**不需要重新建模**的事实：`getResourceMap()`（`10-game-state-adapter.js`）里 `resources.get(id)` 返回的 `{current, max, speed}` 已经是游戏引擎实时结算后的值，声望/传承（Prestige）加成、已建成的所有仓储建筑的贡献都已经计入 `max`；`speed` 是净速率（产出减消耗后的结果）。因此本设计**不单独读取或计算声望系数**，直接用这几个实时字段。

同一资源可能由多种不同建筑贡献存储上限这件事，已经由现有的 `getResourceCapShortfalls`/`applyCapBridgeTargets`（`40-build-scoring.js`）处理——它们遍历所有带 `gen.type==='cap'` 的建筑，不限定某一种。本次设计只在这一点上做一处收紧（见"③ 存储缺口候选建筑的可建性过滤"），不重做这套机制。

## 目标

1. 为产出类建筑提供一个基于实时存储状况的显式数量上限，替代目前"全局拍脑袋 80"的默认行为，使规划器不再需要用户手动逐建筑填写数量上限。
2. 支持"泰坦"级建筑：一旦某个泰坦建筑建成，可按目标（goal）削减甚至清零某些普通产出建筑的目标数量，用可维护的数据表表达，不需要用户在 UI 里配置。
3. 修正存储缺口候选建筑选择逻辑，使其只考虑当前已可建造（结构性解锁）的建筑，避免规划器把某资源的存储缺口"寄望"于一个还需要好几个科技才能解锁的仓储建筑，从而压低了当前就能建造的替代建筑应得的优先级。
4. 不改动现有 `manualOverrides` UI 和逻辑，继续作为兜底 fallback。

## 非目标

- 不对"未来还会建更多仓储建筑、存储上限还会继续涨"做预测/仿真。上限计算只用当前实时 `res.max`/`res.current`/`res.speed`，随规划器每轮重新调用自动跟着 `res.max` 的变化重算——不需要额外建模。
- 不改动 Research/Explore/Army 相关评分逻辑，也不改动 `30-dangerous-fight-gate.js` 里已有的危险战斗安全闸门（2026-08-26 早些时候已完成的另一项独立修复）。
- 不移除或弱化 `manualOverrides` UI，本次改动只影响自动路径的默认行为。

## 设计

### ① 生产类建筑数量上限——边际填满时间阈值法

新增函数 `getProductionStorageCap(building, resourceMap, options)`，放在 `40-build-scoring.js`：

- 遍历 `building.gen` 中 `type === 'resource' && value > 0` 的每一项（即该建筑对某资源的产出贡献）。
- 对每个资源项，计算"如果再多建一个该建筑，净速率会变成多少"：`projectedSpeed = res.speed + item.value`（`item.value` 即单体建筑的产出贡献，非负）。
- 若 `projectedSpeed <= 0`（净速率仍不为正，即消耗/衰减抵消了新增产出），不设上限（该资源尚未过剩，继续走原有评分逻辑）。
- 否则计算剩余仓容填满所需秒数：`secondsToFill = (res.max - res.current) / projectedSpeed`。
- 若 `secondsToFill` 低于阈值常量（`PRODUCTION_STORAGE_CAP_SECONDS`，默认 90，内置常量，不开放 UI 配置），则该资源项判定为"已过剩"，对应上限为 `getCount(building)`（即当前已建数量，不再多建）。
- 建筑可能同时产出多种资源（`building.gen` 里有多条 `resource` 记录）；只要**任意一种**产出资源判定为过剩，就封顶——用最严格（最小）的那个上限。
- 若没有任何产出资源项触发阈值，返回 `Infinity`（不设额外上限，交给其他上限来源决定）。

接入点：`getTargets`（`40-build-scoring.js` 现有函数）里计算 `max` 的那一行：

```js
const max = Math.min(
  cap,
  Number(options.maxTarget) || smartBuildDefaults.maxTarget,
  count + Math.min(Number(options.maxExtra) || smartBuildDefaults.maxExtra, toExtra(score)),
  getProductionStorageCap(building, resourceMap, options)
);
```

`options.maxTarget`（默认 80）保留作为兜底上限，不删除——多数场景下会先被存储阈值封顶，`maxTarget` 只在存储未构成瓶颈时兜底生效。

`applyRouteTargets`/`applyCapBridgeTargets`/`applyDangerousBattleBuildingTargets` 这几个"强制推荐"路径（route 白名单、危险战斗备战、存储缺口桥接）**不接入这条存储上限**——它们本身就是明确的"这个建筑现在必须造"信号，优先级高于泛化的产出过剩判断，不应被这条新规则误伤。

### ② 泰坦类建筑替代关系

`00-data-tables.js` 新增数据表：

```js
const smartBuildTitanOverrides = {
  // key: 泰坦建筑 id
  some_titan_building_id: {
    replaces: [
      // capFactor 是对"该建筑本来会算出的目标数量"的乘数；0 表示完全不用造
      { id: 'ordinary_building_id', capFactor: 0.3 },
      { id: 'another_building_id', capFactor: 0 }
    ],
    // 可选：不填则对所有目标（goal）都生效；填了则只在列出的 goal 下生效
    goals: ['moonlightNight']
  }
};
```

首个版本只需要一个空表结构 + 应用逻辑，具体填哪些泰坦建筑/替代关系由后续单独确认（游戏内数据需要用户或 `files/theresmore/main.js` 核实，不在本次实现范围内一次性穷举）。

应用逻辑：在 `getTargets` 算出 `targets[building.id]`（原始目标数量）之后，新增一步 `applyTitanOverrides(targets, options)`：

- 遍历 `smartBuildTitanOverrides` 的每个泰坦条目，仅当 `getCount(titanBuilding) >= 1`（已建成，不是"已解锁"）时生效。
- 若配置了 `goals` 且当前 `options.goal` 不在其中，跳过。
- 对 `replaces` 里的每个条目，若 `targets[replace.id]` 存在，`targets[replace.id] = Math.floor(targets[replace.id] * replace.capFactor)`；`capFactor <= 0` 时直接删除/置 0（对应"完全不用造了"）。

### ③ 存储缺口候选建筑的可建性过滤

新增通用 helper `isBuildingUnlocked(building)`（放在 `10-game-state-adapter.js`，与 `getCount`/`isTechCompleted` 同层），逻辑参考 `30-dangerous-fight-gate.js` 里已有的 `isDangerousResearchStructurallyReady`，抽成通用版本：

```js
const isBuildingUnlocked = building => {
  if (!building.req) return true;
  return building.req.filter(req => req.type !== 'resource').every(req => {
    if (req.type === 'building') {
      const prereq = buildings.find(item => item.id === req.id);
      return !!prereq && getCount(prereq) >= req.value;
    }
    return isUnlockCompleted(req.type, req.id);
  });
};
```

修改 `applyCapBridgeTargets`（`40-build-scoring.js`）：现有的 `buildings.filter(building => building.tab === allowedTab && building.gen)` 增加一个条件 `&& isBuildingUnlocked(building)`——只有当前已可建造的候选才会被视为"能补足这个资源的存储缺口"。`getCapShortfallBonus`（评分阶段的软性加分，不是选定"由谁来解决缺口"）不受影响，仍对所有匹配的建筑独立加分，锁定建筑即使加了分也不会被下游点击逻辑实际操作，不构成问题。

### ④ 现有手动配置

不改动。`manualOverrides`、`applyManualOverrides`、`applyResearchManualOverrides` 及对应 UI 保持原样，继续作为兜底 fallback；本次新增的自动上限计算发生在 `applyManualOverrides` 之前（即 `getTargets` 末尾仍是 `return applyManualOverrides(targets, manualOptions, options)`），手动填写的值一如既往地拥有最终覆盖权。

## 数据流小结

```
getTargets(subpage, manualOptions)
  └─ 对每个建筑: scoreBuilding → toPriority/toExtra
       └─ max = Math.min(building.cap, options.maxTarget, count+toExtra 步进, getProductionStorageCap)  // ①
  └─ applyCapBridgeTargets   // ③ 新增 isBuildingUnlocked 过滤
  └─ applyDangerousBattleBuildingTargets  // 不变
  └─ applyRouteTargets       // 不变
  └─ applyTitanOverrides     // ② 新增，按 capFactor 缩减/清零目标
  └─ applyManualOverrides    // ④ 不变，兜底覆盖
```

## 影响文件

- `automation-src/fragments/smart-build-planner/00-data-tables.js`：新增 `smartBuildTitanOverrides`（空表结构）。
- `automation-src/fragments/smart-build-planner/10-game-state-adapter.js`：新增 `isBuildingUnlocked`。
- `automation-src/fragments/smart-build-planner/40-build-scoring.js`：新增 `getProductionStorageCap`、`applyTitanOverrides`；修改 `getTargets`（接入①④）、`applyCapBridgeTargets`（接入③）。
- 完成后需要：`automation-src/build.ps1` 重新构建 → `node --check` 校验 → `codemap regen --repo theresmore` → 同步更新 `.codemap-conventions.md`。

## 测试/验证方式

本项目没有自动化测试，遵循既有模式：构建 + 语法检查后，交由用户实机验证——具体验证点建议：
1. 某资源（如 food/wood）产出建筑数量接近存储瓶颈时，是否会在到达阈值后停止继续提升目标数量（`getTargets` 返回的目标值不再增长）。
2. 存储建筑建成后 `res.max` 变大，下一轮规划该资源产出建筑目标数量是否随之提高。
3. （泰坦表首次填入具体数据后）泰坦建成前后，对应普通建筑目标数量是否按 `capFactor` 正确变化。
4. 存储缺口场景下，`applyCapBridgeTargets` 是否不再把目标算到一个还未解锁的仓储建筑上。

## 开放问题（不阻塞本次实现，后续按需处理）

- `smartBuildTitanOverrides` 首版只搭框架，具体游戏内泰坦建筑 id、`replaces` 列表、`capFactor` 数值需要后续单独确认填充。
- `PRODUCTION_STORAGE_CAP_SECONDS` 阈值（默认 90 秒）是否需要按资源类型（如 `research` vs `food`）区分不同阈值，留待实机验证后再调。

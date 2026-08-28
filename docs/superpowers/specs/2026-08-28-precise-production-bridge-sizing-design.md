# 生产速率桥接精算化：用岗位数据表替代经验值 —— 设计 spec

日期：2026-08-28
范围：
- `automation-src/fragments/smart-build-planner/40-build-scoring.js`（`getResourceProductionShortfalls`
  不变；新增 `getJobForBuilding`/`getBuildingResourceRate`，重写 `applyProductionBridgeTargets` 的桥接
  数量计算方式，由"渐进式 `count+maxExtra`"改为"精算需要几个"）
- `automation-src/fragments/smart-build-planner/00-data-tables.js`（移除 `moonlightNight` 里
  `artisan_workshop`/`carpenter_workshop` 的手工 `target: 3`）

关系：直接延续 `2026-08-27-goal-driven-resource-production-bridge-design.md`（commit `76b1ec0` 已实现
`registerResourceProductionShortfall`/`getResourceProductionShortfalls`/`applyProductionBridgeTargets`）。
上一版把"岗位坑位型"产出建筑（`carpenter_workshop`/`artisan_workshop`）列为非目标，只能靠
`target: 3` 经验值兜底；本次补上这块，同时把"直接资源型"建筑的桥接方式从渐进式改成精算。

## 背景与问题

用户诉求：不满足于"3 是经验起点，不是精算结果"这种手工拍数字的兜底，希望"以实现目标的路径为主，
自动计算各个建筑上限"，覆盖：

1. **直接资源型建筑**（如 `guild_of_craftsmen`，`building.gen` 里有明确的
   `{type:'resource', value:0.2}`）——现有 `applyProductionBridgeTargets` 只会
   `count + maxExtra` 渐进式加一点，检测到缺口就加，不去算"到底还差几个才够"，需要好几轮才能补够。
2. **岗位坑位型建筑**（如 `carpenter_workshop`/`artisan_workshop`/`quarry`）——`building.gen` 只有
   `{type:'population', id:<job>}` 坑位，没有直接的资源产出速率，上一版认定"游戏引擎岗位表数据本项目
   拿不到"，只能手工兜底。

**关键发现**（`Grep`/`Read` 直接定位，未派 subagent）：用户提供的 `files/theresmore/main.js`
（网页端游戏源码抓取）第56341-56495行有一个岗位数据数组（压缩变量名 `Be`），完整记录了20个岗位的
`id`/`req`（所需建筑）/`gen`（基础产出+消耗速率）。进一步核实发现，**这份数据本项目其实早就有**——
`automation-src/base/Theresmore-Automation_4.14.4.base.user.js` 第18941行 `var jobs = [...]` 就是
同一份岗位表（格式化版本，内容与 `main.js` 的 `Be` 完全一致），跟 `buildings`（302行）/`tech`
（33038行）/`units`（42037行）一样是 base 模板里已存在的全局引用数据，fragments 可以直接引用
`jobs`，**不需要新增数据表、也不需要从 `files/theresmore` 抄数据**——这是本次探查后对最初设想的
修正，实现比预想的更简单。

岗位表关键条目示例（`carpenter_workshop`→`carpenter` 岗位）：

```js
{
  id: 'carpenter',
  req: [{ type: 'building', id: 'carpenter_workshop', value: 1 }],
  gen: [
    { type: 'resource', id: 'building_material', value: 0.3 },
    { type: 'resource', id: 'wood', value: -3 },
    { type: 'resource', id: 'stone', value: -1.5 },
    { type: 'resource', id: 'tools', value: -0.5 }
  ]
}
```

`quarry`→`quarryman`（基础 `stone: 0.6`）、`artisan_workshop`→`artisan`（`gold: 0.5`、`tools: 0.3`）
同理。

## 目标

### 1. 岗位坑位型建筑识别（`40-build-scoring.js` 新增）

```js
const getJobForBuilding = building => {
  const slot = (building.gen || []).find(item => item.type === 'population' && item.id);
  return slot ? jobs.find(job => job.id === slot.id) || null : null;
};
const getBuildingResourceRate = (building, resourceId) => {
  const direct = (building.gen || []).find(item => item.type === 'resource' && item.id === resourceId);
  if (direct) return direct.value;
  const job = getJobForBuilding(building);
  const jobGen = job && (job.gen || []).find(item => item.type === 'resource' && item.id === resourceId);
  return jobGen ? jobGen.value : 0;
};
```

- `getBuildingResourceRate` 统一了"直接资源型"（走 `building.gen`）和"岗位坑位型"（走
  `jobs` 表反查到的 `job.gen`）两种取数路径，返回值可能为负（净消耗，如 carpenter 对 wood 是
  `-3`），调用方必须自己判断 `>0` 才算"能缓解缺口"。
- 只精确匹配 `building.gen` 里的 `{type:'population', id}` 与 `jobs` 表的 `job.id`，两者用的是同一套
  岗位 id 命名（如 `quarryman`/`carpenter`/`artisan`），不需要额外的映射表。

### 2. `applyProductionBridgeTargets` 精算化（替换现有实现，40-build-scoring.js 第328-347行）

现状（commit `76b1ec0`）：

```js
const helpsProduction = building.gen.find(gen => gen.type === 'resource' && gen.value > 0 && shortfalls[gen.id]);
if (!helpsProduction) return;
...
const bridgeMax = Math.min(cap, count + Math.max(1, Number(options.maxExtra) || smartBuildDefaults.maxExtra));
```

改为：

```js
const applyProductionBridgeTargets = (targets, subpage, resourceMap, options) => {
  const goal = getGoal(options);
  const route = getRoute(options);
  const shortfalls = getResourceProductionShortfalls(goal, route, resourceMap, options);
  if (!Object.keys(shortfalls).length) return targets;
  const allowedTab = CONSTANTS.SUBPAGES_INDEX[subpage] + 1;
  const maxWaitSeconds = Number(options.maxWaitSeconds) || smartBuildDefaults.maxWaitSeconds;
  buildings.filter(building => building.tab === allowedTab && building.gen && isBuildingUnlocked(building)).forEach(building => {
    const isGoalRelevant = getStructuralTechFloor(building) > 0 || getFocusOrRouteTarget(building, goal, route) > 0;
    if (!isGoalRelevant) return;
    const applicableShortfalls = Object.values(shortfalls).filter(shortfall => getBuildingResourceRate(building, shortfall.id) > 0);
    if (!applicableShortfalls.length) return;
    const count = getCount(building);
    const cap = getStageCap(building, options);
    if (count >= cap) return;
    const neededExtra = applicableShortfalls.reduce((maxExtra, shortfall) => {
      const perUnitRate = getBuildingResourceRate(building, shortfall.id);
      const requiredSpeed = shortfall.deficit / maxWaitSeconds;
      const extraSpeedNeeded = Math.max(0, requiredSpeed - shortfall.speed);
      return Math.max(maxExtra, Math.ceil(extraSpeedNeeded / perUnitRate));
    }, 1);
    const bridgeMax = Math.min(cap, count + neededExtra);
    if (bridgeMax <= count) return;
    targets[building.id] = Math.max(targets[building.id] || 0, bridgeMax);
    targets[`prio_${building.id}`] = Math.max(targets[`prio_${building.id}`] || 0, 9);
  });
  return targets;
};
```

要点：
- `applicableShortfalls`：一个建筑（或它对应的岗位）可能同时缓解多个资源缺口（如某岗位一次产出
  两种资源），取每个缺口各自需要的"还要建几个"里的**最大值**，保证任一缺口都能被这一次桥接补上，
  不是简单取第一个匹配就停。
- 精算公式：`requiredSpeed = deficit / maxWaitSeconds` 是"要在限定时间内补上缺口所需的净产出速率"，
  `extraSpeedNeeded = requiredSpeed - shortfall.speed` 是"现有速率之外还差多少"，除以
  `perUnitRate`（每多建一个净新增多少速率）再向上取整，就是精确的新增建筑数量。
  `getResourceProductionShortfalls` 已经保证进入 `shortfalls` 的条目一定是
  `wait(=deficit/speed) > maxWaitSeconds`，所以 `extraSpeedNeeded` 恒为正，`Math.max(maxExtra, ...)`
  起始值 `1` 只是防御性下限，正常不会触发。
- `getBuildingResourceRate(...) > 0` 的过滤保证净消耗方向的岗位（如 carpenter 对 wood/stone/tools）
  不会被误判成"能缓解缺口"。
- 不再使用 `options.maxExtra`（那是"一般评分"渐进扩张用的步长，跟这里"精算到位"的语义不同，继续
  混用会让精算失去意义）。
- `isGoalRelevant`/`getStructuralTechFloor`/`getFocusOrRouteTarget`/`getStageCap`/
  `getResourceProductionShortfalls` 均沿用现有实现，不改动。

### 3. 移除手工经验值（`00-data-tables.js`）

```js
// smartBuildRoutes.moonlightNight.buildingTargets
{ id: 'artisan_workshop', priority: 8, reason: 'moonlight whitelist' },  // 去掉 target: 3

// smartBuildRoutes.moonlightNight.supportTargets
{ id: 'carpenter_workshop', priority: 5 },  // 去掉 target: 3
```

依据：`expandPrerequisiteTargets`（`20-goal-routes.js` 第16行）对所有路线条目本身就有
`Math.max(1, Number(entry.target) || 1)` 的 fallback，去掉显式 `target: 3` 后两者仍会拿到
`target: 1` 的 `focusOrRouteTarget`（`isGoalRelevant` 判据不受影响），真正建到几个交给上面的精算
桥接机制决定——这跟 `guild_of_craftsmen`（现在也只给 `priority`，不给 `target`）待遇完全一致。

## 非目标

- **不叠加百分比 modifier**——`getBuildingResourceRate` 只用 `jobs` 表的基础速率，不去遍历
  `buildings`/`tech` 里对该岗位的 `{type:'modifier', type_id:'population', ...}` 加成（如 `quarry`
  自带对 `quarryman` 的 +100% 石头加成）。这会导致岗位坑位型建筑的精算结果偏保守（实际产出比算出来
  的高，可能多建一点）。用户已确认接受这个精度取舍，先用基础速率验证效果，后续如果偏差明显再考虑
  叠加 modifier。
- **不处理连锁消耗效应**——多建 `carpenter_workshop` 会增加 `wood`/`stone`/`tools` 消耗，可能诱发这些
  资源新的生产速率缺口。这属于 `getResourceProductionShortfalls`/`applyProductionBridgeTargets`
  既有机制的自然延伸（下一次调用会重新扫描所有资源的缺口，被对应生产建筑各自的桥接接住），不需要
  本次专门处理。
- **不改动 `applyCapBridgeTargets`（仓储桥接）**——那是"存不存得下"（`cap`），跟这次"产得够不够快"
  （`speed`）是两套独立机制，互不干扰，不在本次范围内。
- **不改动 `getResourceProductionShortfalls`/`registerResourceProductionShortfall`**——缺口识别逻辑
  不变，本次只改"识别出缺口后，用什么数据源、怎么计算该桥接几个"。
- **不影响其他目标下的产出建筑**——`getJobForBuilding`/`getBuildingResourceRate` 是通用机制，
  自动覆盖所有目标下所有"岗位坑位型"建筑（不止 `moonlightNight` 的三个），但只在真正检测到生产速率
  缺口时才会触发桥接，正常情况不受影响。
- **不涉及 base 模板改动**——`jobs` 是 base 模板里已存在的全局引用数据，本次只在 fragments 层读取，
  不修改 base 文件。

## 影响评估

- **预期改变**：`carpenter_workshop`/`artisan_workshop`/`quarry` 这类岗位坑位型建筑，在其对应岗位
  产出的资源出现"存量+生产速率都补不上"的缺口时，会被精算出具体需要新增的数量（而不是渐进式一次
  加 `maxExtra` 个，也不是手工经验值 `3`）；`guild_of_craftsmen` 这类直接资源型建筑同样从"渐进式"
  升级为"精算"，理论上能更快收敛到位。
- **已知取舍**：忽略 modifier 加成会让岗位坑位型建筑的精算结果偏保守（可能比实际需要的多建一点），
  但方向是安全的（不会建少，只会建多）；后续如果实机验证发现明显浪费资源，再考虑叠加 modifier 提高
  精度。
- **影响面**：`applyProductionBridgeTargets` 影响所有目标下所有产出型建筑的桥接数量计算方式，但只在
  真正出现生产速率缺口时才触发，不改变"要不要桥接"的判据（`getResourceProductionShortfalls`/
  `isGoalRelevant` 都不变），只改变"桥接到多少"的算法；`00-data-tables.js` 的改动只影响
  `moonlightNight` 一个目标的两个条目。

## 影响文件

- `automation-src/fragments/smart-build-planner/40-build-scoring.js`：新增
  `getJobForBuilding`/`getBuildingResourceRate`，重写 `applyProductionBridgeTargets`（第328-347行）。
- `automation-src/fragments/smart-build-planner/00-data-tables.js`：`smartBuildRoutes.moonlightNight`
  的 `artisan_workshop`（`buildingTargets`）、`carpenter_workshop`（`supportTargets`）两条目去掉
  `target: 3`。
- 完成后：`automation-src/build.ps1` 重新构建 → `node --check` 校验 → `codemap regen --repo
  theresmore` → 同步更新 `.codemap-conventions.md`。

## 测试/验证方式

本项目没有自动化测试，构建 + 语法检查后交由用户实机验证，建议验证点：

1. `moonlightNight` 目标下，`artisan_workshop`/`carpenter_workshop`/`quarry` 在检测到资源缺口时，
   是否会被精算出合理的目标数量（而不是卡在1个，也不是固定3个）。
2. 精算结果是否明显偏保守（因为忽略 modifier）——如果实机观察到产能远超需求（建多了很多），
   需要回头评估是否要叠加 modifier 提高精度。
3. `guild_of_craftsmen` 等直接资源型建筑的桥接收敛速度是否比渐进式（`count+maxExtra`）明显更快。
4. 其他目标（如 `progress`/`druid`）下，涉及岗位坑位型建筑的桥接是否只在真正出现资源速率缺口时才
   触发，没有对正常情况下的建筑目标产生误干扰。

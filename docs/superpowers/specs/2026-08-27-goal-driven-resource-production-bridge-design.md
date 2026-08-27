# 原料产出建筑数量兜底：目标建筑焦点数据修正 + 通用资源生产速率桥接 —— 设计 spec

日期：2026-08-27
范围：
- `automation-src/fragments/smart-build-planner/00-data-tables.js`（`smartBuildRoutes.moonlightNight`
  的 `buildingTargets`/`supportTargets` 数据修正）
- `automation-src/fragments/smart-build-planner/40-build-scoring.js`（新增
  `registerResourceProductionShortfall`/`getResourceProductionShortfalls`/
  `applyProductionBridgeTargets`，接入 `getTargets` 管线）

关系：延续同一天 `2026-08-27-goal-driven-build-ceiling-design.md`（commit `7bbc11e`）建筑侧重构、
`2026-08-27-goal-driven-research-gate-design.md`（commit `ca77716`）研究侧重构的同一条主线——把
"要不要做"的判断从打分驱动改为结构性信号驱动。本次解决的是这条主线暴露出的新缺口：目标建筑本身
需要消耗资源才能建造，但资源的**产出建筑**在 `buildingFocus`/`route` 里只拿到 fallback 的
`target: 1`，达标后 spec3 的新 floor 逻辑就不再继续扩建它们，导致资源产能跟不上目标建筑的建造需求。

## 背景与问题

用户反馈（以 `moonlightNight` 目标为例）：目标建筑 `watchman_outpost`（结构性 floor=4，来自
`moonlight_night` 科技 `req` 里 `{type:'building', id:'watchman_outpost', value:4}`）需要消耗原料
才能建造，而原料的产出建筑当前解锁到的是"木匠工坊"和"工匠公会"，这两个建筑需要建到"一定量"才能
撑起原料产能，不能只停在1个。

直接查证（`Read` base 文件确认，未派 subagent）：

- `watchman_outpost` 的 `req`：`wood 2000(multi1.4)`、`tools 1000(multi1.4)`、
  `supplies 100(multi1.4)`、`crystal 70(multi1.4)`。
- **`guild_of_craftsmen`**（用户说的"工匠公会"）的 `gen` 是**直接资源产出型**：
  `{type:'resource', id:'building_material', value:0.2}`、`{...id:'steel', value:0.2}`、
  `{...id:'crystal', value:0.1}`、`{...id:'supplies', value:0.1}`——直接对应 `watchman_outpost`
  需要的 `crystal`/`supplies`。当前只在 `smartBuildRoutes.moonlightNight.supportTargets` 里有
  `{id:'guild_of_craftsmen', priority:6}`，没有显式 `target`，`expandPrerequisiteTargets` fallback
  成 `target:1`。
- **`carpenter_workshop`**（用户说的"木匠工坊"）和 **`artisan_workshop`** 都是**岗位坑位型**产出：
  `gen` 里只有 `{type:'population', id:<job>}` 坑位 + 针对该岗位的百分比 `modifier`
  （如 `carpenter_workshop` 靠 `carpenter` 岗位百分比加成 `building_material`；`watchman_outpost`
  需要的 `tools` 是靠 `artisan` 岗位基础产出，`artisan_workshop` 提供 `artisan` 岗位坑位）——没有
  `type:'resource'` 的直接产出条目，岗位基础产出速率定义在游戏引擎的岗位表里，不在 `buildings`
  数据表中，本项目拿不到。这两个建筑同样卡在 `target:1`（`carpenter_workshop` 在
  `supportTargets`，`artisan_workshop` 在 `buildingTargets`）。

现有相关机制核对（`40-build-scoring.js`/`20-goal-routes.js` 已读全文）：

- `getFocusOrRouteTarget`/`getExpandedGoalFocusTargets`/`getExpandedRouteTargets`：只解决"建筑在
  焦点/路线列表里给多少 target"和"该建筑 `req.type==='building'` 的前置链"，不涉及"建造该建筑要
  消耗的资源，其产出建筑要建多少个"。
- `getResourceCapShortfalls`/`applyCapBridgeTargets`：已有的"仓储上限桥接"机制——当目标建筑/科技
  的资源成本超过当前仓储 `max`（cap）时，给能提供该资源 `cap` 的建筑临时提高 target。解决的是
  "存不存得下"，不是"产得够不够快"（`speed`，生产速率）。目前代码库里没有对应的"生产速率桥接"。
- `scoreBuilding`/`getCostWait`/`getBottleneckScore` 已经在读 `resourceMap[id].speed`（游戏引擎
  算好的净生产速率）和 `options.maxWaitSeconds`，可以直接复用，不需要自己从岗位表反推每个建筑的
  产出速率。

## 目标

采用"数据修正先救急 + 通用机制补长期缺口"的组合方案：

### 1. 数据修正（`00-data-tables.js`）——解决"岗位坑位型"产出建筑

`carpenter_workshop`、`artisan_workshop` 这类岗位坑位型建筑无法被下面的自动机制识别（原因见"非
目标"），只能手工修正 `moonlightNight` 的目标数据：

- `smartBuildRoutes.moonlightNight.buildingTargets` 里 `artisan_workshop` 条目加上 `target: 3`。
- `smartBuildRoutes.moonlightNight.supportTargets` 里 `carpenter_workshop` 条目加上 `target: 3`。

`3` 是经验起点，不是精算结果——跟 spec3 遗留的"quarry/artisan_workshop 默认值待验证"是同一类
待实机调优的开放数值，后续如果实机验证发现仍不够，再调整这两个数字即可，不涉及逻辑改动。

### 2. 通用资源生产速率桥接（`40-build-scoring.js`）——解决"直接产出型"产出建筑

新增一套镜像 `getResourceCapShortfalls`/`applyCapBridgeTargets`（仓储桥接）的对称机制，判据从
"仓储 `max` 够不够存"换成"生产 `speed` 够不够快"：

- 对 goal 的 `targetTechs`、以及 `route`/`buildingFocus` 展开出的目标建筑（且尚未达到各自 target）
  的资源成本 `req`，检查该资源当前的净生产速率能否在 `options.maxWaitSeconds` 内补上缺口；补不上
  就记为一个"生产速率缺口"。
- 对拥有 `gen.type==='resource' && value>0`（直接产出型）且能缓解该缺口的建筑，用跟
  `applyCapBridgeTargets` 相同的"渐进式桥接"（`count + maxExtra`，不超过 `getStageCap`）临时提高
  target 和优先级。
- 这套机制覆盖**所有目标**，不只是 `moonlightNight`——后续任何目标下，只要目标建筑需要的资源是由
  某个"直接产出型"建筑提供的，都会被自动识别和桥接，不需要再逐个目标手工发现问题。

## 非目标

- **不解决"岗位坑位型"产出建筑的自动识别**——这类建筑（如 `carpenter_workshop`、
  `artisan_workshop`）的实际产出速率取决于游戏引擎岗位表的基础产出值，不在 `buildings` 数据表里，
  本项目没有数据来源去精确计算"需要几个才够"，只能继续靠方向1的数据修正手工兜底。这是已知的覆盖
  盲区，不是本次要修的 bug。
- **不重新计算精确产能需求**——`applyProductionBridgeTargets` 只做"够不够快、不够就渐进式加建
  一点"的粗粒度桥接，不去反推"精确需要产出多少 wood/tools/秒"再一次性设置到位的目标值。这跟
  `applyCapBridgeTargets` 现有的渐进式风格一致，避免一次性冲到很高造成资源浪费。
- **不改动主循环的结构性 floor 计算**（`getStructuralTechFloor`/`getFocusOrRouteTarget`/
  `getTargets` 主循环）——`applyProductionBridgeTargets` 跟 `applyCapBridgeTargets`、
  `applyDangerousBattleBuildingTargets` 一样，是主循环算完 floor 之后的补丁桥接，不参与"结构性
  信号决定要不要造"这条主线的判断逻辑。
- **不涉及 base 模板改动**——本次两处改动都在 fragments 层，不需要碰
  `automation-src/base/*.base.user.js`。
- **不影响已有的仓储桥接（`applyCapBridgeTargets`）、危险战斗建筑桥接
  （`applyDangerousBattleBuildingTargets`）**——三者是同层级的独立补丁，互不干扰。

## 设计

### 2.1 数据修正（`00-data-tables.js`）

```js
// smartBuildRoutes.moonlightNight.buildingTargets
{ id: 'artisan_workshop', priority: 8, target: 3, reason: 'moonlight whitelist' },

// smartBuildRoutes.moonlightNight.supportTargets
{ id: 'carpenter_workshop', priority: 5, target: 3 },
```

只改这两个条目，其余 `buildingTargets`/`supportTargets` 条目不动。

### 2.2 生产速率桥接（`40-build-scoring.js`）

```js
const registerResourceProductionShortfall = (shortfalls, req, resourceMap, source, options) => {
  const res = resourceMap[req.id];
  if (!res) return;
  const cost = getResourceCost(req, source && Number.isFinite(source.count) ? source.count : 0);
  if (!cost || res.current >= cost) return;
  const deficit = cost - res.current;
  const wait = res.speed > 0 ? deficit / res.speed : Infinity;
  if (wait <= (Number(options.maxWaitSeconds) || 999)) return;
  if (!shortfalls[req.id] || shortfalls[req.id].deficit < deficit) {
    shortfalls[req.id] = { id: req.id, deficit, speed: res.speed };
  }
};

const getResourceProductionShortfalls = (goal, route, resourceMap, options) => {
  const shortfalls = {};
  getGoalTechs(goal).forEach(target => {
    (target.req || []).filter(req => req.type === 'resource').forEach(req =>
      registerResourceProductionShortfall(shortfalls, req, resourceMap, { count: 0 }, options));
  });
  [...getExpandedRouteTargets(route), ...getExpandedGoalFocusTargets(goal)].forEach(entry => {
    const building = buildings.find(candidate => candidate.id === entry.id);
    if (!building) return;
    const count = getCount(building);
    if (count >= entry.target) return;
    (building.req || []).filter(req => req.type === 'resource').forEach(req =>
      registerResourceProductionShortfall(shortfalls, req, resourceMap, { count }, options));
  });
  return shortfalls;
};

const applyProductionBridgeTargets = (targets, subpage, resourceMap, options) => {
  const goal = getGoal(options);
  const shortfalls = getResourceProductionShortfalls(goal, getRoute(options), resourceMap, options);
  if (!Object.keys(shortfalls).length) return targets;
  const allowedTab = CONSTANTS.SUBPAGES_INDEX[subpage] + 1;
  buildings.filter(building => building.tab === allowedTab && building.gen && isBuildingUnlocked(building)).forEach(building => {
    const helpsProduction = building.gen.find(gen => gen.type === 'resource' && gen.value > 0 && shortfalls[gen.id]);
    if (!helpsProduction) return;
    const count = getCount(building);
    const cap = getStageCap(building, options);
    if (count >= cap) return;
    const bridgeMax = Math.min(cap, count + Math.max(1, Number(options.maxExtra) || smartBuildDefaults.maxExtra));
    if (bridgeMax <= count) return;
    targets[building.id] = Math.max(targets[building.id] || 0, bridgeMax);
    targets[`prio_${building.id}`] = Math.max(targets[`prio_${building.id}`] || 0, 9);
  });
  return targets;
};
```

接入点：`getTargets` 里紧跟 `applyCapBridgeTargets(targets, subpage, resourceMap, options);` 之后
加一行：

```js
applyProductionBridgeTargets(targets, subpage, resourceMap, options);
```

要点：
- `registerResourceProductionShortfall` 的判据直接复用 `getResourceCost`（已存在）和
  `options.maxWaitSeconds`（已存在，`scoreBuilding` 里 `getCostWait` 已经在用同一个阈值），不引入
  新的可配置项。
- `getResourceProductionShortfalls` 的需求来源（`getGoalTechs`、`getExpandedRouteTargets`、
  `getExpandedGoalFocusTargets`）跟 `getResourceCapShortfalls`/`getRouteBuildingResourceCapShortfalls`
  是同一批已有函数，只是判断条件从"cap 够不够"换成"speed 够不够"，不新增数据依赖。
- `applyProductionBridgeTargets` 的桥接方式（`count + maxExtra`，不超过 `getStageCap`，
  `prio_${id}` 提到9）跟 `applyCapBridgeTargets`/`applyDangerousBattleBuildingTargets` 完全同构，
  保持代码风格一致。

## 影响评估

- **预期改变**：`guild_of_craftsmen` 这类直接产出型建筑，在其产出资源出现"存量不够、生产速率也
  补不上"的缺口时，会被自动追加建造目标，不再卡死在 `target:1`；`artisan_workshop`/
  `carpenter_workshop` 这类岗位坑位型建筑，在 `moonlightNight` 目标下会先建到显式设置的3个。
- **已知取舍**：`3` 这个数据修正的经验值可能不是最优解，需要实机验证后再调；岗位坑位型产出建筑的
  自动识别是本次明确放弃的范围，后续如果其他目标遇到类似问题，需要继续手工补数据。
- 影响面：数据修正只影响 `moonlightNight` 一个目标；`applyProductionBridgeTargets` 影响所有目标，
  但只在真正出现"存量+生产速率都补不上资源成本"时才会触发，正常情况（资源充裕）不会额外加建。

## 影响文件

- `automation-src/fragments/smart-build-planner/00-data-tables.js`：`smartBuildRoutes.moonlightNight`
  的 `artisan_workshop`（`buildingTargets`）、`carpenter_workshop`（`supportTargets`）两条目加
  `target: 3`。
- `automation-src/fragments/smart-build-planner/40-build-scoring.js`：新增
  `registerResourceProductionShortfall`/`getResourceProductionShortfalls`/
  `applyProductionBridgeTargets`，接入 `getTargets`。
- 完成后：`automation-src/build.ps1` 重新构建 → `node --check` 校验 → `codemap regen --repo
  theresmore` → 同步更新 `.codemap-conventions.md`。

## 测试/验证方式

本项目没有自动化测试，构建 + 语法检查后交由用户实机验证，建议验证点：

1. `moonlightNight` 目标下，`artisan_workshop`/`carpenter_workshop` 是否能建到3个（而不是卡在1个）。
2. `moonlightNight` 目标下，`guild_of_craftsmen` 在 `crystal`/`supplies` 产能不足以支撑
   `watchman_outpost` 建造时，是否会被自动追加建造目标。
3. `watchman_outpost` 建到4个的整体耗时是否比之前明显缩短（间接验证原料产能瓶颈是否缓解）。
4. 其他目标（如 `progress`/`druid`）下，`applyProductionBridgeTargets` 是否只在真正出现资源速率
   缺口时才触发，没有对正常情况下的建筑目标产生误干扰。

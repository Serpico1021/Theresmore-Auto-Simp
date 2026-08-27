# 研究选择改为结构性信号门槛驱动 + 修复 moonlightNight 危险科技安全阀未真正放行的问题 —— 设计 spec

日期：2026-08-27
范围：
- `automation-src/fragments/smart-build-planner/60-research-scoring.js`（`getResearchTargets`，
  新增门槛函数）
- `automation-src/base/Theresmore-Automation_4.14.4.base.user.js`（第47935行左右的危险科技门禁
  表达式，一行修复，经用户单独确认）
关系：延续同一天 `2026-08-27-goal-driven-build-ceiling-design.md`（commit `7bbc11e`）建筑侧的重构
思路——"结构性信号决定要不要做，打分只决定同批候选里先做哪个"，本次把同样的原则用到研究选择上；
同时补上 `2026-08-27-goal-scoped-dangerous-research-override-design.md`（commit `4725ee7`）遗留的
一个联动漏洞。

## 背景与问题

用户在验证建筑侧改动（commit `7bbc11e`）时反馈两个新问题：

1. **"无关的研究也没必要点"**——研究选择这一侧还留着建筑重构前的老问题。`60-research-scoring.js`
   的 `scoreResearch` 给几乎所有非危险科技一个固定基础分8（危险科技基础分4），只要不在
   `resetResearch`/`researchExcludes` 里，`toPriority(8)=3`，跟当前目标完全无关的科技也会被
   判定"该点"。跟建筑侧"打分决定建多少"是同一类问题的研究版本：打分本该只决定"已经确定要研究的
   候选里先点哪个"，却被当成了"要不要点"的唯一门槛。
2. **"在完成了4个守望者前哨后没有自动点击月明之夜"**——排查发现 `moonlight_night` 的结构性前置
   要求正是 `{type:'building', id:'watchman_outpost', value:4}`（游戏源码 `moonlight_night` 科技
   定义，`req` 数组），用户已经满足这个前置。但 base 模板研究点击循环（约47935行）里的门禁判断是
   一个 `||`：
   ```js
   const shouldCheckDangerousFight = state.options.pages[...].options.dangerousFights
     || smartBuildPlanner.shouldGateDangerousResearch(research.key);
   ```
   左边是游戏自带的"危险战斗检查"手动开关，跟目标 override 无关；右边才是 `4725ee7` 加的、
   `moonlightNight` 目标下会对 `moonlight_night` 返回 `false` 的 override。因为是 `||`，只要游戏
   自带开关是开的，整体判断依然是 `true`，继续拦截，导致 override 实际上没有生效。

## 目标

### 1. 研究门槛改为结构性信号驱动

只有命中以下任一结构性信号的科技才给非零优先级，其余一律0：

- `goal.targetTechs` 本身包含该科技（目标显式要研究的）。
- `getTechUnlockBonus(technology, options, goal, route) > 0`（该科技解锁的建筑是当前 goal 的
  `buildingFocus`/路线目标且还没达标）。
- `getPrayerTechBonus(technology, options, goal, route) > 0`（该科技解锁的祈祷术是当前目标想要的）。
- 递归展开出的**前置科技链**：以上三类"直接相关"科技各自沿着 `tech.req` 里 `type==='tech'` 的
  依赖，向上游递归展开出的全部未完成前置科技，同样视为相关（否则会出现"科技本身有用但卡在一个
  没被判定为相关的前置科技上永远点不到"的坑，跟建筑侧当初"farm 需要 breeding 科技"是同一类隐患）。

命中门槛后，仍然用现有 `scoreResearch`（含生产/资源加成、危险科技加成）计算优先级，决定同批候选
里先点哪个——打分逻辑本身不改。

### 2. 让 moonlightNight 的危险科技 override 真正生效

修改 base 模板门禁表达式，让 `shouldGateDangerousResearch` 返回 `false`（即当前 goal 的
`dangerousResearchOverrides` 命中该科技）时，无视游戏自带的 `dangerousFights` 手动开关，直接放行；
未命中时行为完全不变（游戏自带开关 `||` 我们的默认门禁，跟改动前一致）。

## 非目标

- 不改动 `scoreResearch` 内部打分公式（基础分、`getResearchProductionBonus`、危险科技加成等）——
  用户已明确这些留着继续参与"已过门槛的候选如何排序"，不参与"要不要研究"的判断。
- 不改动 `getTechUnlockBonus`/`getPrayerTechBonus` 本身的计算逻辑，只是把它们的返回值同时用作
  门槛信号（此前只用作加分项）。
- 不改动 `resetResearch`/`researchExcludes`/手动覆盖（`applyResearchManualOverrides`）的优先级和
  生效顺序——它们仍然分别在"直接返回0"和"最终覆盖"两处不变。
- 不改动 `getBlockedDangerousFights`/`getNextDangerousFight`（备战建筑打分用的另一套判断，跟
  "要不要点研究"是独立逻辑，`4725ee7` 已确认不受影响，本次同样不涉及）。
- base 模板改动只限于第47935行左右这一处门禁表达式，不做其他任何调整；这是经用户针对这一具体
  改动单独确认过的"新子系统接入点"例外，不代表放开"允许直接改 base 模板"的一般性授权。

## 设计

### 2.1 研究门槛（`60-research-scoring.js`）

```js
const isDirectlyRelevantResearch = (technology, options, goal, route) =>
  (goal.targetTechs || []).includes(technology.id) ||
  getTechUnlockBonus(technology, options, goal, route) > 0 ||
  getPrayerTechBonus(technology, options, goal, route) > 0;

const expandTechPrerequisites = seedIds => {
  const result = new Set();
  const visiting = {};
  const visit = techId => {
    if (result.has(techId) || visiting[techId] || isTechCompleted(techId)) return;
    const technology = tech.find(item => item.id === techId);
    if (!technology) return;
    visiting[techId] = true;
    result.add(techId);
    (technology.req || []).filter(req => req.type === 'tech').forEach(req => visit(req.id));
    visiting[techId] = false;
  };
  seedIds.forEach(visit);
  return result;
};

const getResearchTargets = (manualOptions = {}) => {
  const options = getOptions();
  if (!options.enabled || options.researchEnabled === false) return null;
  const goal = getGoal(options);
  const route = getRoute(options);
  const blockedFights = getBlockedDangerousFights(options);
  const relevantSeeds = tech
    .filter(technology => isDirectlyRelevantResearch(technology, options, goal, route))
    .map(technology => technology.id);
  const requiredPrereqs = expandTechPrerequisites(relevantSeeds);
  const targets = {};
  tech.forEach(technology => {
    const relevant = isDirectlyRelevantResearch(technology, options, goal, route) || requiredPrereqs.has(technology.id);
    targets[technology.id] = relevant ? toPriority(scoreResearch(technology, options, goal, route, blockedFights)) : 0;
  });
  getResearchGroups().forEach(group => {
    const members = (group.value || []).map(id => tech.find(technology => technology.id === id)).filter(Boolean);
    if (!members.length) return;
    const winner = members.reduce((best, candidate) => targets[candidate.id] > targets[best.id] ? candidate : best, members[0]);
    members.forEach(member => {
      if (member.id !== winner.id) targets[member.id] = 0;
    });
  });
  return applyResearchManualOverrides(targets, manualOptions, options);
};
```

要点：
- `isDirectlyRelevantResearch` 抽出来复用两次（先算种子集合，再算每个科技是否相关），逻辑跟原来
  `scoreResearch` 内联调用 `getTechUnlockBonus`/`getPrayerTechBonus` 是同一批函数，只是多了一层
  布尔判断，不新增数据依赖。
- `expandTechPrerequisites` 的写法直接参照 `20-goal-routes.js` 里 `expandPrerequisiteTargets`
  的递归展开模式（防环用 `visiting` 标记，已完成科技直接跳过），只是图的边从"建筑数量前置"换成
  "科技前置"（`tech.req` 里 `type==='tech'`），数据来源已用真实科技定义验证（`daylong_celebration`
  的 `req` 包含 `{type:'tech', id:'moonlight_night'}`）。
- `scoreResearch`/`getResearchGroups`/`applyResearchManualOverrides` 完全不变。

### 2.2 base 模板门禁表达式修复

第47935行左右，把：

```js
const shouldCheckDangerousFight = state.options.pages[CONSTANTS.PAGES.RESEARCH].subpages[CONSTANTS.SUBPAGES.RESEARCH].options.dangerousFights || smartBuildPlanner.shouldGateDangerousResearch(research.key);
```

改为（新增一个显式的 override 判断函数，命中时短路掉游戏自带开关）：

```js
const shouldCheckDangerousFight = smartBuildPlanner.isDangerousResearchOverridden(research.key)
  ? false
  : (state.options.pages[CONSTANTS.PAGES.RESEARCH].subpages[CONSTANTS.SUBPAGES.RESEARCH].options.dangerousFights || smartBuildPlanner.shouldGateDangerousResearch(research.key));
```

`isDangerousResearchOverridden`（新增到 `30-dangerous-fight-gate.js`）：

```js
const isDangerousResearchOverridden = researchKey => {
  const options = getOptions();
  if (!options.enabled) return false;
  const goal = getGoal(options);
  return (goal.dangerousResearchOverrides || []).includes(researchKey);
};
```

这样：
- 命中当前 goal 的 `dangerousResearchOverrides`（目前只有 `moonlightNight` 对 `moonlight_night`）
  时，无视游戏自带开关，直接放行到后续的 `canWinBattle`/`canWinNow` 判断（这两步不受影响，仍然会
  按当前军队实力决定具体这一刻是否开怼，只是不再被"要不要检查"这一步拦死）。
- 未命中时，`shouldCheckDangerousFight` 的取值跟改动前完全一样（游戏自带开关 `||`
  `shouldGateDangerousResearch` 的默认结果）。

## 影响评估

- **预期改变**：跟当前目标（`targetTechs`/解锁焦点建筑/解锁祈祷）及其前置科技链无关的科技不再被
  自动点击研究；`moonlightNight` 目标下，满足4个 `watchman_outpost` 后 `moonlight_night` 能被
  正常点击（受 `canWinBattle` 军队实力判断限制，不代表立刻开打，只是不再被门禁挡在检查这一步之前）。
- **已知取舍**：如果某个 goal 的 `targetTechs`/`buildingFocus`/`route` 数据本身遗漏了某个实际
  需要的科技或建筑（比如某条後续会用到的科技没写进 `targetTechs`），该科技会被判定为不相关而不再
  自动研究——这是数据完整性问题，需要在对应 goal 定义（`00-data-tables.js`）里补充，不是本次逻辑
  改动能自动兜底的。
- 影响面覆盖所有目标（不只是 `moonlightNight`）：其余目标下同样会从"几乎全点"变成"只点目标相关
  链条上的科技"，如果实机验证发现某个目标下漏点了本该点的科技，需要检查该 goal 的
  `targetTechs`/`buildingFocus`/`route` 是否完整覆盖，而不是回退本次逻辑。
- base 模板改动范围极小（一行表达式改写 + 一个新增的门禁判断函数调用），不影响 `dangerousFights`
  手动开关对其他目标/其他危险科技的行为。

## 影响文件

- `automation-src/fragments/smart-build-planner/60-research-scoring.js`：新增
  `isDirectlyRelevantResearch`/`expandTechPrerequisites`，重写 `getResearchTargets` 的门槛判断。
- `automation-src/fragments/smart-build-planner/30-dangerous-fight-gate.js`：新增
  `isDangerousResearchOverridden`。
- `automation-src/base/Theresmore-Automation_4.14.4.base.user.js`：第47935行左右门禁表达式改写
  （经用户单独确认的"新子系统接入点"例外）。
- 完成后：`automation-src/build.ps1` 重新构建 → `node --check` 校验 → `codemap regen --repo
  theresmore` → 同步更新 `.codemap-conventions.md`。

## 测试/验证方式

本项目没有自动化测试，构建 + 语法检查后交由用户实机验证，建议验证点：

1. `moonlightNight` 目标下，`watchman_outpost` 达到4个后，`moonlight_night` 是否能被自动点击
   研究（受当前军队实力/`canWinBattle` 限制，如果暂时打不过会继续等待，属预期行为）。
2. 其他目标下（如 `progress`）危险科技的安全检查是否依然正常拦截，未被误放行。
3. 跟当前目标无关的科技（不在 `targetTechs`/不解锁任何焦点建筑或祈祷/不是它们的前置）是否不再
   被点击研究。
4. 目标链条上的科技（`targetTechs` 本身、及其前置科技链）是否依然能正常按序点完，没有因为"前置
   科技被误判为不相关"而卡住。

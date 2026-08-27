# 危险科技安全阀按目标(goal)开例外 —— 设计 spec

日期：2026-08-27
范围：`automation-src/fragments/smart-build-planner/00-data-tables.js`（`smartBuildGoals` 数据）、
`automation-src/fragments/smart-build-planner/30-dangerous-fight-gate.js`（`shouldGateDangerousResearch`）
关系：直接建立在 2026-08-26 commit `50fa89c`（"decouple dangerous-research gate from armyEnabled"）
之上，不撤销那次修复，而是给它加一个按目标(goal)生效的例外通道。

## 背景与问题

`smartBuildDangerousFights`（`00-data-tables.js`）把一批"危险科技"（`moonlight_night`/
`dragon_assault`/`orc_horde` 等）映射到对应战斗（如 `army_of_goblin`）。base 模板的研究点击循环
（`Theresmore-Automation_4.14.4.base.user.js:47935`）在点击这些科技前，会先用
`smartBuildPlanner.shouldGateDangerousResearch(research.key)` 判断是否要走
`armyCalculator.canWinBattle(...)` 安全校验——打不赢就直接跳过，不点击，避免玩家在没准备好防御
的情况下被动触发死亡/被迫重开的战斗。

2026-08-26 的 commit `50fa89c` 把这个安全校验从"只在 `armyEnabled` 开启时生效"改成了"对所有
目标无条件生效"，直接原因是 `dragon_assault` 在 `armyEnabled=false` 时会绕过校验导致过一次真实
暴毙。这次修复本身是对的，不需要撤销。

但用户反馈：选择 `moonlightNight` 目标时，"月明之夜"（`moonlight_night`）科技一直不被自动研
究。排查确认：`moonlightNight` 是唯一一个以这项科技本身命名、并把它当作核心目标（而不是顺路
经过的中间科技）的 goal——用户原话确认这个目标下"就应该直接跳过安全检查"，因为触发这场战斗
（哥布林入侵）本身就是该目标要主动追求的结果，不是需要先备好必胜军队才谨慎触发的意外风险。

同时 `moonlight_night` 也出现在其余几乎所有 goal 的 `targetTechs` 里（`progress`/`wonderRush`/
`religionGrowth`/`richPath`/`lategame` 等，见 `00-data-tables.js` 第57-112行）——对这些目标来说，
它只是通往后续时代的必经科技之一，不是目标本身，理应继续保留安全校验，避免重演
`dragon_assault` 那次暴毙。

结论：**同一项危险科技，在不同 goal 下的"打不赢是否该跳过"预期不同**，不能用一个全局开关
（要么都查、要么都不查）覆盖，需要让每个 goal 自己声明"我这个目标下，哪些危险科技可以跳过
安全校验"。用户明确认可这个方向："每个目标应该直接对应一套配置"。

## 目标

1. 给 `smartBuildGoals` 里的 goal 数据结构新增一个可选字段 `dangerousResearchOverrides`
   （危险科技 id 数组）：列在这里的科技，在该 goal 生效时跳过 `canWinBattle` 安全校验，直接允许
   点击研究。
2. 只给 `moonlightNight` 这个 goal 填入 `dangerousResearchOverrides: ['moonlight_night']`；
   其余 goal 不填（保持 2026-08-26 commit 的安全阀行为不变，逐一沿用无条件校验）。
3. `shouldGateDangerousResearch` 读取当前 goal 的 `dangerousResearchOverrides`，命中则直接
   `return false`（不 gate），否则维持现有逻辑不变。

## 非目标

- 不新增用户可见的 UI 开关/manualOverrides 配置项——按项目"默认全自动、减少手动配置"的原则，
  这个例外由 goal 数据自身声明，选中 `moonlightNight` 目标即自动生效，不需要用户额外勾选。
- 不改动 `getBlockedDangerousFights`/`getNextDangerousFight`（`30-dangerous-fight-gate.js`
  第12-48行）——这两个函数驱动的是建筑/兵种打分加成（提前筹备防御），跳过研究点击的安全阀不代表
  不需要备战；`moonlightNight` 目标自身的 `buildingFocus`（`watchman_outpost` 优先级10，标注
  "moonlight gate"）和 `smartBuildBattleTemplates.army_of_goblin` 已经在做这件事，本次不触碰。
- 不改动 `resetResearch`/`research.confirm` 相关的点击后置流程（确认弹窗、NG流程等）——那是
  点击成功之后的处理，跟"要不要点"这个安全阀是两回事。
- 不为其余 goal 的 `dangerousResearchOverrides` 预先填充任何值——`dragon_assault` 等危险科技
  在其余 goal 下继续保持无条件安全校验，除非未来用户针对某个具体 goal 明确提出新的例外需求。

## 设计

**`00-data-tables.js`**：给 `moonlightNight` goal 对象新增一个字段（紧邻现有的 `resourceFocus`/
`buildingFocus`/`targetTechs`）：

```js
moonlightNight: {
  ...
  targetTechs: ['architecture', 'establish_boundaries', 'moonlight_night'],
  dangerousResearchOverrides: ['moonlight_night'],
  ...
}
```

**`30-dangerous-fight-gate.js`**：`shouldGateDangerousResearch` 增加一步"当前 goal 是否声明了
例外"的判断，其余逻辑不变：

```js
const shouldGateDangerousResearch = researchKey => {
  const options = getOptions();
  if (!options.enabled || !smartBuildDangerousFights[researchKey]) return false;
  const goal = getGoal(options);
  if ((goal.dangerousResearchOverrides || []).includes(researchKey)) return false;
  return true;
};
```

`getGoal` 已在 `20-goal-routes.js` 中定义（`smartBuildGoals[options.goal] || smartBuildGoals.progress`），
按现有 fragment 拼接顺序（`20-*` 早于 `30-*`）在此处可直接调用，无需额外传参或调整拼接顺序。

## 影响评估

- `moonlightNight` 目标下，"月明之夜"科技此后会直接被点击研究，不再等待
  `armyCalculator.canWinBattle('army_of_goblin', ...)` 返回 true——用户对此已明确知情并认可
  （"自杀转生"策略本身就不依赖打赢这场入侵）。
- 其余所有 goal（`progress`/`wonderRush`/`religionGrowth`/`richPath`/`lategame`）下，
  `moonlight_night` 以及 `dragon_assault` 等其他危险科技的安全校验行为完全不变，2026-08-26
  修复的暴毙防护继续对它们生效。
- 影响面严格限定在"点击研究前是否要求打得赢"这一个判断点，不影响该科技的打分权重
  （`scoreResearch` 里 `isDangerous` 判断与 `targetTechs` 加分逻辑不变）、不影响建筑/兵种备战
  加成逻辑。

## 影响文件

- `automation-src/fragments/smart-build-planner/00-data-tables.js`：给 `moonlightNight` goal
  新增 `dangerousResearchOverrides: ['moonlight_night']`。
- `automation-src/fragments/smart-build-planner/30-dangerous-fight-gate.js`：
  `shouldGateDangerousResearch` 增加 goal 级别例外判断。
- 完成后：`automation-src/build.ps1` 重新构建 → `node --check` 校验 → `codemap regen --repo
  theresmore` → 同步更新 `.codemap-conventions.md`（新增本次改动条目，并记录
  `dangerousResearchOverrides` 这个新字段的用途，方便以后其他 goal 需要类似例外时直接复用）。

## 测试/验证方式

本项目没有自动化测试，构建 + 语法检查后交由用户实机验证，建议验证点：

1. 选择 `moonlightNight` 目标、军队打不过 `army_of_goblin` 的情况下，"月明之夜"科技是否会被
   自动点击研究（不再无限跳过）。
2. 切换到其他目标（如默认 `progress`）、故意让军队打不过某个危险科技对应的战斗时，安全阀是否
   仍然生效、依然跳过点击——确认 2026-08-26 的暴毙防护没有被这次改动破坏。
3. `moonlightNight` 目标下研究完成后，watchman_outpost 等防御类建筑的打分/优先级是否照常运作
   （确认 `getBlockedDangerousFights` 驱动的备战加成没有受影响）。

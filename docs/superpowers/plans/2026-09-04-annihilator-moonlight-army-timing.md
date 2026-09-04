# 灭世目标月明之夜军队招募时机 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让灭世目标仅在月明之夜危险研究即将推进且地精战不可胜时，才开始招募侦察兵与重装战士。

**Architecture:** 在现有 annihilator Army planner 内增加一个小型时机判断，读取路径引擎已经计算的目标科技状态，并复用基础脚本的 `armyCalculator.canWinBattle`。判断不改变 Army 执行循环；只改变 `getAnnihilatorUnitTargets` 返回的临时目标，月明研究完成后回到现有灭世 stage 目标逻辑。

**Tech Stack:** Userscript JavaScript、PowerShell fragment merge、Node.js syntax check、Git。

---

### Task 1: 实现月明之夜军队时机判断

**Files:**
- Modify: `automation-src/fragments/annihilator-army-planner/20-annihilator-planner.js`

- [ ] **Step 1: 增加当前危险研究判定函数**

在现有 `getAnnihilatorUnitTargets` 前增加函数，使用 `getPath(getOptions(), getResourceMap())` 查找 `moonlight_night` 节点；只有该节点存在、未完成且状态为 `queued` 时才认为月明之夜已经进入当前可推进的目标。不要把“仅在 `targetTechs` 中存在”当作当前阶段。

```js
const isMoonlightNightResearchPending = () => {
  const path = getPath(getOptions(), getResourceMap());
  const node = path.nodesById['tech:moonlight_night'];
  return !!node && node.status === 'queued' && !isTechCompleted('moonlight_night');
};
```

- [ ] **Step 2: 增加地精战可胜判断**

增加一个安全包装函数，优先调用基础脚本的战斗模拟；模拟器不存在、调用抛错或返回非布尔值时按“不可胜”处理，以确保不会漏掉必要备战。

```js
const canWinMoonlightNightBattle = () => {
  try {
    const calculator = typeof armyCalculator !== 'undefined' ? armyCalculator : null;
    if (!calculator || typeof calculator.canWinBattle !== 'function') return false;
    const result = calculator.canWinBattle('army_of_goblin', true, false, state.options.autoSortArmy.enabled);
    return result === true;
  } catch (error) {
    return false;
  }
};
```

- [ ] **Step 3: 在目标生成入口接入闸门**

在 `getAnnihilatorUnitTargets` 中先处理月明之夜未完成的情况。未进入当前研究或已经可胜时返回 `{}`；进入当前研究且不可胜时继续使用现有 `annihilatorRoute.armyTargets` 生成固定目标及 `prio_* = 4`。月明研究完成后保留原有 current-stage 覆盖逻辑。

```js
const getAnnihilatorUnitTargets = configuredUnitsObject => {
  if (!isTechCompleted('moonlight_night')) {
    if (!isMoonlightNightResearchPending() || canWinMoonlightNightBattle()) return {};
  }
  const currentStages = getCurrentAnnihilatorStages();
  const configuredTargets = Object.fromEntries(Object.entries(annihilatorRoute.armyTargets || {}).flatMap(([unitId, qty]) => [
    [unitId, qty], [`prio_${unitId}`, 4]
  ]));
  if (!currentStages.length) return configuredTargets;
  const overrides = {};
  currentStages.forEach(stage => {
    Object.entries(stage.requiredArmy || {}).forEach(([unitId, qty]) => {
      overrides[unitId] = Math.max(overrides[unitId] || 0, qty);
    });
  });
  const targets = { ...configuredTargets };
  Object.entries(overrides).forEach(([unitId, qty]) => {
    targets[unitId] = qty;
    targets[`prio_${unitId}`] = 9;
  });
  return targets;
};
```

- [ ] **Step 4: Inspect the diff for scope**

Run `git diff -- automation-src/fragments/annihilator-army-planner/20-annihilator-planner.js` and confirm only the timing gate and its two helpers changed; do not modify Attack/Explore or the base Army loop.

### Task 2: Update the userscript version and rebuild

**Files:**
- Modify: `automation-src/base/Theresmore-Automation_4.14.4.base.user.js:10,56`
- Generate: `Theresmore-Automation_4.14.4_smart-build-planner.user.js`

- [ ] **Step 1: Increment both version declarations**

Change the base template `@version` and `taVersion` from `1.0.0.19` to `1.0.0.20`; leave unrelated metadata unchanged.

- [ ] **Step 2: Run the required merge**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File D:\Zarek\Theresmore\automation-src\build.ps1
```

Expected: the generated userscript is refreshed without a merge error.

- [ ] **Step 3: Validate syntax and version parity**

Run:

```powershell
node --check D:\Zarek\Theresmore\Theresmore-Automation_4.14.4_smart-build-planner.user.js
rg -n "@version|const taVersion" D:\Zarek\Theresmore\automation-src\base\Theresmore-Automation_4.14.4.base.user.js D:\Zarek\Theresmore\Theresmore-Automation_4.14.4_smart-build-planner.user.js
```

Expected: `node --check` succeeds, and both files contain `1.0.0.20`.

### Task 3: Verify behavior and hand off

**Files:**
- Inspect: `automation-src/fragments/annihilator-army-planner/20-annihilator-planner.js`
- Inspect: `automation-src/base/Theresmore-Automation_4.14.4.base.user.js`

- [ ] **Step 1: Run static behavior checks**

Confirm the generated fragment has these four outcomes: before `moonlight_night` is queued it returns `{}`; when queued and `army_of_goblin` is not winnable it returns the existing scout/heavy targets; when winnable it returns `{}`; after the research is completed it reaches the existing stage logic.

- [ ] **Step 2: Check repository state**

Run `git status --short` and ensure the generated userscript, base template, planner fragment, and design/plan documents are the only task-owned changes. Preserve unrelated existing files, including `files/202060903/`.

- [ ] **Step 3: Commit the implementation**

```powershell
git add -- automation-src/base/Theresmore-Automation_4.14.4.base.user.js automation-src/fragments/annihilator-army-planner/20-annihilator-planner.js Theresmore-Automation_4.14.4_smart-build-planner.user.js
git commit -m "调整灭世月明军队招募时机"
```

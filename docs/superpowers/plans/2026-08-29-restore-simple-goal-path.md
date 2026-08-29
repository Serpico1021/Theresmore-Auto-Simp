# Restore Simple Goal Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the fast, simple goal-path planner from `e779e4b` so post-reincarnation recalculation is lightweight and automatic building caps are not inflated by resource-cap bridging.

**Architecture:** Keep the current Goal Path UI and manual force-target flow, but restore the path engine and moonlight-night goal tables to their pre-optimization implementation. The generated userscript is rebuilt from the maintained fragments.

**Tech Stack:** JavaScript fragments, PowerShell, Git, Node.js.

---

### Task 1: Restore the baseline planner data and path engine

**Files:**
- Modify: `automation-src/fragments/smart-build-planner/00-data-tables.js`
- Modify: `automation-src/fragments/smart-build-planner/30-path-engine.js`
- Modify: `automation-src/fragments/smart-build-planner/40-path-output.js`

- [x] **Step 1: Confirm the restoration source and preserve unrelated work**

Run:

```powershell
git diff -- automation-src/fragments/smart-build-planner/00-data-tables.js automation-src/fragments/smart-build-planner/30-path-engine.js
```

Expected: only the current uncommitted cap/provider changes are present in the three path files; changes in `smart-build-goal-path-panel.js` remain outside this task.

- [x] **Step 2: Restore the two fragments from the approved baseline**

Run:

```powershell
git show e779e4b:automation-src/fragments/smart-build-planner/00-data-tables.js | Set-Content -LiteralPath 'automation-src/fragments/smart-build-planner/00-data-tables.js' -Encoding utf8
git show e779e4b:automation-src/fragments/smart-build-planner/30-path-engine.js | Set-Content -LiteralPath 'automation-src/fragments/smart-build-planner/30-path-engine.js' -Encoding utf8
git show e779e4b:automation-src/fragments/smart-build-planner/40-path-output.js | Set-Content -LiteralPath 'automation-src/fragments/smart-build-planner/40-path-output.js' -Encoding utf8
```

This restores the baseline goal data, engine, and output adapter, including simple resource-cap blocking and direct producer bootstrapping, while removing projected-cap expansion and the `maxTarget` cap inflation path.

- [x] **Step 3: Verify the removed logic and retained panel change**

Run:

```powershell
rg -n "resourceCapBridge|projectedResourceCaps|applyMoonlightNightFoodCoverage|postGoalBoundaryTechs|capProviderPreferences" automation-src/fragments/smart-build-planner/00-data-tables.js automation-src/fragments/smart-build-planner/30-path-engine.js
git diff --stat
```

Expected: the first command returns no matches; the diff still shows the existing Goal Path panel change and no edits to unrelated files.

### Task 2: Rebuild and validate the generated userscript

**Files:**
- Modify: `Theresmore-Automation_4.14.4_smart-build-planner.user.js`

- [x] **Step 1: Rebuild from fragments**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File 'D:\Zarek\Theresmore\automation-src\build.ps1'
```

Expected: the root generated userscript is regenerated without errors.

- [x] **Step 2: Validate syntax and whitespace**

Run:

```powershell
node --check 'D:\Zarek\Theresmore\Theresmore-Automation_4.14.4_smart-build-planner.user.js'
git diff --check
```

Expected: Node exits successfully and `git diff --check` reports no errors.

- [x] **Step 3: Inspect the final scope**

Run:

```powershell
git status --short
git diff --stat
```

Expected: the generated userscript reflects the restored fragments; the only task-related changes are the two restored fragments, the generated userscript, the existing panel modification, and the committed design/plan documentation. No files under `files` are modified.

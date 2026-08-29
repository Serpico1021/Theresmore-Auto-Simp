# Moonlight Night Building Minimums Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `moonlightNight` route maintain at least five farms, lumberjack camps, quarries, and mines.

**Architecture:** Reuse the existing route `supportTargets` data model. Add `target: 5` to the four existing/required building entries without changing planner logic or other goals.

**Tech Stack:** JavaScript userscript fragments, PowerShell build script, Node.js syntax checker.

---

### Task 1: Add moonlightNight building minimums

**Files:**
- Modify: `automation-src/fragments/smart-build-planner/00-data-tables.js:33-42`
- Regenerate: `Theresmore-Automation_4.14.4_smart-build-planner.user.js`

- [ ] **Step 1: Update route data**

In `smartBuildRoutes.moonlightNight.supportTargets`, set `target: 5` on `farm` and `lumberjack_camp`, set it on the existing `quarry` entry in `buildingTargets` or its support entry according to the current route structure, and add `mine` with `target: 5`. Preserve existing priorities and route semantics.

- [ ] **Step 2: Rebuild the generated userscript**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File D:\Zarek\Theresmore\automation-src\build.ps1
```

Expected: the generated userscript is updated from the source fragments without build errors.

- [ ] **Step 3: Validate generated syntax**

Run:

```powershell
node --check D:\Zarek\Theresmore\Theresmore-Automation_4.14.4_smart-build-planner.user.js
```

Expected: exit code 0 and no syntax errors.

- [ ] **Step 4: Review the diff**

Run `git diff --check` and inspect that only the intended route data and generated output changed.

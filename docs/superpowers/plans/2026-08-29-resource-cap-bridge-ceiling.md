# Resource Cap Bridge Ceiling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent resource-cap bridge calculations from inflating mine and titan work area targets to the global ceiling of 80.

**Architecture:** Keep the existing goal-path engine and projected-cap model, but cap each automatic `resourceCapBridge` expansion to one configured incremental step (`maxExtra`) per path calculation. Add copper/iron provider preferences so early resource-cap bridging selects the mine before the later titan work area. The generated userscript remains a build artifact produced by the existing merge script.

**Tech Stack:** JavaScript fragments, PowerShell build script, Node syntax validation.

---

### Task 1: Constrain resource-cap bridge expansion

**Files:**
- Modify: `automation-src/fragments/smart-build-planner/30-path-engine.js`

- [ ] **Step 1: Change the bridge target calculation**

In `resolveResourceReqs`, calculate the requested provider target as before, then limit the target used for this pass to `currentTarget + maxExtra`, while retaining `maxTarget` as the absolute ceiling. Update projected capacity using the actual limited target so later nodes do not assume the skipped expansions already exist.

- [ ] **Step 2: Preserve existing behavior for valid small expansions**

Keep the existing `extraCount` calculation and provider node resolution. A bridge needing one or a few buildings must still add the required count when it is within the configured incremental step; only oversized expansions are deferred to later recalculations.

### Task 2: Prefer the mine for copper and iron capacity

**Files:**
- Modify: `automation-src/fragments/smart-build-planner/00-data-tables.js`

- [ ] **Step 1: Add early-resource provider preferences**

Add `copper: ['mine', 'titan_work_area']` and `iron: ['mine', 'titan_work_area']` to the moonlight-night cap provider preferences, preserving titan work area as a fallback without allowing its larger late-game capacity to win over the mine.

### Task 3: Rebuild and validate the generated userscript

**Files:**
- Modify: `Theresmore-Automation_4.14.4_smart-build-planner.user.js`

- [ ] **Step 1: Run the merge script**

Run `powershell -ExecutionPolicy Bypass -File D:\Zarek\Theresmore\automation-src\build.ps1`.

- [ ] **Step 2: Validate syntax and whitespace**

Run `node --check D:\Zarek\Theresmore\Theresmore-Automation_4.14.4_smart-build-planner.user.js` and `git diff --check`.

- [ ] **Step 3: Inspect the final diff**

Confirm only the planned fragments, generated userscript, and this plan are changed; preserve all pre-existing user changes in unrelated files.

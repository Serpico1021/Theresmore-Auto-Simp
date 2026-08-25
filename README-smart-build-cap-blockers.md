# Smart Build 资源上限阻碍处理记录

本次优化针对一种很常见的卡点：目标研究或阶段推进需要某项资源达到指定数量，但当前资源上限不足，导致脚本一直等待也无法完成。

典型例子：

- 研究 `确定边界` / `establish_boundaries`
- 需求包含：
  - 研究点：12000
  - 黄金：10000
  - 前置研究：建筑学
- 如果当前黄金上限低于 10000，脚本必须先补“提高黄金上限”的建筑，否则无法研究。

## 已加入的行为

维护片段：

- `C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\automation-src\fragments\smart-build-planner.js`

生成脚本：

- `C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\Theresmore-Automation_4.14.4_smart-build-planner.user.js`

主要逻辑：

1. 目标路线会读取 `targetTechs` 中研究的资源需求。
2. 如果某个目标研究需要的资源数量大于当前资源上限，就记录为 `cap shortfall`。
3. 建筑规划器会优先寻找 `gen.type === 'cap'` 且能提升对应资源上限的建筑。
4. 这些建筑会获得高分，并被临时加入 Build max/prio 目标。
5. 仍然遵守 `Max extra buildings per pass`，不会一次性把目标拉满，而是逐轮补齐。

## 路线目标链修正

为了让“确定边界”这类前置研究能被识别，已将它接入相关路线：

- Moonlight Night：
  - `architecture`
  - `establish_boundaries`
  - `moonlight_night`
- Druid Route：
  - `bronze_working`
  - `mathematic`
  - `religion`
  - `architecture`
  - `establish_boundaries`
  - `banking`
  - `knighthood`
  - `chemistry`
  - `moonlight_night`
  - `end_feudal_era`
  - `dragon_assault`
  - `magic_arts_teaching`
  - `mana_utilization`
  - `lonely_druid`
- Launch Annihilator：
  - `architecture`
  - `establish_boundaries`
  - `banking`
  - `knighthood`
  - `moonlight_night`
  - `end_feudal_era`
  - `dragon_assault`
  - `research_annhilator`
  - `create_annhilator`
  - `launch_annhilator`
  - `destroy_annhilator`

## 验证

已验证：

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\automation-src\build.ps1
node --check C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\Theresmore-Automation_4.14.4_smart-build-planner.user.js
```

同时审计了当前 `targetTechs` 中的 22 个研究 ID，均能在原 userscript 数据中找到。

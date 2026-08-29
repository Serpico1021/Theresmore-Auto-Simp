# THERESMORE Project Constraints

## Local Codex Workflow

- 默认使用中文沟通。
- 命令行优先使用 `bash`；当前环境没有 `bash` 时，使用 PowerShell 兜底。
- 涉及网络访问、受限目录写入或沙箱阻断的操作，默认请求升权执行。
- 过程 Update、状态汇报和最终摘要默认不超过 15 行，除非用户明确要求展开。
- 每个 session 开始先发送简短状态和下一步，再执行检查或修改。
- 单个命令优先控制在 30 秒内；可能耗时的构建、测试或搜索必须拆成可观察的独立命令。
- 可能超过 30 秒的任务要提前说明，并确保 60 秒内发送一次进度更新，避免无反馈触发 `Reconnecting...` 或 `Request timed out`。
- 禁止无界等待；命令超时后保留已获得结果，缩小范围分段继续执行。

## Output Location

All Theresmore-related outputs for this project should live under:

```text
C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE
```

## Automation Source Layout

The maintainable userscript source is split under:

```text
C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\automation-src
```

Important paths:

- Merge script:
  - `automation-src\build.ps1`
- Base userscript template:
  - `automation-src\base\Theresmore-Automation_4.14.4.base.user.js`
- Fragment directory:
  - `automation-src\fragments`
- Current fragment files:
  - `automation-src\fragments\smart-build-options.js`
  - `automation-src\fragments\smart-build-planner.js`
  - `automation-src\fragments\smart-build-panel.template.html`
- Generated userscript:
  - `Theresmore-Automation_4.14.4_smart-build-planner.user.js`

## Required Build Rule

Whenever any file under `automation-src\fragments` is modified, run the merge script before finishing the task:

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\automation-src\build.ps1
```

This updates:

```text
C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\Theresmore-Automation_4.14.4_smart-build-planner.user.js
```

After building, validate the generated userscript syntax:

```powershell
node --check C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\Theresmore-Automation_4.14.4_smart-build-planner.user.js
```

Do not hand-edit the generated userscript for smart-build changes unless the task is explicitly about regenerating or repairing the base template. Prefer editing fragments and rebuilding.


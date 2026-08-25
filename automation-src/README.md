# Theresmore Automation Source Layout

这个目录把 1MB 以上的打包用户脚本拆成“主模板 + 可维护片段”。

## 目录

- `base/Theresmore-Automation_4.14.4.base.user.js`
  - 原脚本主体。
  - 只保留少量 `@@SMART_BUILD_*@@` 占位符。
- `fragments/smart-build-options.js`
  - `state.options.smartBuild` 默认配置。
- `fragments/smart-build-planner.js`
  - 动态建筑目标规划器主体。
- `fragments/smart-build-panel.template.html`
  - Options 面板里的 `Smart build planner` UI。
- `build.ps1`
  - 自动合并脚本。

## 构建

在 PowerShell 中运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\automation-src\build.ps1
```

默认输出到上级目录：

```text
Theresmore-Automation_4.14.4_smart-build-planner.user.js
```

也可以指定输出：

```powershell
powershell -ExecutionPolicy Bypass -File .\automation-src\build.ps1 -OutputPath .\dist\bundle.user.js
```

## 必须遵守的维护约束

凡是修改 `automation-src/fragments/` 下的任何片段文件，都必须在任务结束前运行合并脚本：

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\automation-src\build.ps1
```

合并脚本会更新项目根目录的总脚本：

```text
C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\Theresmore-Automation_4.14.4_smart-build-planner.user.js
```

合并后还要运行：

```powershell
node --check C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\Theresmore-Automation_4.14.4_smart-build-planner.user.js
```

除非任务明确要求修复 base 模板，否则不要直接手改生成后的总脚本；优先改 `fragments/`，再构建。

## 修改建议

- 日常只改 `fragments/`。
- 只有从上游 Theresmore Automation 更新大版本时，才重新生成 `base/`。
- 构建后用 `node --check` 检查输出脚本语法。
- 如果后续继续拆 Research、Army、Prestige，建议沿用同样模式：在 base 中放一个清晰占位符，在 fragments 中维护独立片段。

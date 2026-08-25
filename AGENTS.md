# THERESMORE Project Constraints

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


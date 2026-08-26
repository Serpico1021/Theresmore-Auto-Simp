param(
  [string]$OutputPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'Theresmore-Automation_4.14.4_smart-build-planner.user.js')
)

$ErrorActionPreference = 'Stop'

$basePath = Join-Path $PSScriptRoot 'base\Theresmore-Automation_4.14.4.base.user.js'
$fragmentsPath = Join-Path $PSScriptRoot 'fragments'

$base = Get-Content -Raw -Encoding UTF8 -LiteralPath $basePath
$smartBuildOptions = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $fragmentsPath 'smart-build-options.js')

$plannerDir = Join-Path $fragmentsPath 'smart-build-planner'
$dataTables = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $plannerDir '00-data-tables.js')
$plannerInnerFiles = @(
  '10-game-state-adapter.js',
  '20-goal-routes.js',
  '30-dangerous-fight-gate.js',
  '40-build-scoring.js',
  '50-unit-scoring.js',
  '60-research-scoring.js',
  '70-explore-scoring.js',
  '90-export.js'
)
$plannerInner = ($plannerInnerFiles | ForEach-Object {
  Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $plannerDir $_)
}) -join "`n"
$smartBuildPlanner = $dataTables.TrimEnd() + "`n  const smartBuildPlanner = (() => {`n" + $plannerInner + "`n  })();`n"

$smartBuildPanel = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $fragmentsPath 'smart-build-panel.template.html')

$bundle = $base.
  Replace('      /* @@SMART_BUILD_OPTIONS@@ */', $smartBuildOptions.TrimEnd()).
  Replace('  /* @@SMART_BUILD_PLANNER_MODULE@@ */', $smartBuildPlanner.TrimEnd()).
  Replace('          <!-- @@SMART_BUILD_PANEL@@ -->', $smartBuildPanel.TrimEnd())

$missingMarkers = [regex]::Matches($bundle, '@@SMART_BUILD_[A-Z_]+@@')
if ($missingMarkers.Count -gt 0) {
  $markers = ($missingMarkers | ForEach-Object { $_.Value } | Sort-Object -Unique) -join ', '
  throw "Build failed; unresolved markers: $markers"
}

$outputDir = Split-Path -Parent $OutputPath
if ($outputDir) {
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

Set-Content -Encoding UTF8 -LiteralPath $OutputPath -Value $bundle

Write-Host "Built $OutputPath"

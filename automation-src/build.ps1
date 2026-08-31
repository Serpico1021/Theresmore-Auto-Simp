param(
  [string]$OutputPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'Theresmore-Automation_4.14.4_smart-build-planner.user.js')
)

$ErrorActionPreference = 'Stop'

$basePath = Join-Path $PSScriptRoot 'base\Theresmore-Automation_4.14.4.base.user.js'
$fragmentsPath = Join-Path $PSScriptRoot 'fragments'

$base = Get-Content -Raw -Encoding UTF8 -LiteralPath $basePath
$smartBuildOptions = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $fragmentsPath 'smart-build-options.js')
$smartPopulationPlanner = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $fragmentsPath 'smart-build-population-planner.js')

$plannerDir = Join-Path $fragmentsPath 'smart-build-planner'
$annihilatorDir = Join-Path $fragmentsPath 'annihilator-army-planner'
$annihilatorRouteData = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $annihilatorDir '00-annihilator-route.js')
$dataTables = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $plannerDir '00-data-tables.js')
$plannerInnerFiles = @(
  '10-game-state-adapter.js'
)
$annihilatorInnerFiles = @(
  '10-annihilator-state-adapter.js',
  '20-annihilator-planner.js'
)
$plannerInnerFilesTail = @(
  '20-goal-routes.js',
  '30-path-engine.js',
  '40-path-output.js',
  '90-export.js'
)
$plannerInner = (($plannerInnerFiles | ForEach-Object {
  Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $plannerDir $_)
}) + ($annihilatorInnerFiles | ForEach-Object {
  Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $annihilatorDir $_)
}) + ($plannerInnerFilesTail | ForEach-Object {
  Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $plannerDir $_)
})) -join "`n"
$smartBuildPlanner = $annihilatorRouteData.TrimEnd() + "`n" + $dataTables.TrimEnd() + "`n  const smartBuildPlanner = (() => {`n" + $plannerInner + "`n  })();`n"

$smartBuildPanel = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $fragmentsPath 'smart-build-panel.template.html')
$smartBuildGoalPathPanel = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $fragmentsPath 'smart-build-goal-path-panel.template.html')
$smartBuildGoalPathScript = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $fragmentsPath 'smart-build-goal-path-panel.js')
$smartBuildAnnihilatorRoutePanel = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $fragmentsPath 'smart-build-annihilator-route-panel.template.html')
$smartBuildAnnihilatorRouteScript = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $fragmentsPath 'smart-build-annihilator-route-panel.js')
$smartBuildGoalAutomationPreset = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $fragmentsPath 'smart-build-goal-automation-preset.js')

$bundle = $base.
  Replace('      /* @@SMART_BUILD_OPTIONS@@ */', $smartBuildOptions.TrimEnd()).
  Replace('  /* @@SMART_BUILD_PLANNER_MODULE@@ */', $smartBuildPlanner.TrimEnd()).
  Replace('  /* @@SMART_POPULATION_PLANNER@@ */', $smartPopulationPlanner.TrimEnd()).
  Replace('          <!-- @@SMART_BUILD_PANEL@@ -->', $smartBuildPanel.TrimEnd()).
  Replace('      <!-- @@SMART_BUILD_GOAL_PATH_TAB@@ -->', $smartBuildGoalPathPanel.TrimEnd()).
  Replace('  /* @@SMART_BUILD_GOAL_PATH_SCRIPT@@ */', $smartBuildGoalPathScript.TrimEnd()).
  Replace('      <!-- @@SMART_BUILD_ANNIHILATOR_ROUTE_TAB@@ -->', $smartBuildAnnihilatorRoutePanel.TrimEnd()).
  Replace('  /* @@SMART_BUILD_ANNIHILATOR_ROUTE_SCRIPT@@ */', $smartBuildAnnihilatorRouteScript.TrimEnd()).
  Replace('  /* @@SMART_BUILD_GOAL_AUTOMATION_PRESET@@ */', $smartBuildGoalAutomationPreset.TrimEnd()).
  Replace('    /* @@SMART_BUILD_GOAL_PATH_INIT@@ */', '    initGoalPathTab();').
  Replace('    /* @@SMART_BUILD_ANNIHILATOR_ROUTE_INIT@@ */', '    initAnnihilatorRouteTab();').
  Replace('    /* @@SMART_BUILD_GOAL_AUTOMATION_PRESET_INIT@@ */', '    initGoalAutomationPreset();')

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

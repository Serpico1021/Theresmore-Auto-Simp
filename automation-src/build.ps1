param(
  [string]$OutputPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'Theresmore-Automation_4.14.4_smart-build-planner.user.js')
)

$ErrorActionPreference = 'Stop'

$basePath = Join-Path $PSScriptRoot 'base\Theresmore-Automation_4.14.4.base.user.js'
$fragmentsPath = Join-Path $PSScriptRoot 'fragments'

$base = Get-Content -Raw -Encoding UTF8 -LiteralPath $basePath
$smartBuildOptions = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $fragmentsPath 'smart-build-options.js')
$smartBuildPlanner = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $fragmentsPath 'smart-build-planner.js')
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

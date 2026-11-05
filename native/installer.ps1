$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskPackage = Get-Content -Encoding UTF8 -Raw -LiteralPath (Join-Path $taskRoot 'package.json') | ConvertFrom-Json
# Resolve the verified electron-builder NSIS bundle, restoring build tools on demand.
$taskPreviousCache = $env:ELECTRON_BUILDER_CACHE
try {
    $env:ELECTRON_BUILDER_CACHE = Join-Path $taskRoot '.cache\builder'
    Push-Location $taskRoot
    try { $taskToolJson = & node -e "require('app-builder-lib/out/toolsets/windows').getMakeNsisPath('1.2.1').then(x=>console.log(JSON.stringify(x))).catch(e=>{console.error(e);process.exit(1)})" } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw 'NSIS compiler restore failed.' }
    $taskTool = ($taskToolJson | Where-Object { $_ -match '^\{' } | Select-Object -Last 1) | ConvertFrom-Json
} finally { $env:ELECTRON_BUILDER_CACHE = $taskPreviousCache }
Push-Location $PSScriptRoot
try {
    & $taskTool.path /V2 "/DVERSION=$($taskPackage.version)" 'installer.nsi'
    if ($LASTEXITCODE -ne 0) { throw 'Installer build failed.' }
} finally { Pop-Location }
Get-Item -LiteralPath (Join-Path $taskRoot "release\Jianwen-$($taskPackage.version)-Setup-x64.exe") | Select-Object FullName, Length

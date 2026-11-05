param([string]$InputPath)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskCache = Join-Path $taskRoot '.cache'
New-Item -ItemType Directory -Force -Path $taskCache | Out-Null
$taskOutput = Join-Path $taskCache 'LogDecodeTests.exe'
$taskCompiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$taskSources = @('tests\LogDecodeTests.cs', 'native\Core.cs', 'native\LargeText.cs') |
    ForEach-Object { Join-Path $taskRoot $_ }
& $taskCompiler /nologo /target:exe /platform:x64 /utf8output /codepage:65001 "/out:$taskOutput" /reference:System.dll /reference:System.Core.dll /reference:System.Security.dll /reference:System.Web.Extensions.dll @taskSources
if ($LASTEXITCODE -ne 0) { throw 'Regression test compilation failed.' }
if ($InputPath) { & $taskOutput $InputPath } else { & $taskOutput }
if ($LASTEXITCODE -ne 0) { throw 'Regression tests failed.' }

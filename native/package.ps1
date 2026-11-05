$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskPackage = Get-Content -Encoding UTF8 -Raw -LiteralPath (Join-Path $taskRoot 'package.json') | ConvertFrom-Json
$taskSdkVersion = '1.0.4314.35'
$taskDownload = Join-Path $taskRoot '.cache\webview2'
$taskSdk = Join-Path $taskDownload 'sdk'
if (-not (Test-Path -LiteralPath (Join-Path $taskSdk 'lib\net462\Microsoft.Web.WebView2.Core.dll'))) {
    New-Item -ItemType Directory -Force -Path $taskDownload | Out-Null
    $taskArchive = Join-Path $taskDownload 'webview2.zip'
    Invoke-WebRequest -Uri "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/$taskSdkVersion/microsoft.web.webview2.$taskSdkVersion.nupkg" -OutFile $taskArchive
    Expand-Archive -LiteralPath $taskArchive -DestinationPath $taskSdk -Force
}
$taskBuild = Join-Path $taskRoot '.cache\native'
New-Item -ItemType Directory -Force -Path $taskBuild | Out-Null
$taskZip = Join-Path $taskBuild 'bundle.zip'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskZipStream = [IO.File]::Open($taskZip, [IO.FileMode]::Create)
$taskZipWriter = [IO.Compression.ZipArchive]::new($taskZipStream, [IO.Compression.ZipArchiveMode]::Create)
try {
    $taskDist = Join-Path $taskRoot 'dist'
    foreach ($taskFile in (Get-ChildItem -LiteralPath $taskDist -Recurse -File | Sort-Object FullName)) {
        $taskRelative = 'ui/' + $taskFile.FullName.Substring($taskDist.Length + 1).Replace('\', '/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskZipWriter, $taskFile.FullName, $taskRelative, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
    foreach ($taskEntry in @(
        @((Join-Path $taskSdk 'lib\net462\Microsoft.Web.WebView2.Core.dll'), 'Microsoft.Web.WebView2.Core.dll'),
        @((Join-Path $taskSdk 'lib\net462\Microsoft.Web.WebView2.WinForms.dll'), 'Microsoft.Web.WebView2.WinForms.dll'),
        @((Join-Path $taskSdk 'runtimes\win-x64\native\WebView2Loader.dll'), 'WebView2Loader.dll'),
        @((Join-Path $PSScriptRoot 'bridge.js'), 'bridge.js'),
        @((Join-Path $taskRoot 'assets\icon.ico'), 'icon.ico'),
        @((Join-Path $taskRoot 'THIRD-PARTY-NOTICES.md'), 'THIRD-PARTY-NOTICES.md'),
        @((Join-Path $taskSdk 'LICENSE.txt'), 'WebView2-LICENSE.txt'),
        @((Join-Path $taskSdk 'NOTICE.txt'), 'WebView2-NOTICE.txt')
    )) {
        if (Test-Path -LiteralPath $taskEntry[0]) { [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskZipWriter, $taskEntry[0], $taskEntry[1], [IO.Compression.CompressionLevel]::Optimal) | Out-Null }
    }
} finally { $taskZipWriter.Dispose(); $taskZipStream.Dispose() }
$taskCsc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$taskOutput = Join-Path $taskRoot "release\Jianwen-$($taskPackage.version)-Windows-x64.exe"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $taskOutput) | Out-Null
$taskRefs = @('System.dll', 'System.Core.dll', 'System.Drawing.dll', 'System.Windows.Forms.dll', 'System.Net.Http.dll', 'System.Security.dll', 'System.Web.Extensions.dll', 'System.IO.Compression.dll', 'System.IO.Compression.FileSystem.dll', (Join-Path $taskSdk 'lib\net462\Microsoft.Web.WebView2.Core.dll'), (Join-Path $taskSdk 'lib\net462\Microsoft.Web.WebView2.WinForms.dll'))
$taskCompilerArgs = @('/nologo', '/target:winexe', '/platform:x64', '/optimize+', '/utf8output', '/codepage:65001', "/out:$taskOutput", "/win32icon:$(Join-Path $taskRoot 'assets\icon.ico')", "/win32manifest:$(Join-Path $PSScriptRoot 'app.manifest')", "/resource:$taskZip,Jianwen.Bundle")
$taskCompilerArgs += $taskRefs | ForEach-Object { "/reference:$_" }
$taskCompilerArgs += Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.cs' -File | ForEach-Object FullName
& $taskCsc @taskCompilerArgs
if ($LASTEXITCODE -ne 0) { throw 'Lightweight build failed.' }
$taskSize = (Get-Item -LiteralPath $taskOutput).Length
[ordered]@{ version = $taskPackage.version; executable = $taskOutput; bytes = $taskSize; MiB = [Math]::Round($taskSize / 1MB, 2); sharedRuntime = 'WebView2 + Windows .NET Framework 4.8'; sdk = $taskSdkVersion } | ConvertTo-Json

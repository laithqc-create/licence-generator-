# Download a package tarball straight from the registry and extract into node_modules/<name>
param([Parameter(Mandatory=$true)][string]$Name, [Parameter(Mandatory=$true)][string]$Version)

$ErrorActionPreference = 'Stop'
$projRoot = 'c:\Users\adam\Desktop\New folder\licence-generator-'
$tarballName = ($Name.Split('/')[-1]) + '-' + $Version + '.tgz'
$url = "https://registry.npmjs.org/$Name/-/$tarballName"
$tmp = Join-Path $env:TEMP ("pkg_" + ($Name -replace '[\\/]', '__'))

if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$tgz = Join-Path $tmp $tarballName
curl.exe -sL -o $tgz $url
if (-not (Test-Path $tgz) -or ((Get-Item $tgz).Length -lt 1000)) { Write-Output "DOWNLOAD_FAILED: $url"; exit 1 }

tar.exe -xzf $tgz -C $tmp
if (-not (Test-Path (Join-Path $tmp 'package'))) { Write-Output "BAD_TARBALL: $url"; exit 1 }
$destDir = Join-Path (Join-Path $projRoot 'node_modules') ($Name -replace '/', '\')
if (Test-Path $destDir) { Remove-Item -Recurse -Force $destDir }
Move-Item (Join-Path $tmp 'package') $destDir
Remove-Item -Recurse -Force $tmp
Write-Output ("EXTRACTED: $Name@$Version")

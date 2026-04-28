param(
  [switch]$SkipBuild,
  [switch]$UsePm2
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not $SkipBuild) {
  npm run build
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

if ($UsePm2) {
  npm run pm2:start
  exit $LASTEXITCODE
}

npm run start
exit $LASTEXITCODE

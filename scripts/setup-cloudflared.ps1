param(
  [switch]$RunQuickTunnel
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Read-DotEnvFile {
  param([string]$Path)

  $Values = @{}
  if (-not (Test-Path $Path)) {
    return $Values
  }

  foreach ($Line in Get-Content $Path) {
    $Trimmed = $Line.Trim()
    if ($Trimmed.Length -eq 0 -or $Trimmed.StartsWith("#") -or -not $Trimmed.Contains("=")) {
      continue
    }

    $Parts = $Trimmed.Split("=", 2)
    $Values[$Parts[0].Trim()] = $Parts[1].Trim().Trim('"').Trim("'")
  }

  return $Values
}

$Config = Read-DotEnvFile ".env.example"
foreach ($Entry in (Read-DotEnvFile ".env").GetEnumerator()) {
  $Config[$Entry.Key] = $Entry.Value
}

$CloudflaredBin = if ($env:CLOUDFLARED_BIN) { $env:CLOUDFLARED_BIN } elseif ($Config["CLOUDFLARED_BIN"]) { $Config["CLOUDFLARED_BIN"] } else { "cloudflared" }
$Target = if ($env:CLOUDFLARE_TUNNEL_TARGET) { $env:CLOUDFLARE_TUNNEL_TARGET } elseif ($Config["CLOUDFLARE_TUNNEL_TARGET"]) { $Config["CLOUDFLARE_TUNNEL_TARGET"] } else { "http://localhost:3333" }
$Hostname = if ($env:CLOUDFLARE_TUNNEL_HOSTNAME) { $env:CLOUDFLARE_TUNNEL_HOSTNAME } elseif ($Config["CLOUDFLARE_TUNNEL_HOSTNAME"]) { $Config["CLOUDFLARE_TUNNEL_HOSTNAME"] } else { "" }

Write-Host "Cloudflare Tunnel target: $Target"
if ($Hostname) {
  Write-Host "Configured hostname: $Hostname"
}

if (-not (Get-Command $CloudflaredBin -ErrorAction SilentlyContinue)) {
  Write-Host "cloudflared was not found as '$CloudflaredBin'."
  Write-Host "Install on Windows with:"
  Write-Host "  winget install --id Cloudflare.cloudflared"
  Write-Host "Then run this script again."
  if ($RunQuickTunnel) {
    exit 1
  }
  exit 0
}

if ($RunQuickTunnel) {
  Write-Host "Starting a temporary TryCloudflare tunnel..."
  & $CloudflaredBin tunnel --url $Target
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Quick tunnel for testing:"
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts/setup-cloudflared.ps1 -RunQuickTunnel"
Write-Host ""
Write-Host "Named tunnel for a fixed public hostname:"
Write-Host "  $CloudflaredBin tunnel login"
Write-Host "  $CloudflaredBin tunnel create pokemon-rayquaza-monitor"
if ($Hostname) {
  Write-Host "  $CloudflaredBin tunnel route dns pokemon-rayquaza-monitor $Hostname"
} else {
  Write-Host "  $CloudflaredBin tunnel route dns pokemon-rayquaza-monitor <seu-dominio>"
}
Write-Host "  $CloudflaredBin tunnel run pokemon-rayquaza-monitor"

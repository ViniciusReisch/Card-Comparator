param(
  [switch]$RunQuickTunnel,
  [switch]$ConfigureNamedTunnel,
  [switch]$RunNamedTunnel,
  [string]$Hostname,
  [string]$TunnelName
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
$TunnelName = if ($TunnelName) { $TunnelName } elseif ($env:CLOUDFLARE_TUNNEL_NAME) { $env:CLOUDFLARE_TUNNEL_NAME } elseif ($Config["CLOUDFLARE_TUNNEL_NAME"]) { $Config["CLOUDFLARE_TUNNEL_NAME"] } else { "pokemon-rayquaza-monitor" }
$Target = if ($env:CLOUDFLARE_TUNNEL_TARGET) { $env:CLOUDFLARE_TUNNEL_TARGET } elseif ($Config["CLOUDFLARE_TUNNEL_TARGET"]) { $Config["CLOUDFLARE_TUNNEL_TARGET"] } else { "http://localhost:3333" }
$Hostname = if ($Hostname) { $Hostname } elseif ($env:CLOUDFLARE_TUNNEL_HOSTNAME) { $env:CLOUDFLARE_TUNNEL_HOSTNAME } elseif ($Config["CLOUDFLARE_TUNNEL_HOSTNAME"]) { $Config["CLOUDFLARE_TUNNEL_HOSTNAME"] } else { "" }
$CloudflaredHome = Join-Path $env:USERPROFILE ".cloudflared"
$CloudflaredConfigPath = Join-Path $CloudflaredHome "config.yml"
$OriginCertPath = Join-Path $CloudflaredHome "cert.pem"

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

if ($ConfigureNamedTunnel) {
  if (-not $Hostname) {
    throw "Hostname is required. Example: -Hostname rayquaza.seudominio.com"
  }

  New-Item -ItemType Directory -Path $CloudflaredHome -Force | Out-Null

  if (-not (Test-Path $OriginCertPath)) {
    Write-Host "Cloudflare login is required. A browser window will open; choose the domain that owns '$Hostname'."
    & $CloudflaredBin tunnel login
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
  }

  $existingTunnelOutput = & $CloudflaredBin tunnel list 2>$null
  $hasTunnel = $LASTEXITCODE -eq 0 -and ($existingTunnelOutput -join "`n") -match [regex]::Escape($TunnelName)

  if (-not $hasTunnel) {
    Write-Host "Creating named tunnel '$TunnelName'..."
    & $CloudflaredBin tunnel create $TunnelName
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
  } else {
    Write-Host "Named tunnel '$TunnelName' already exists."
  }

  $tunnelInfo = & $CloudflaredBin tunnel info $TunnelName 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Could not read tunnel info for '$TunnelName'."
    exit $LASTEXITCODE
  }

  $TunnelId = (($tunnelInfo | Select-String -Pattern "ID:\\s+([0-9a-f-]+)" | Select-Object -First 1).Matches.Groups[1].Value)
  if (-not $TunnelId) {
    $TunnelId = (($existingTunnelOutput | Select-String -Pattern "([0-9a-f-]{36}).*$([regex]::Escape($TunnelName))" | Select-Object -First 1).Matches.Groups[1].Value)
  }

  if (-not $TunnelId) {
    throw "Could not determine tunnel ID for '$TunnelName'."
  }

  $CredentialsPath = Join-Path $CloudflaredHome "$TunnelId.json"
  if (-not (Test-Path $CredentialsPath)) {
    throw "Credentials file not found: $CredentialsPath"
  }

  @"
tunnel: $TunnelId
credentials-file: $CredentialsPath

ingress:
  - hostname: $Hostname
    service: $Target
  - service: http_status:404
"@ | Set-Content -Path $CloudflaredConfigPath -Encoding utf8

  Write-Host "Routing DNS '$Hostname' to tunnel '$TunnelName'..."
  & $CloudflaredBin tunnel route dns $TunnelName $Hostname
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  Write-Host ""
  Write-Host "Named tunnel configured."
  Write-Host "Config: $CloudflaredConfigPath"
  Write-Host "Public URL: https://$Hostname"
  Write-Host ""
  Write-Host "Update .env with:"
  Write-Host "  APP_PUBLIC_URL=https://$Hostname"
  Write-Host "  CLOUDFLARE_TUNNEL_NAME=$TunnelName"
  Write-Host "  CLOUDFLARE_TUNNEL_HOSTNAME=$Hostname"
  exit 0
}

if ($RunNamedTunnel) {
  if (-not (Test-Path $CloudflaredConfigPath)) {
    throw "Named tunnel config not found: $CloudflaredConfigPath"
  }

  Write-Host "Starting named tunnel '$TunnelName'..."
  & $CloudflaredBin tunnel --config $CloudflaredConfigPath run $TunnelName
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Quick tunnel for testing:"
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts/setup-cloudflared.ps1 -RunQuickTunnel"
Write-Host ""
Write-Host "Named tunnel for a fixed public hostname:"
Write-Host "  $CloudflaredBin tunnel login"
Write-Host "  $CloudflaredBin tunnel create $TunnelName"
if ($Hostname) {
  Write-Host "  $CloudflaredBin tunnel route dns $TunnelName $Hostname"
  Write-Host ""
  Write-Host "Automated setup:"
  Write-Host "  powershell -ExecutionPolicy Bypass -File scripts/setup-cloudflared.ps1 -ConfigureNamedTunnel -Hostname $Hostname"
} else {
  Write-Host "  $CloudflaredBin tunnel route dns $TunnelName <seu-dominio>"
  Write-Host ""
  Write-Host "Automated setup:"
  Write-Host "  powershell -ExecutionPolicy Bypass -File scripts/setup-cloudflared.ps1 -ConfigureNamedTunnel -Hostname rayquaza.seudominio.com"
}
Write-Host "  $CloudflaredBin tunnel --config $CloudflaredConfigPath run $TunnelName"

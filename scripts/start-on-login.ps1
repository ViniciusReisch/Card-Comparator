param(
  [switch]$Rebuild
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Root "storage"
$LogFile = Join-Path $LogDir "startup-task.log"
$CloudflaredOutLog = Join-Path $LogDir "cloudflared.out.log"
$CloudflaredErrLog = Join-Path $LogDir "cloudflared.err.log"
$ServerEntrypoint = Join-Path $Root "dist-api\api\server.js"
$ClientIndex = Join-Path $Root "dist\index.html"

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

function Write-StartupLog {
  param([string]$Message)
  $Line = "[$(Get-Date -Format o)] $Message"
  for ($Attempt = 1; $Attempt -le 5; $Attempt += 1) {
    try {
      Add-Content -Path $LogFile -Value $Line -Encoding utf8
      return
    } catch {
      Start-Sleep -Milliseconds 200
    }
  }

  Write-Host $Line
}

function Get-AppPort {
  $port = 3333
  $envPath = Join-Path $Root ".env"

  if (Test-Path $envPath) {
    $match = Get-Content $envPath |
      Where-Object { $_ -match "^\s*PORT\s*=\s*(\d+)\s*$" } |
      Select-Object -First 1

    if ($match -match "(\d+)") {
      $port = [int]$Matches[1]
    }
  }

  return $port
}

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

function Test-Truthy {
  param([string]$Value)
  if (-not $Value) {
    return $false
  }

  return @("true", "1", "yes", "on") -contains $Value.Trim().ToLowerInvariant()
}

function Start-CloudflareTunnel {
  $Config = Read-DotEnvFile (Join-Path $Root ".env.example")
  foreach ($Entry in (Read-DotEnvFile (Join-Path $Root ".env")).GetEnumerator()) {
    $Config[$Entry.Key] = $Entry.Value
  }

  $remoteEnabledRaw = if ($Config.ContainsKey("ENABLE_REMOTE_ACCESS")) { $Config["ENABLE_REMOTE_ACCESS"] } else { "false" }
  $remoteEnabled = Test-Truthy $remoteEnabledRaw
  $remoteMode = if ($Config.ContainsKey("REMOTE_ACCESS_MODE")) { $Config["REMOTE_ACCESS_MODE"] } else { "cloudflare_tunnel" }
  if (-not $remoteEnabled -or $remoteMode -ne "cloudflare_tunnel") {
    Write-StartupLog "Cloudflare tunnel skipped: remote access disabled or mode is '$remoteMode'."
    return
  }

  $cloudflaredBin = if ($Config["CLOUDFLARED_BIN"]) { $Config["CLOUDFLARED_BIN"] } else { "cloudflared" }
  $tunnelName = if ($Config["CLOUDFLARE_TUNNEL_NAME"]) { $Config["CLOUDFLARE_TUNNEL_NAME"] } else { "pokemon-rayquaza-monitor" }
  $target = if ($Config["CLOUDFLARE_TUNNEL_TARGET"]) { $Config["CLOUDFLARE_TUNNEL_TARGET"] } else { "http://localhost:3333" }
  $hostname = if ($Config["CLOUDFLARE_TUNNEL_HOSTNAME"]) { $Config["CLOUDFLARE_TUNNEL_HOSTNAME"] } else { "" }
  $cloudflaredHome = Join-Path $env:USERPROFILE ".cloudflared"
  $namedConfigPath = Join-Path $cloudflaredHome "config.yml"

  if (-not (Get-Command $cloudflaredBin -ErrorAction SilentlyContinue)) {
    Write-StartupLog "Cloudflare tunnel skipped: cloudflared not found as '$cloudflaredBin'."
    return
  }

  $existingTunnel = Get-CimInstance Win32_Process -Filter "name = 'cloudflared.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
      if ($hostname) {
        $_.CommandLine -like "*tunnel*" -and (
          $_.CommandLine -like "* $tunnelName*" -or
          $_.CommandLine -like "*$namedConfigPath*"
        )
      } else {
        $_.CommandLine -like "*tunnel*" -and $_.CommandLine -like "*$target*"
      }
    } |
    Select-Object -First 1

  if ($existingTunnel) {
    Write-StartupLog "Cloudflare tunnel already running with PID $($existingTunnel.ProcessId)."
    return
  }

  $arguments = @("tunnel", "--url", $target)
  if ($hostname) {
    if (Test-Path $namedConfigPath) {
      $arguments = @("tunnel", "--config", $namedConfigPath, "run", $tunnelName)
      Write-StartupLog "Starting named Cloudflare tunnel '$tunnelName' for https://$hostname."
    } else {
      Write-StartupLog "Named tunnel config not found at '$namedConfigPath'. Falling back to TryCloudflare tunnel."
    }
  } else {
    Write-StartupLog "Starting TryCloudflare tunnel to $target."
  }

  Start-Process `
    -FilePath $cloudflaredBin `
    -ArgumentList $arguments `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $CloudflaredOutLog `
    -RedirectStandardError $CloudflaredErrLog | Out-Null
}

try {
  Set-Location $Root
  $port = Get-AppPort
  $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1

  if ($listener) {
    Write-StartupLog "Port $port already has a listener owned by PID $($listener.OwningProcess). App startup skipped."
    Start-CloudflareTunnel
    exit 0
  }

  if ($Rebuild -or -not (Test-Path $ServerEntrypoint) -or -not (Test-Path $ClientIndex)) {
    Write-StartupLog "Production build missing or rebuild requested. Running npm run build."
    & npm run build *>> $LogFile
    if ($LASTEXITCODE -ne 0) {
      Write-StartupLog "Build failed with exit code $LASTEXITCODE."
      exit $LASTEXITCODE
    }
  }

  $env:NODE_ENV = "production"
  Start-CloudflareTunnel

  while ($true) {
    Write-StartupLog "Starting Card Comparator on http://localhost:$port."
    & node $ServerEntrypoint *>> $LogFile
    $exitCode = $LASTEXITCODE
    Write-StartupLog "Application process exited with code $exitCode. Restarting in 8 seconds."
    Start-Sleep -Seconds 8
  }
} catch {
  Write-StartupLog "Startup failed: $($_.Exception.Message)"
  exit 1
}

param(
  [string]$TaskName = "Card Comparator Rayquaza Monitor",
  [switch]$Remove,
  [switch]$NoStartNow,
  [switch]$Rebuild
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$StartupScript = Join-Path $PSScriptRoot "start-on-login.ps1"
$CurrentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$ShortcutPath = Join-Path ([Environment]::GetFolderPath("Startup")) "$TaskName.lnk"

function New-StartupShortcut {
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($ShortcutPath)
  $shortcut.TargetPath = "powershell.exe"
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$StartupScript`""
  $shortcut.WorkingDirectory = $Root
  $shortcut.Description = "Starts Card Comparator Rayquaza Monitor when Windows logs in."
  $shortcut.Save()
}

function Start-ApplicationNow {
  Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$StartupScript`"" `
    -WorkingDirectory $Root `
    -WindowStyle Hidden | Out-Null
}

if ($Remove) {
  $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed scheduled task '$TaskName'."
  } else {
    Write-Host "Scheduled task '$TaskName' was not found."
  }
  if (Test-Path $ShortcutPath) {
    Remove-Item -LiteralPath $ShortcutPath -Force
    Write-Host "Removed startup shortcut '$ShortcutPath'."
  }

  exit 0
}

if (-not (Test-Path $StartupScript)) {
  throw "Startup script not found: $StartupScript"
}

if ($Rebuild) {
  Push-Location $Root
  try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
  } finally {
    Pop-Location
  }
}

$actionArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$StartupScript`""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $actionArgs -WorkingDirectory $Root
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -Hidden `
  -MultipleInstances IgnoreNew `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Seconds 0)
$principal = New-ScheduledTaskPrincipal -UserId $CurrentUser -LogonType Interactive -RunLevel Limited

$registeredTask = $false

try {
  Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Starts Card Comparator Rayquaza Monitor when the Windows user logs in." `
    -Force | Out-Null

  $registeredTask = $true
  Write-Host "Registered scheduled task '$TaskName' for user '$CurrentUser'."
} catch {
  Write-Host "Scheduled task registration failed: $($_.Exception.Message)"
  New-StartupShortcut
  Write-Host "Created startup shortcut '$ShortcutPath' instead."
}

if (-not $NoStartNow) {
  if ($registeredTask) {
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "Started scheduled task '$TaskName'."
  } else {
    Start-ApplicationNow
    Write-Host "Started application directly."
  }
}

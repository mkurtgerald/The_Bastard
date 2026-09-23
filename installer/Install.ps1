$ErrorActionPreference = "Stop"

$SourceRoot = Split-Path -Parent $PSScriptRoot
$InstallRoot = Join-Path $env:LOCALAPPDATA "TheBastard"
$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $Desktop "The Bastard Console.lnk"

Write-Host ""
Write-Host "The Bastard - Baseline Test Installer"
Write-Host "====================================="
Write-Host ""

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Warning "Docker was not found on PATH."
    Write-Host "Install Docker Desktop, start it, then run INSTALL.cmd again."
    exit 2
}

try {
    docker version | Out-Null
} catch {
    Write-Warning "Docker is installed but the Docker engine is not responding."
    Write-Host "Start Docker Desktop, then run INSTALL.cmd again."
    exit 3
}

if (Test-Path $InstallRoot) {
    $Backup = "$InstallRoot.backup.$(Get-Date -Format yyyyMMddHHmmss)"
    Write-Host "Existing install found. Moving it to $Backup"
    Move-Item -Path $InstallRoot -Destination $Backup -Force
}

Write-Host "Installing to $InstallRoot ..."
New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null

$exclude = @(".git", ".github")
Get-ChildItem -LiteralPath $SourceRoot -Force | Where-Object { $exclude -notcontains $_.Name } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $InstallRoot -Recurse -Force
}

$Launcher = Join-Path $InstallRoot "installer\Console.cmd"
if (-not (Test-Path $Launcher)) {
    throw "Launcher was not found after install: $Launcher"
}

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $Launcher
$Shortcut.WorkingDirectory = $InstallRoot
$Shortcut.Description = "The Bastard baseline test console"
$Shortcut.Save()

Write-Host ""
Write-Host "Installed successfully."
Write-Host "Desktop shortcut created: The Bastard Console"
Write-Host ""
Write-Host "No camera is configured automatically and no camera credentials are stored by this installer."

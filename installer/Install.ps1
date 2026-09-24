$ErrorActionPreference = "Stop"

$SourceRoot = Split-Path -Parent $PSScriptRoot
$InstallRoot = Join-Path $env:LOCALAPPDATA "TheBastard"
$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $Desktop "The Bastard Console.lnk"

function Resolve-Docker {
    $cmd = Get-Command docker -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidates = @(
        "C:\Program Files\Docker\Docker\resources\bin\docker.exe",
        "C:\Program Files\Docker\Docker\resources\bin\com.docker.cli.exe",
        (Join-Path $env:LOCALAPPDATA "Docker\resources\bin\docker.exe")
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            $dir = Split-Path -Parent $candidate
            if ($env:Path -notlike "*$dir*") {
                $env:Path = "$dir;$env:Path"
            }
            return $candidate
        }
    }
    return $null
}

Write-Host ""
Write-Host "The Bastard - Baseline Test Installer"
Write-Host "====================================="
Write-Host ""

$DockerExe = Resolve-Docker
if (-not $DockerExe) {
    Write-Warning "Docker CLI was not found."
    Write-Host "Checked PATH and the normal Docker Desktop install locations."
    Write-Host "If Docker Desktop is already installed, restart Windows once and rerun INSTALL.cmd."
    Write-Host "If it is not installed, install Docker Desktop from Docker's official distribution first."
    exit 2
}

Write-Host "Docker CLI found: $DockerExe"

try {
    & $DockerExe version | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Docker engine unavailable" }
} catch {
    $DesktopExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $DesktopExe) {
        Write-Host "Docker Desktop is installed but the engine is not responding."
        Write-Host "Starting Docker Desktop..."
        Start-Process $DesktopExe
    } else {
        Write-Warning "Docker CLI exists but the Docker engine is not responding."
    }
    Write-Host "Once Docker Desktop shows Engine running, rerun INSTALL.cmd."
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

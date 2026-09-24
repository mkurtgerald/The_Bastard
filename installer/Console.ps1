$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
$Compose = Join-Path $Root "installer\compose.source-only.yml"
$script:DockerExe = $null

function Resolve-Docker {
    $cmd = Get-Command docker -ErrorAction SilentlyContinue
    if ($cmd) {
        $script:DockerExe = $cmd.Source
        return $true
    }

    $candidates = @(
        "C:\Program Files\Docker\Docker\resources\bin\docker.exe",
        (Join-Path $env:LOCALAPPDATA "Docker\resources\bin\docker.exe")
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            $script:DockerExe = $candidate
            $dir = Split-Path -Parent $candidate
            if ($env:Path -notlike "*$dir*") {
                $env:Path = "$dir;$env:Path"
            }
            return $true
        }
    }
    return $false
}

function Test-Docker {
    if (-not (Resolve-Docker)) {
        Write-Host ""
        Write-Host "Docker CLI was not found in PATH or the normal Docker Desktop locations."
        return $false
    }

    & $script:DockerExe version *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Docker Desktop is installed but its engine is not running."
        $DesktopExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        if (Test-Path $DesktopExe) {
            Write-Host "Starting Docker Desktop..."
            Start-Process $DesktopExe
        }
        return $false
    }
    return $true
}

function Docker-Compose {
    param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Args)
    & $script:DockerExe compose @Args
}

function Build-Detector {
    if (-not (Test-Docker)) { return }
    Push-Location $Root
    try {
        Write-Host ""
        Write-Host "Building detector locally from repository source."
        Write-Host "No SharpAI/Aegis installer or shareai detector image is used."
        Docker-Compose -f $Compose build --pull detector
        if ($LASTEXITCODE -ne 0) { throw "Local source build failed." }
        Write-Host ""
        Write-Host "Local source build completed."
    } catch {
        Write-Host "Build failed: $($_.Exception.Message)"
    } finally {
        Pop-Location
    }
}

function Start-Detector {
    if (-not (Test-Docker)) { return }
    Push-Location $Root
    try {
        Docker-Compose -f $Compose up -d detector
        if ($LASTEXITCODE -ne 0) { throw "Detector failed to start." }
        Write-Host ""
        Write-Host "Detector started."
        Write-Host "API: http://localhost:3000"
        Write-Host "noVNC: http://localhost:8000"
    } catch {
        Write-Host "Start failed: $($_.Exception.Message)"
    } finally {
        Pop-Location
    }
}

function Stop-Detector {
    if (-not (Test-Docker)) { return }
    Push-Location $Root
    Docker-Compose -f $Compose down
    Pop-Location
}

do {
    Clear-Host
    Write-Host "THE BASTARD - SOURCE-ONLY TEST CONSOLE"
    Write-Host "======================================"
    Write-Host ""
    Write-Host "This test lane does NOT use the SharpAI/Aegis website installer."
    Write-Host "The detector image is built locally from the source in this repository."
    Write-Host ""
    Write-Host "1. System check"
    Write-Host "2. Build detector locally from source"
    Write-Host "3. Start detector"
    Write-Host "4. Stop detector"
    Write-Host "5. Open detector UI"
    Write-Host "6. Show container status"
    Write-Host "0. Exit"
    Write-Host ""
    $choice = Read-Host "Select"

    switch ($choice) {
        "1" {
            Write-Host ""
            if (Test-Docker) {
                & $script:DockerExe --version
                & $script:DockerExe compose version
                Write-Host "Docker: OK"
                Write-Host "Docker executable: $script:DockerExe"
            }
            Write-Host "Repository install root: $Root"
            Read-Host "Press Enter"
        }
        "2" {
            Build-Detector
            Read-Host "Press Enter"
        }
        "3" {
            Start-Detector
            Read-Host "Press Enter"
        }
        "4" {
            Stop-Detector
            Read-Host "Press Enter"
        }
        "5" { Start-Process "http://localhost:8000" }
        "6" {
            if (Test-Docker) {
                & $script:DockerExe ps --filter "name=the-bastard"
            }
            Read-Host "Press Enter"
        }
    }
} while ($choice -ne "0")

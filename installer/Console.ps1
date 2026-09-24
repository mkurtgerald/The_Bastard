$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
$Compose = Join-Path $Root "installer\compose.source-only.yml"

function Test-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Host ""
        Write-Host "Docker is not installed or not on PATH."
        Write-Host "Install Docker Desktop from Docker's official distribution, start it, then retry."
        return $false
    }
    docker version *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Docker Desktop is installed but its engine is not running."
        return $false
    }
    return $true
}

function Build-Detector {
    if (-not (Test-Docker)) { return }
    Push-Location $Root
    try {
        Write-Host ""
        Write-Host "Building detector locally from repository source."
        Write-Host "No SharpAI/Aegis installer or shareai detector image is used."
        docker compose -f $Compose build --pull detector
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
        docker compose -f $Compose up -d detector
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
    docker compose -f $Compose down
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
                docker --version
                docker compose version
                Write-Host "Docker: OK"
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
            docker ps --filter "name=the-bastard"
            Read-Host "Press Enter"
        }
    }
} while ($choice -ne "0")

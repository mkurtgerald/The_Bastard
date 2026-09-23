$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot

function Ensure-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Host "Docker is not installed or not on PATH."
        return $false
    }
    docker version *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Docker Desktop is installed but the engine is not running."
        return $false
    }
    return $true
}

function Ensure-Env([string]$Dir) {
    $EnvFile = Join-Path $Dir ".env"
    if (-not (Test-Path $EnvFile)) {
        $Offset = [int]([TimeZoneInfo]::Local.GetUtcOffset((Get-Date)).TotalHours)
        @(
            "TIMEZONE_OFFSET=$Offset"
            "DOCKER_VOLUME_DIRECTORY=."
        ) | Set-Content -Path $EnvFile -Encoding ASCII
    }
}

function Start-Stack([string]$Dir, [string]$Compose) {
    if (-not (Ensure-Docker)) { return }
    Ensure-Env $Dir
    Push-Location $Dir
    try {
        docker compose -f $Compose pull
        if ($LASTEXITCODE -ne 0) { throw "Docker image pull failed." }
        docker compose -f $Compose up -d
        if ($LASTEXITCODE -ne 0) { throw "Docker compose start failed." }
        Write-Host ""
        Write-Host "Stack started."
        Write-Host "Home Assistant: http://localhost:8123"
        Write-Host "Detector UI:    http://localhost:8000"
    } catch {
        Write-Host "Start failed: $($_.Exception.Message)"
    } finally {
        Pop-Location
    }
}

function Stop-Stacks {
    $targets = @(
        @{Dir=(Join-Path $Root "src\yolov7_person_detector"); Compose="docker-compose-x86.yml"},
        @{Dir=(Join-Path $Root "src\yolov7_reid"); Compose="docker-compose-x86.yml"}
    )
    foreach ($t in $targets) {
        if (Test-Path (Join-Path $t.Dir $t.Compose)) {
            Push-Location $t.Dir
            docker compose -f $t.Compose down 2>$null
            Pop-Location
        }
    }
}

do {
    Clear-Host
    Write-Host "THE BASTARD - BASELINE TEST CONSOLE"
    Write-Host "===================================="
    Write-Host ""
    Write-Host "1. System check"
    Write-Host "2. Start person detector"
    Write-Host "3. Start person ReID stack"
    Write-Host "4. Stop test stacks"
    Write-Host "5. Open detector UI"
    Write-Host "6. Open Home Assistant"
    Write-Host "7. Show running containers"
    Write-Host "0. Exit"
    Write-Host ""
    $choice = Read-Host "Select"

    switch ($choice) {
        "1" {
            Write-Host ""
            if (Ensure-Docker) {
                Write-Host "Docker: OK"
                docker --version
                docker compose version
            }
            Write-Host "Install root: $Root"
            Write-Host ""
            Read-Host "Press Enter"
        }
        "2" {
            Start-Stack (Join-Path $Root "src\yolov7_person_detector") "docker-compose-x86.yml"
            Read-Host "Press Enter"
        }
        "3" {
            Start-Stack (Join-Path $Root "src\yolov7_reid") "docker-compose-x86.yml"
            Read-Host "Press Enter"
        }
        "4" {
            Stop-Stacks
            Write-Host "Stacks stopped."
            Read-Host "Press Enter"
        }
        "5" { Start-Process "http://localhost:8000" }
        "6" { Start-Process "http://localhost:8123" }
        "7" {
            docker ps
            Read-Host "Press Enter"
        }
    }
} while ($choice -ne "0")

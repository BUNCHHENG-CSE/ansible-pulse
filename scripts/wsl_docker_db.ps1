# ==============================================================================
# TCT AnsiblePulse - WSL Docker PostgreSQL Controller (PowerShell)
# Allows Windows users to manage the production PostgreSQL container via WSL.
# ==============================================================================

param (
    [string]$Action = "start"
)

$ValidActions = @("start", "up", "stop", "down", "status", "logs", "psql")
if ($ValidActions -notcontains $Action.ToLower()) {
    Write-Host "Usage: .\scripts\wsl_docker_db.ps1 [start|stop|status|logs|psql]" -ForegroundColor Yellow
    exit 1
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Convert Windows path to WSL path
$WslPath = $ProjectRoot -replace '\\', '/' -replace '([a-zA-Z]):', '/mnt/$1'
$WslPath = $WslPath.ToLower()

Write-Host "[*] Executing WSL Docker PostgreSQL command: $Action..." -ForegroundColor Cyan

# Run script inside WSL
wsl bash -c "cd '$WslPath' && bash scripts/wsl_docker_db.sh $Action"

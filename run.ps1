# ==============================================================================
# TCT AnsiblePulse - One-Click Launcher (PowerShell)
# ==============================================================================
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "    TCT AnsiblePulse - IaC Observability & Governance       " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Virtual Environment Setup
if (-not (Test-Path ".venv")) {
    Write-Host "[*] Setting up Python virtual environment..." -ForegroundColor Yellow
    python -m venv .venv
    .\.venv\Scripts\pip install fastapi uvicorn pydantic pyyaml pytest httpx sqlalchemy "psycopg[binary]" psycopg2-binary
}

# 2. Database Check (Dual-Engine: PostgreSQL WSL Docker or Zero-Config SQLite)
Write-Host "[*] Checking database engine (Dual-Engine Auto Fallback)..." -ForegroundColor Cyan
try {
    powershell -ExecutionPolicy Bypass -File .\scripts\wsl_docker_db.ps1 start 2>$null
} catch {
    Write-Host "[*] PostgreSQL offline. Operating in Zero-Configuration SQLite mode." -ForegroundColor Yellow
}

# 3. Demo Repositories Testbed
if (-not (Test-Path "demo_repos\platform-core-infra")) {
    Write-Host "[*] Initializing enterprise multi-repo demo testbed..." -ForegroundColor Yellow
    .\.venv\Scripts\python backend/scripts/setup_demo_repos.py
}

# 4. Open Browser & Launch Web Server
Write-Host "[✓] Launching TCT AnsiblePulse Web Dashboard at http://127.0.0.1:8000" -ForegroundColor Green
Start-Process "http://127.0.0.1:8000"
.\.venv\Scripts\python cli.py serve --port 8000

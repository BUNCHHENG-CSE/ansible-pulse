@echo off
echo ========================================================
echo     TCT AnsiblePulse - IaC Observability & Governance
echo ========================================================
echo.

IF NOT EXIST ".venv" (
    echo [*] Creating virtual environment...
    python -m venv .venv
    call .\.venv\Scripts\activate.bat
    pip install fastapi uvicorn pydantic pyyaml pytest httpx sqlalchemy "psycopg[binary]" psycopg2-binary
) ELSE (
    call .\.venv\Scripts\activate.bat
)

IF NOT EXIST "demo_repos\platform-core-infra" (
    echo [*] Generating enterprise demo testbed repositories...
    python backend/scripts/setup_demo_repos.py
)

echo [*] Opening Web Dashboard at http://127.0.0.1:8000 ...
start http://127.0.0.1:8000
python cli.py serve --port 8000

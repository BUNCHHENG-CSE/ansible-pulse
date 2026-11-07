@echo off
echo ========================================================
echo   TCT AnsiblePulse - Next.js Full-Stack All-in-One (Bun)
echo ========================================================
echo.

where bun >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Bun is not installed. Please install Bun from https://bun.sh
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [*] Installing dependencies with Bun...
    bun install
)

echo [*] Generating Prisma client...
bun run prisma:generate

echo [*] Opening Web Dashboard at http://localhost:3000 ...
start http://localhost:3000
bun run dev

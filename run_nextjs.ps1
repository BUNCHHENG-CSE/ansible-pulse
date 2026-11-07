# ==============================================================================
# TCT AnsiblePulse - One-Click Next.js Full-Stack Launcher (PowerShell)
# ==============================================================================
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  TCT AnsiblePulse - Next.js Full-Stack All-in-One (Bun)    " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Bun
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Bun is not found in PATH. Please install Bun from https://bun.sh" -ForegroundColor Red
    exit 1
}

# 2. Install dependencies if node_modules is missing
if (-not (Test-Path "node_modules")) {
    Write-Host "[*] Installing dependencies with Bun..." -ForegroundColor Yellow
    bun install
}

# 3. Generate Prisma client
Write-Host "[*] Generating Prisma client..." -ForegroundColor Cyan
bun run prisma:generate

# 4. Launch Next.js dev server
Write-Host "[✓] Launching TCT AnsiblePulse at http://localhost:3000" -ForegroundColor Green
Start-Process "http://localhost:3000"
bun run dev

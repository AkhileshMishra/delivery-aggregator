# Windows VM Bootstrap Script
# Run this INSIDE the Azure VM after RDP-ing in.
# Assumes repo is cloned to C:\delivery-aggregator

$ErrorActionPreference = "Stop"
$repoDir = "C:\delivery-aggregator"

# 1. Install Node.js LTS
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Node.js LTS..."
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}
Write-Host "Node.js version: $(node --version)"

# 2. Install NSSM (Non-Sucking Service Manager)
if (-not (Get-Command nssm -ErrorAction SilentlyContinue)) {
    Write-Host "Installing NSSM..."
    winget install NSSM.NSSM --accept-package-agreements --accept-source-agreements
}

# 3. Install Git (if not present)
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Git..."
    winget install Git.Git --accept-package-agreements --accept-source-agreements
}

# 4. Install dependencies and build
Set-Location $repoDir
Write-Host "Installing npm dependencies..."
npm ci
Write-Host "Building TypeScript..."
npm run build

# 5. Create log directory
$logDir = "$repoDir\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# 6. Lock down session storage with NTFS ACLs
$sessionPath = "$repoDir\storage\sessions"
New-Item -ItemType Directory -Force -Path $sessionPath | Out-Null
icacls $sessionPath /inheritance:r /grant "NT AUTHORITY\SYSTEM:(OI)(CI)F" /grant "Administrators:(OI)(CI)F"
Write-Host "Session storage locked down: $sessionPath"

# 7. Generate encryption key if not set
$envFile = "$repoDir\.env"
if (-not (Test-Path $envFile)) {
    $key = -join ((1..32) | ForEach-Object { "{0:x2}" -f (Get-Random -Maximum 256) })
    @"
SESSION_ENCRYPTION_KEY=$key
PORT=3000
MAX_BROWSER_CONCURRENCY=6
LOG_LEVEL=info
"@ | Out-File -FilePath $envFile -Encoding utf8
    Write-Host "Generated .env with new encryption key"
    Write-Host "IMPORTANT: Back up SESSION_ENCRYPTION_KEY — losing it means re-authenticating all partners"
}

# 8. Register Windows service via NSSM
$serviceName = "DeliveryAggregator"
$nodeExe = (Get-Command node).Source

# Remove existing service if present
nssm stop $serviceName 2>$null
nssm remove $serviceName confirm 2>$null

nssm install $serviceName $nodeExe
nssm set $serviceName AppParameters "--env-file=$repoDir\.env $repoDir\dist\api\server.js"
nssm set $serviceName AppDirectory $repoDir
nssm set $serviceName AppStdout "$logDir\stdout.log"
nssm set $serviceName AppStderr "$logDir\stderr.log"
nssm set $serviceName AppRotateFiles 1
nssm set $serviceName AppRotateBytes 10485760
nssm set $serviceName AppRestartDelay 5000
nssm set $serviceName Start SERVICE_AUTO_START

Write-Host ""
Write-Host "Starting service..."
nssm start $serviceName

Write-Host ""
Write-Host "=== Setup Complete ==="
Write-Host "Service: $serviceName"
Write-Host "API: http://localhost:3000/v1/quotes"
Write-Host "Health: http://localhost:3000/v1/health"
Write-Host "Logs: $logDir"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. For each partner, run re-auth via API or manually place cookie files"
Write-Host "  2. POST http://localhost:3000/v1/reauth/lalamove (opens visible browser)"
Write-Host "  3. Monitor: GET http://localhost:3000/v1/health"

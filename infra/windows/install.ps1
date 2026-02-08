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
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# 3. Install Git (if not present)
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Git..."
    winget install Git.Git --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
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

# 7. Generate encryption key AND API key if not set
$envFile = "$repoDir\.env"
if (-not (Test-Path $envFile)) {
    $encKey = -join ((1..32) | ForEach-Object { "{0:x2}" -f (Get-Random -Maximum 256) })
    $apiKey = -join ((1..32) | ForEach-Object { "{0:x2}" -f (Get-Random -Maximum 256) })
    $envContent = "SESSION_ENCRYPTION_KEY=$encKey`nAPI_KEY=$apiKey`nPORT=3000`nMAX_BROWSER_CONCURRENCY=6`nLOG_LEVEL=info`nREQUEST_TIMEOUT_MS=60000`nRATE_LIMIT_MAX=30`nRATE_LIMIT_WINDOW_MS=60000"
    [System.IO.File]::WriteAllText($envFile, $envContent)
    Write-Host "Generated .env with new encryption key and API key"
    Write-Host "IMPORTANT: Back up SESSION_ENCRYPTION_KEY if you lose it you must re-authenticate all partners"
    Write-Host "API_KEY: $apiKey (use this in x-api-key header)"
} else {
    $envContent = Get-Content $envFile -Raw
    if ($envContent -notmatch "API_KEY=") {
        $apiKey = -join ((1..32) | ForEach-Object { "{0:x2}" -f (Get-Random -Maximum 256) })
        Add-Content -Path $envFile -Value "API_KEY=$apiKey"
        Write-Host "Added API_KEY to existing .env: $apiKey"
    }
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
Write-Host "Metrics: http://localhost:3000/v1/metrics"
Write-Host "Logs: $logDir"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. For each partner, run re-auth via API"
Write-Host "  2. POST http://localhost:3000/v1/reauth/lalamove -H x-api-key:YOUR_KEY"
Write-Host "  3. Monitor: GET http://localhost:3000/v1/health"

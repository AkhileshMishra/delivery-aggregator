# Azure VM Provisioning (PowerShell)
# Run from your local machine or Azure Cloud Shell to create the Windows VM.
# Prerequisites: Azure CLI installed and logged in (az login).

param(
    [string]$ResourceGroup = "rg-delivery-aggregator",
    [string]$Location = "southeastasia",
    [string]$VmName = "vm-delivery-agg",
    [string]$VmSize = "Standard_D4s_v5",  # 4 vCPU, 16GB RAM — handles 6 browser contexts
    [string]$AdminUsername = "azureadmin",
    [string]$AdminPassword,  # Will prompt if not provided
    [string]$AllowedIp       # Your IP for API access (e.g. "203.0.113.50")
)

if (-not $AdminPassword) {
    $securePass = Read-Host "Enter VM admin password" -AsSecureString
    $AdminPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
    )
}

if (-not $AllowedIp) {
    # Auto-detect caller's public IP
    $AllowedIp = (Invoke-RestMethod -Uri "https://api.ipify.org" -TimeoutSec 5)
    Write-Host "Auto-detected your IP: $AllowedIp"
}

Write-Host "Creating resource group..."
az group create --name $ResourceGroup --location $Location

Write-Host "Creating Windows VM..."
az vm create `
    --resource-group $ResourceGroup `
    --name $VmName `
    --image "MicrosoftWindowsServer:WindowsServer:2022-datacenter-g2:latest" `
    --size $VmSize `
    --admin-username $AdminUsername `
    --admin-password $AdminPassword `
    --os-disk-size-gb 128 `
    --public-ip-sku Standard `
    --nsg-rule NONE  # Don't open any ports by default

$nsgName = "${VmName}NSG"

# RDP: restricted to operator IP only
Write-Host "Opening RDP (port 3389) restricted to $AllowedIp..."
az network nsg rule create `
    --resource-group $ResourceGroup `
    --nsg-name $nsgName `
    --name AllowRDP `
    --priority 1000 `
    --source-address-prefixes $AllowedIp `
    --destination-port-ranges 3389 `
    --access Allow `
    --protocol Tcp `
    --direction Inbound

# API port: restricted to allowed IP (use CIDR range for multiple callers)
Write-Host "Opening API (port 3000) restricted to $AllowedIp..."
az network nsg rule create `
    --resource-group $ResourceGroup `
    --nsg-name $nsgName `
    --name AllowAPI `
    --priority 1010 `
    --source-address-prefixes $AllowedIp `
    --destination-port-ranges 3000 `
    --access Allow `
    --protocol Tcp `
    --direction Inbound

Write-Host ""
Write-Host "VM created with restricted network access."
Write-Host ""
Write-Host "SECURITY NOTES:"
Write-Host "  - Port 3000 and 3389 are restricted to $AllowedIp"
Write-Host "  - To add more IPs: az network nsg rule update --add source-address-prefixes <IP>"
Write-Host "  - For HTTPS: set up a reverse proxy (Caddy/nginx) with a TLS cert on the VM"
Write-Host "  - API_KEY is REQUIRED — set it in .env on the VM"
Write-Host ""

$vmIp = az vm show -d --resource-group $ResourceGroup --name $VmName --query publicIps -o tsv
Write-Host "VM Public IP: $vmIp"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. RDP into $vmIp"
Write-Host "  2. Clone repo: git clone https://github.com/AkhileshMishra/delivery-aggregator.git C:\delivery-aggregator"
Write-Host "  3. Run: C:\delivery-aggregator\infra\windows\install.ps1"
Write-Host "  4. Set API_KEY in C:\delivery-aggregator\.env"
Write-Host "  5. (Recommended) Install Caddy for HTTPS reverse proxy"

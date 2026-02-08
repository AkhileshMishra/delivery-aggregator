# Azure VM Provisioning (PowerShell)
# Run from your local machine or Azure Cloud Shell to create the Windows VM.
# Prerequisites: Azure CLI installed and logged in (az login).

param(
    [string]$ResourceGroup = "rg-delivery-aggregator",
    [string]$Location = "southeastasia",
    [string]$VmName = "vm-delivery-agg",
    [string]$VmSize = "Standard_D4s_v5",  # 4 vCPU, 16GB RAM — handles 6 browser contexts
    [string]$AdminUsername = "azureadmin",
    [string]$AdminPassword  # Will prompt if not provided
)

if (-not $AdminPassword) {
    $securePass = Read-Host "Enter VM admin password" -AsSecureString
    $AdminPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
    )
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
    --nsg-rule RDP

Write-Host "Opening port 3000 for API traffic..."
az vm open-port `
    --resource-group $ResourceGroup `
    --name $VmName `
    --port 3000 `
    --priority 1010

Write-Host "Opening port 3389 for RDP (management)..."
# Already opened by --nsg-rule RDP above

Write-Host ""
Write-Host "VM created. Next steps:"
Write-Host "  1. RDP into the VM"
Write-Host "  2. Clone the repo: git clone https://github.com/AkhileshMishra/delivery-aggregator.git C:\delivery-aggregator"
Write-Host "  3. Run: C:\delivery-aggregator\infra\windows\install.ps1"
Write-Host ""

$vmIp = az vm show -d --resource-group $ResourceGroup --name $VmName --query publicIps -o tsv
Write-Host "VM Public IP: $vmIp"
Write-Host "API will be available at: http://${vmIp}:3000/v1/quotes"

# Sync Root .env to Supabase Edge Functions .env.local
# This script copies SUPABASE_* variables from root .env to Edge Functions .env.local

param(
    [switch]$Force,
    [string]$RootEnvPath = ".env",
    [string]$EdgeEnvPath = "supabase/functions/.env.local"
)

Write-Host ""
Write-Host "[SYNC] Syncing Root .env to Supabase Edge Functions" -ForegroundColor Cyan
Write-Host ""

# Check if root .env exists
if (-not (Test-Path $RootEnvPath)) {
    Write-Host "[ERROR] Root .env file not found: $RootEnvPath" -ForegroundColor Red
    Write-Host "   Expected location: $((Get-Location).Path)\$RootEnvPath" -ForegroundColor Yellow
    exit 1
}

# Read root .env
Write-Host "[READ] Reading root .env file..." -ForegroundColor Cyan
$rootEnvContent = Get-Content $RootEnvPath

# Filter Supabase-related variables (non-commented, non-empty)
$supabaseVars = $rootEnvContent | Where-Object {
    $_ -match '^SUPABASE_' -and 
    $_ -notmatch '^\s*#' -and
    $_ -notmatch '^\s*$' -and
    $_ -match '='
}

if ($supabaseVars.Count -eq 0) {
    Write-Host "[WARN] No SUPABASE_ variables found in root .env" -ForegroundColor Yellow
    Write-Host "   Looking for variables starting with SUPABASE_" -ForegroundColor Yellow
    exit 0
}

Write-Host "[OK] Found $($supabaseVars.Count) SUPABASE_ variable(s)" -ForegroundColor Green

# Check if Edge Functions .env.local exists
$edgeEnvExists = Test-Path $EdgeEnvPath

if ($edgeEnvExists -and -not $Force) {
    Write-Host ""
    Write-Host "[WARN] Edge Functions .env.local already exists: $EdgeEnvPath" -ForegroundColor Yellow
    Write-Host "   Use -Force to overwrite, or manually merge the values" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Variables that would be synced:" -ForegroundColor Cyan
    $supabaseVars | ForEach-Object {
        $varName = ($_ -split '=')[0].Trim()
        Write-Host "   - $varName" -ForegroundColor Gray
    }
    exit 0
}

# Create directory if it doesn't exist
$edgeEnvDir = Split-Path -Parent $EdgeEnvPath
if (-not (Test-Path $edgeEnvDir)) {
    Write-Host "[CREATE] Creating directory: $edgeEnvDir" -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $edgeEnvDir -Force | Out-Null
}

# If file exists and Force is set, backup first
if ($edgeEnvExists -and $Force) {
    $backupPath = "$EdgeEnvPath.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Write-Host "[BACKUP] Backing up existing file to: $backupPath" -ForegroundColor Cyan
    Copy-Item $EdgeEnvPath $backupPath
}

# Write Supabase variables
Write-Host "[WRITE] Writing to: $EdgeEnvPath" -ForegroundColor Cyan

# Add header comment
$header = @"
# Supabase Edge Functions - Environment Variables
# Synced from root .env on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
# 
# Default Supabase secrets (from root .env):
"@

$header | Out-File -FilePath $EdgeEnvPath -Encoding utf8

# Write variables
$supabaseVars | Out-File -FilePath $EdgeEnvPath -Append -Encoding utf8

# Add footer comment
$footer = @"

# ============================================
# Add custom Edge Function secrets below:
# ============================================
# OPENAI_API_KEY=sk-test-...
# STRIPE_SECRET_KEY=sk_test_...
# EXTERNAL_API_KEY=dev-api-key
"@

$footer | Out-File -FilePath $EdgeEnvPath -Append -Encoding utf8

Write-Host ""
Write-Host "[SUCCESS] Successfully synced $($supabaseVars.Count) variable(s) to Edge Functions .env.local" -ForegroundColor Green
Write-Host ""
Write-Host "Synced variables:" -ForegroundColor Cyan
$supabaseVars | ForEach-Object {
    $varName = ($_ -split '=')[0].Trim()
    Write-Host "   [OK] $varName" -ForegroundColor Gray
}
Write-Host ""
Write-Host "[NEXT] Next steps:" -ForegroundColor Yellow
Write-Host "   1. Add custom Edge Function secrets to: $EdgeEnvPath" -ForegroundColor White
Write-Host "   2. Use: supabase functions serve <function-name> --env-file $EdgeEnvPath" -ForegroundColor White
Write-Host ""


# Supabase Secrets Setup Script for PowerShell
# This script helps manage Edge Function secrets for different environments

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('dev', 'staging', 'production')]
    [string]$Environment = 'dev',
    
    [Parameter(Mandatory=$false)]
    [switch]$List,
    
    [Parameter(Mandatory=$false)]
    [switch]$Help
)

function Show-Help {
    Write-Host @"
Supabase Edge Functions Secrets Management

USAGE:
    .\supabase-secrets-setup.ps1 [OPTIONS]

OPTIONS:
    -Environment <env>     Environment: dev, staging, production (default: dev)
    -List                 List all current secrets
    -Help                 Show this help message

EXAMPLES:
    # List all secrets
    .\supabase-secrets-setup.ps1 -List

    # Set secrets for development
    .\supabase-secrets-setup.ps1 -Environment dev

    # Set secrets for production
    .\supabase-secrets-setup.ps1 -Environment production

NOTES:
    - Ensure you have Supabase CLI installed: npm install -g supabase
    - Ensure you're logged in: supabase login
    - Ensure you're linked to your project: supabase link --project-ref <your-ref>
    - Never commit .env files to version control
"@
}

function List-Secrets {
    Write-Host "`n📋 Listing all Edge Function secrets...`n" -ForegroundColor Cyan
    supabase secrets list
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n❌ Error: Failed to list secrets. Ensure you're logged in and linked to your project." -ForegroundColor Red
        Write-Host "   Run: supabase login" -ForegroundColor Yellow
        Write-Host "   Run: supabase link --project-ref <your-project-ref>`n" -ForegroundColor Yellow
    }
}

function Set-SecretsFromFile {
    param([string]$EnvFile)
    
    if (-not (Test-Path $EnvFile)) {
        Write-Host "`n❌ Error: Environment file not found: $EnvFile" -ForegroundColor Red
        Write-Host "   Create the file first or use the example: supabase/functions/.env.example`n" -ForegroundColor Yellow
        return
    }
    
    Write-Host "`n🔐 Setting secrets from $EnvFile...`n" -ForegroundColor Cyan
    supabase secrets set --env-file $EnvFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Secrets set successfully!`n" -ForegroundColor Green
    } else {
        Write-Host "`n❌ Error: Failed to set secrets. Check your Supabase CLI connection.`n" -ForegroundColor Red
    }
}

# Main execution
if ($Help) {
    Show-Help
    exit 0
}

if ($List) {
    List-Secrets
    exit 0
}

# Determine environment file
$envFile = switch ($Environment) {
    'dev' { 'supabase/functions/.env.local' }
    'staging' { 'supabase/functions/.env.staging' }
    'production' { 'supabase/functions/.env.production' }
}

Write-Host "`n🚀 Supabase Edge Functions Secrets Setup`n" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host "Environment file: $envFile`n" -ForegroundColor Yellow

# Check if Supabase CLI is installed
$supabaseInstalled = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseInstalled) {
    Write-Host "❌ Error: Supabase CLI not found!" -ForegroundColor Red
    Write-Host "   Install it with: npm install -g supabase`n" -ForegroundColor Yellow
    exit 1
}

Set-SecretsFromFile -EnvFile $envFile


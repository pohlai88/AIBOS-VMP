# Set Password via Supabase Management API (Same as CLI uses)
# Project: vrawceruzokxitybkufk

$email = "jackwee2020@gmail.com"
$password = "admin123"
$authUserId = "cb431435-02f4-45cb-83fa-abc12104cc8f"
$projectRef = "vrawceruzokxitybkufk"

# Get Service Role Key from environment
$serviceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $serviceRoleKey) {
    Write-Host "❌ Error: SUPABASE_SERVICE_ROLE_KEY must be set" -ForegroundColor Red
    Write-Host "   Set it as: `$env:SUPABASE_SERVICE_ROLE_KEY = 'your-key'" -ForegroundColor Yellow
    exit 1
}

Write-Host "🔐 Setting password via Supabase Management API" -ForegroundColor Cyan
Write-Host "=" * 70
Write-Host "📧 Email: $email" -ForegroundColor White
Write-Host "👤 User ID: $authUserId" -ForegroundColor White
Write-Host "🔑 Password: $password" -ForegroundColor White
Write-Host ""

# Supabase Management API endpoint
$apiUrl = "https://api.supabase.com/v1/projects/$projectRef/auth/users/$authUserId"

$headers = @{
    "Authorization" = "Bearer $serviceRoleKey"
    "Content-Type" = "application/json"
    "apikey" = $serviceRoleKey
}

$body = @{
    password = $password
} | ConvertTo-Json

try {
    Write-Host "📡 Calling Supabase Management API..." -ForegroundColor Yellow
    
    $response = Invoke-RestMethod -Uri $apiUrl `
        -Method PATCH `
        -Headers $headers `
        -Body $body `
        -ErrorAction Stop
    
    Write-Host "✅ Password updated successfully!" -ForegroundColor Green
    Write-Host "   User ID: $($response.id)" -ForegroundColor Green
    Write-Host "   Email: $($response.email)" -ForegroundColor Green
    Write-Host "   Updated: $($response.updated_at)" -ForegroundColor Green
    
    Write-Host "`n✨ Done! User can now login:" -ForegroundColor Green
    Write-Host "   Email: $email" -ForegroundColor Cyan
    Write-Host "   Password: $password" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Status: $statusCode" -ForegroundColor Red
        Write-Host "   Response: $responseBody" -ForegroundColor Red
    }
    Write-Host "`n💡 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   1. Check SUPABASE_SERVICE_ROLE_KEY is correct" -ForegroundColor Yellow
    Write-Host "   2. Verify project ref: $projectRef" -ForegroundColor Yellow
    Write-Host "   3. Ensure Service Role Key has admin permissions" -ForegroundColor Yellow
    exit 1
}



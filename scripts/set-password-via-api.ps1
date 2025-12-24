# PowerShell script to set password via server admin route
# Run: .\scripts\set-password-via-api.ps1

$email = "jackwee2020@gmail.com"
$password = "admin123"
$serverUrl = "http://localhost:9000"

Write-Host "🔐 Setting password for $email" -ForegroundColor Cyan
Write-Host "=" * 70

$body = @{
    email = $email
    password = $password
} | ConvertTo-Json

try {
    Write-Host "📡 Sending request to $serverUrl/admin/set-password..." -ForegroundColor Yellow
    
    $response = Invoke-RestMethod -Uri "$serverUrl/admin/set-password" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -ErrorAction Stop
    
    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host "   Message: $($response.message)" -ForegroundColor Green
    Write-Host "   Email: $($response.email)" -ForegroundColor Green
    if ($response.userId) {
        Write-Host "   User ID: $($response.userId)" -ForegroundColor Green
    }
    
    Write-Host "`n✨ Password updated successfully!" -ForegroundColor Green
    Write-Host "   Login with: $email / $password" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host "`n💡 Make sure:" -ForegroundColor Yellow
    Write-Host "   1. Server is running (npm run dev or npm start)" -ForegroundColor Yellow
    Write-Host "   2. Server is accessible at $serverUrl" -ForegroundColor Yellow
    Write-Host "   3. .env file has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor Yellow
    exit 1
}



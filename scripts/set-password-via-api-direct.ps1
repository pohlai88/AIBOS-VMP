# Set Password via Supabase Management API
# This uses the same API that Supabase CLI would use

$email = "jackwee2020@gmail.com"
$password = "admin123"
$authUserId = "cb431435-02f4-45cb-83fa-abc12104cc8f"

# Get Supabase URL and Service Role Key from environment
# You can also set these directly here if needed
$supabaseUrl = $env:SUPABASE_URL
$serviceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $supabaseUrl -or -not $serviceRoleKey) {
    Write-Host "❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set" -ForegroundColor Red
    Write-Host "   Set them as environment variables or edit this script" -ForegroundColor Yellow
    exit 1
}

Write-Host "🔐 Setting password for $email via Supabase Management API" -ForegroundColor Cyan
Write-Host "=" * 70

# Extract project ref from URL (e.g., https://xxxxx.supabase.co -> xxxxx)
$projectRef = ($supabaseUrl -replace 'https://', '' -replace '.supabase.co', '').Split('/')[0]

# Management API endpoint
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
    Write-Host "📡 Sending request to Supabase Management API..." -ForegroundColor Yellow
    Write-Host "   URL: $apiUrl" -ForegroundColor Gray
    
    $response = Invoke-RestMethod -Uri $apiUrl `
        -Method PATCH `
        -Headers $headers `
        -Body $body `
        -ErrorAction Stop
    
    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host "   User ID: $($response.id)" -ForegroundColor Green
    Write-Host "   Email: $($response.email)" -ForegroundColor Green
    
    Write-Host "`n✨ Password updated successfully!" -ForegroundColor Green
    Write-Host "   Login with: $email / $password" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Red
    }
    Write-Host "`n💡 Make sure:" -ForegroundColor Yellow
    Write-Host "   1. SUPABASE_URL is set correctly" -ForegroundColor Yellow
    Write-Host "   2. SUPABASE_SERVICE_ROLE_KEY is set correctly" -ForegroundColor Yellow
    Write-Host "   3. Service Role Key has admin permissions" -ForegroundColor Yellow
    exit 1
}



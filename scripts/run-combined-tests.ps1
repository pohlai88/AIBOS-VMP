# PowerShell script to run combined browser and E2E tests
# Use this if running directly in PowerShell (npm scripts handle && automatically)

$ErrorActionPreference = "Stop"

Write-Host "Running Browser Tests..." -ForegroundColor Cyan
npm run test:browser

if ($LASTEXITCODE -ne 0) {
    Write-Host "Browser tests failed. Exiting." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`nRunning E2E Tests..." -ForegroundColor Cyan
npm run test:e2e

if ($LASTEXITCODE -ne 0) {
    Write-Host "E2E tests failed. Exiting." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`nAll tests completed successfully!" -ForegroundColor Green


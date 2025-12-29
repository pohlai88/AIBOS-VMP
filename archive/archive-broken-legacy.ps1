# ============================================================================
# Archive Broken & Legacy Files Script
# ============================================================================
# Date: 2025-01-27
# Purpose: Archive broken, legacy, and immature files to prevent contamination
# ============================================================================

Write-Host "`n📦 ARCHIVING BROKEN AND LEGACY FILES" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

$archiveRoot = ".archive"
$legacyCode = "$archiveRoot\legacy-code"
$immatureCode = "$archiveRoot\immature-code"

# Ensure archive directories exist
$dirs = @(
    "$legacyCode\broken-imports",
    "$legacyCode\legacy-routes",
    "$legacyCode\legacy-adapters",
    "$legacyCode\legacy-middleware",
    "$legacyCode\legacy-utils",
    "$legacyCode\legacy-tests",
    "$legacyCode\legacy-scripts",
    "$immatureCode\todos",
    "$immatureCode\incomplete"
)

foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        Write-Host "   ✅ Created: $dir" -ForegroundColor Green
    }
}

Write-Host "`n[1/7] Extracting broken imports from server.js..." -ForegroundColor Yellow

# Extract broken imports section
$brokenImports = @'
// ============================================================================
// BROKEN IMPORTS - ARCHIVED 2025-01-27
// ============================================================================
// These imports reference deleted files and will cause runtime errors
// Original location: server.js lines 18-24
// ============================================================================

import vendorRouter from './src/routes/vendor.js';           // File deleted
import clientRouter from './src/routes/client.js';          // File deleted
import { attachSupabaseClient } from './src/middleware/supabase-client.js'; // File deleted
import { vmpAdapter } from './src/adapters/supabase.js';     // File deleted

// ============================================================================
// REPLACEMENT IMPORTS (Use these instead):
// ============================================================================
// import nexusClientRouter from './src/routes/nexus-client.js';
// import nexusVendorRouter from './src/routes/nexus-vendor.js';
// import nexusPortalRouter from './src/routes/nexus-portal.js';
// import { nexusAdapter } from './src/adapters/nexus-adapter.js';
// ============================================================================
'@

$brokenImports | Out-File -FilePath "$legacyCode\broken-imports\server-broken-imports.js" -Encoding UTF8
Write-Host "   ✅ Extracted broken imports to archive" -ForegroundColor Green

Write-Host "`n[2/7] Archiving legacy utility files..." -ForegroundColor Yellow

# Legacy utils that import deleted vmpAdapter
$legacyUtils = @(
    @{Path="src\utils\soa-matching-engine.js"; Reason="Imports deleted vmpAdapter"},
    @{Path="src\utils\push-sender.js"; Reason="Imports deleted vmpAdapter"},
    @{Path="src\utils\notifications.js"; Reason="Imports deleted vmpAdapter"}
)

foreach ($util in $legacyUtils) {
    if (Test-Path $util.Path) {
        $dest = "$legacyCode\legacy-utils\$(Split-Path $util.Path -Leaf)"
        Copy-Item -Path $util.Path -Destination $dest -Force
        Write-Host "   ✅ Archived: $($util.Path) -> $dest" -ForegroundColor Green
        Write-Host "      Reason: $($util.Reason)" -ForegroundColor Gray
    }
}

Write-Host "`n[3/7] Archiving legacy test files..." -ForegroundColor Yellow

# Legacy tests that import deleted vmpAdapter
$legacyTests = @(
    "tests\adapters\supabase.test.js",
    "tests\adapter-branch-coverage.test.js",
    "tests\adapters\soa-adapter.test.js",
    "tests\adapters\supabase-error-simulation.test.js",
    "tests\adapters-supabase-comprehensive-error-paths.test.js",
    "tests\adapters-supabase-error-paths.test.js",
    "tests\adapters-supabase-upload-error-paths.test.js",
    "tests\adapters-supabase-upload-mock-error-paths.test.js",
    "tests\adapters-supabase-mock-storage-error.test.js",
    "tests\server-middleware.test.js",
    "tests\server-routes.test.js",
    "tests\server-extended.test.js",
    "tests\days5-8.test.js",
    "tests\server-soa-routes.test.js",
    "tests\server-branch-coverage.test.js",
    "tests\mobile-ux-improvements.test.js",
    "tests\helpers\auth-helper.js",
    "tests\emergency-pay-override.test.js"
)

$testCount = 0
foreach ($test in $legacyTests) {
    if (Test-Path $test) {
        $dest = "$legacyCode\legacy-tests\$(Split-Path $test -Leaf)"
        Copy-Item -Path $test -Destination $dest -Force
        $testCount++
        Write-Host "   ✅ Archived: $test" -ForegroundColor Green
    }
}
Write-Host "   📊 Archived $testCount test files" -ForegroundColor Cyan

Write-Host "`n[4/7] Archiving legacy scripts..." -ForegroundColor Yellow

# Legacy scripts that reference vmp_* tables
$legacyScripts = @(
    @{Path="scripts\seed-vmp-data.js"; Reason="Uses vmp_* tables"},
    @{Path="scripts\seed-dev-org-tree.js"; Reason="Uses vmp_* tables"},
    @{Path="scripts\seed-superholding-company.js"; Reason="Uses vmp_* tables"},
    @{Path="scripts\setup-default-tenant-vendor.js"; Reason="Uses vmp_* tables"},
    @{Path="scripts\verify-dev-account.js"; Reason="Uses vmp_* tables"},
    @{Path="scripts\validate-super-admin.js"; Reason="Uses vmp_* tables"},
    @{Path="scripts\set-password.js"; Reason="Uses vmp_* tables"}
)

$scriptCount = 0
foreach ($script in $legacyScripts) {
    if (Test-Path $script.Path) {
        $dest = "$legacyCode\legacy-scripts\$(Split-Path $script.Path -Leaf)"
        Copy-Item -Path $script.Path -Destination $dest -Force
        $scriptCount++
        Write-Host "   ✅ Archived: $($script.Path)" -ForegroundColor Green
        Write-Host "      Reason: $($script.Reason)" -ForegroundColor Gray
    }
}
Write-Host "   📊 Archived $scriptCount scripts" -ForegroundColor Cyan

Write-Host "`n[5/7] Documenting TODO/FIXME items..." -ForegroundColor Yellow

# Extract TODOs from server.js
$todos = @()
$serverLines = Get-Content "server.js"
for ($i = 0; $i -lt $serverLines.Length; $i++) {
    if ($serverLines[$i] -match "TODO|FIXME|HACK|XXX|STUB|PLACEHOLDER") {
        $todos += "Line $($i+1): $($serverLines[$i].Trim())"
    }
}

$todoContent = @'
# TODO/FIXME Items Found in Codebase

**Date:** 2025-01-27  
**Source:** Automated scan

## server.js

'@ + ($todos -join "`n") + @'

## Other Files

- tests\security\vendor_leakage.test.js - Multiple TODOs
- supabase\migrations\20250102000000_notifications_realtime_rls.sql - Production TODO
- src\routes\nexus-portal.js - TODO: Send email with invite link

'@

$todoContent | Out-File -FilePath "$immatureCode\todos\TODO_LIST.md" -Encoding UTF8
Write-Host "   ✅ Documented $($todos.Count) TODO items" -ForegroundColor Green

Write-Host "`n[6/7] Creating server.js backup..." -ForegroundColor Yellow

# Backup current server.js
$backupName = "server.js.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -Path "server.js" -Destination "$legacyCode\broken-imports\$backupName" -Force
Write-Host "   ✅ Backup created: $backupName" -ForegroundColor Green

Write-Host "`n[7/7] Creating archive summary..." -ForegroundColor Yellow

$summary = @'
# Archive Summary

**Date:** '@ + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + @'
**Total Files Archived:** '@ + ($legacyUtils.Count + $testCount + $scriptCount) + @'

## Files Archived

### Legacy Utils: '@ + $legacyUtils.Count + @'
- soa-matching-engine.js
- push-sender.js
- notifications.js

### Legacy Tests: '@ + $testCount + @'
- All tests importing vmpAdapter from deleted supabase.js

### Legacy Scripts: '@ + $scriptCount + @'
- Scripts using vmp_* tables

### Broken Imports
- server.js broken imports section (lines 18-24)

## Next Steps

1. **Remove broken imports** from server.js (lines 18-24)
2. **Replace vmpAdapter** references with nexusAdapter
3. **Update table references** from vmp_* to nexus_*
4. **Test thoroughly** after changes

## Restoration

To restore archived files, see `.archive\ARCHIVE_MANIFEST.md`

'@

$summary | Out-File -FilePath "$archiveRoot\ARCHIVE_SUMMARY.md" -Encoding UTF8
Write-Host "   ✅ Summary created" -ForegroundColor Green

Write-Host "`nARCHIVE COMPLETE" -ForegroundColor Green
Write-Host "===================" -ForegroundColor Green
Write-Host ""
Write-Host "Archive location: $archiveRoot" -ForegroundColor Cyan
Write-Host "Manifest: $archiveRoot\ARCHIVE_MANIFEST.md" -ForegroundColor Cyan
Write-Host "Summary: $archiveRoot\ARCHIVE_SUMMARY.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "WARNING: NEXT STEP: Remove broken imports from server.js manually" -ForegroundColor Yellow
$brokenImportsPath = Join-Path $legacyCode "broken-imports\server-broken-imports.js"
Write-Host "See: $brokenImportsPath" -ForegroundColor Gray
Write-Host ""


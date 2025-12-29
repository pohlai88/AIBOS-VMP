# ============================================================================
# Phase 13: Legacy VMP Move Script (PowerShell) - SAFE VERSION
# ============================================================================
# Date: 2025-12-27
# Purpose: MOVE legacy VMP files to VMP-LEGACY/ directory for backup
#
# USAGE:
#   .\scripts\phase13-move-legacy.ps1
#
# This script MOVES files (not deletes). Review VMP-LEGACY/ before removing.
# ============================================================================

Write-Host ""
Write-Host "[Phase 13] Move Legacy VMP to Backup Directory" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Create VMP-LEGACY directory structure
$legacyRoot = "VMP-LEGACY"
$legacyDirs = @(
    "$legacyRoot",
    "$legacyRoot/adapters",
    "$legacyRoot/routes",
    "$legacyRoot/pages",
    "$legacyRoot/partials",
    "$legacyRoot/tests",
    "$legacyRoot/utils",
    "$legacyRoot/services",
    "$legacyRoot/middleware"
)

Write-Host "[1/10] Creating VMP-LEGACY directory structure..." -ForegroundColor Yellow
foreach ($dir in $legacyDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "   + Created $dir" -ForegroundColor Green
    }
}

# --- STEP 1: Backup old server.js ---
Write-Host ""
Write-Host "[2/10] Moving server.js to backup..." -ForegroundColor Yellow
if (Test-Path "server.js") {
    Move-Item -Path "server.js" -Destination "$legacyRoot/server.js" -Force
    Write-Host "   + server.js -> $legacyRoot/server.js" -ForegroundColor Green
}

# --- STEP 2: Rename server-nexus.js to server.js ---
Write-Host ""
Write-Host "[3/10] Activating new server..." -ForegroundColor Yellow
if (Test-Path "server-nexus.js") {
    Move-Item -Path "server-nexus.js" -Destination "server.js" -Force
    Write-Host "   + server-nexus.js -> server.js" -ForegroundColor Green
}

# --- STEP 3: Move legacy adapter ---
Write-Host ""
Write-Host "[4/10] Moving legacy adapter..." -ForegroundColor Yellow
if (Test-Path "src/adapters/supabase.js") {
    Move-Item -Path "src/adapters/supabase.js" -Destination "$legacyRoot/adapters/supabase.js" -Force
    Write-Host "   + src/adapters/supabase.js -> $legacyRoot/adapters/" -ForegroundColor Green
}

# --- STEP 4: Move legacy routes ---
Write-Host ""
Write-Host "[5/10] Moving legacy routes..." -ForegroundColor Yellow
$legacyRoutes = @("src/routes/client.js", "src/routes/vendor.js")
foreach ($route in $legacyRoutes) {
    if (Test-Path $route) {
        $filename = Split-Path $route -Leaf
        Move-Item -Path $route -Destination "$legacyRoot/routes/$filename" -Force
        Write-Host "   + $route -> $legacyRoot/routes/" -ForegroundColor Green
    }
}

# --- STEP 5: Move legacy templates (keep landing, manifesto) ---
Write-Host ""
Write-Host "[6/10] Moving legacy templates..." -ForegroundColor Yellow

# Pages to MOVE (legacy VMP) - NOT landing.html or manifesto.html
$legacyPages = @(
    "accept.html",
    "case-detail.html",
    "case_dashboard.html",
    "case_detail.html",
    "case_template.html",
    "error.html",
    "forgot_password.html",
    "help.html",
    "home.html",
    "invoices.html",
    "invoice_detail.html",
    "invoice_list.html",
    "login.html",
    "new_case.html",
    "notifications.html",
    "ops_access_requests.html",
    "ops_cases.html",
    "ops_case_detail.html",
    "ops_command_center.html",
    "ops_dashboard.html",
    "ops_data_history.html",
    "ops_ingest.html",
    "ops_invite_new.html",
    "ops_ports.html",
    "ops_vendors.html",
    "payments.html",
    "payment_detail.html",
    "payment_history.html",
    "profile.html",
    "reset_password.html",
    "scanner.html",
    "settings.html",
    "sign_up.html",
    "sla_analytics.html",
    "soa_recon.html",
    "supabase_invite_handler.html",
    "supplier_dashboard.html",
    "vendor-dashboard.html",
    "vendor-management.html",
    "403.html"
)

foreach ($page in $legacyPages) {
    $path = "src/views/pages/$page"
    if (Test-Path $path) {
        Move-Item -Path $path -Destination "$legacyRoot/pages/$page" -Force
        Write-Host "   + $page -> $legacyRoot/pages/" -ForegroundColor Green
    }
}

# Pages to KEEP (marketing) - DO NOT MOVE
Write-Host ""
Write-Host "   [KEPT] src/views/pages/landing.html (marketing)" -ForegroundColor Cyan
Write-Host "   [KEPT] src/views/pages/manifesto.html (marketing)" -ForegroundColor Cyan

# Move desktop_client folder if exists
if (Test-Path "src/views/pages/desktop_client") {
    Move-Item -Path "src/views/pages/desktop_client" -Destination "$legacyRoot/pages/desktop_client" -Force
    Write-Host "   + desktop_client/ -> $legacyRoot/pages/" -ForegroundColor Green
}

# --- STEP 6: Move legacy partials ---
Write-Host ""
Write-Host "[7/10] Moving legacy partials..." -ForegroundColor Yellow

$partials = Get-ChildItem -Path "src/views/partials" -Filter "*.html" -File -ErrorAction SilentlyContinue
foreach ($partial in $partials) {
    Move-Item -Path $partial.FullName -Destination "$legacyRoot/partials/$($partial.Name)" -Force
    Write-Host "   + $($partial.Name) -> $legacyRoot/partials/" -ForegroundColor Green
}

# --- STEP 7: Move legacy tests ---
Write-Host ""
Write-Host "[8/10] Moving legacy tests..." -ForegroundColor Yellow
$legacyTests = @(
    "tests/server.test.js",
    "tests/server-soa-tenant-auto-default.test.js"
)
foreach ($test in $legacyTests) {
    if (Test-Path $test) {
        $filename = Split-Path $test -Leaf
        Move-Item -Path $test -Destination "$legacyRoot/tests/$filename" -Force
        Write-Host "   + $filename -> $legacyRoot/tests/" -ForegroundColor Green
    }
}

# Move SOA tests
$soaTests = Get-ChildItem -Path "tests/utils" -Filter "soa-*.test.js" -File -ErrorAction SilentlyContinue
foreach ($test in $soaTests) {
    Move-Item -Path $test.FullName -Destination "$legacyRoot/tests/$($test.Name)" -Force
    Write-Host "   + $($test.Name) -> $legacyRoot/tests/" -ForegroundColor Green
}

# --- STEP 8: Move legacy utils ---
Write-Host ""
Write-Host "[9/10] Moving legacy utils..." -ForegroundColor Yellow
$legacyUtils = @(
    "email-parser.js",
    "whatsapp-parser.js",
    "ai-message-parser.js",
    "ai-data-validation.js",
    "ai-search.js",
    "sla-reminders.js",
    "soa-upload-helpers.js",
    "sla-cache.js"
)

foreach ($util in $legacyUtils) {
    $path = "src/utils/$util"
    if (Test-Path $path) {
        Move-Item -Path $path -Destination "$legacyRoot/utils/$util" -Force
        Write-Host "   + $util -> $legacyRoot/utils/" -ForegroundColor Green
    }
}

# --- STEP 9: Move legacy services ---
Write-Host ""
Write-Host "[10/10] Moving legacy services and middleware..." -ForegroundColor Yellow
if (Test-Path "src/services/decisions") {
    Move-Item -Path "src/services/decisions" -Destination "$legacyRoot/services/decisions" -Force
    Write-Host "   + src/services/decisions/ -> $legacyRoot/services/" -ForegroundColor Green
}

if (Test-Path "src/middleware/supabase-client.js") {
    Move-Item -Path "src/middleware/supabase-client.js" -Destination "$legacyRoot/middleware/supabase-client.js" -Force
    Write-Host "   + supabase-client.js -> $legacyRoot/middleware/" -ForegroundColor Green
}

# --- SUMMARY ---
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "[DONE] Phase 13 Move Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Legacy files moved to: VMP-LEGACY/" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review VMP-LEGACY/ directory"
Write-Host "  2. Export/backup VMP-LEGACY/ to external location"
Write-Host "  3. Run: npm run dev"
Write-Host "  4. Test: http://localhost:9000/nexus/login"
Write-Host "  5. Test: http://localhost:9000/ (landing)"
Write-Host "  6. Commit: git add -A ; git commit -m Phase13-Legacy-VMP-archived"
Write-Host ""
Write-Host "To rollback:" -ForegroundColor Red
Write-Host "  Move-Item -Path VMP-LEGACY/server.js -Destination server.js -Force"
Write-Host ""

# Show count
$fileCount = (Get-ChildItem -Path $legacyRoot -Recurse -File -ErrorAction SilentlyContinue).Count
Write-Host "VMP-LEGACY Contents: $fileCount files moved" -ForegroundColor Cyan

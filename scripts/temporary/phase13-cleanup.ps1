# ============================================================================
# Phase 13: Legacy VMP Cleanup Script (PowerShell)
# ============================================================================
# Date: 2025-12-27
# Purpose: Remove legacy VMP files after Nexus migration
#
# USAGE:
#   .\scripts\phase13-cleanup.ps1
#
# WARNING: This script deletes files. Review before running.
# ============================================================================

Write-Host "`n🧹 Phase 13: Legacy VMP Cleanup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# --- STEP 1: Backup old server.js ---
Write-Host "📦 Step 1: Backing up server.js..." -ForegroundColor Yellow
if (Test-Path "server.js") {
    Move-Item -Path "server.js" -Destination "server.js.legacy-backup" -Force
    Write-Host "   ✅ server.js → server.js.legacy-backup" -ForegroundColor Green
}

# --- STEP 2: Rename server-nexus.js to server.js ---
Write-Host ""
Write-Host "🔄 Step 2: Activating new server..." -ForegroundColor Yellow
if (Test-Path "server-nexus.js") {
    Move-Item -Path "server-nexus.js" -Destination "server.js" -Force
    Write-Host "   ✅ server-nexus.js → server.js" -ForegroundColor Green
}

# --- STEP 3: Delete legacy adapters ---
Write-Host ""
Write-Host "🗑️  Step 3: Removing legacy adapters..." -ForegroundColor Yellow
if (Test-Path "src/adapters/supabase.js") {
    Remove-Item -Path "src/adapters/supabase.js" -Force
    Write-Host "   ✅ Deleted src/adapters/supabase.js" -ForegroundColor Green
}

# --- STEP 4: Delete legacy routes ---
Write-Host ""
Write-Host "🗑️  Step 4: Removing legacy routes..." -ForegroundColor Yellow
$legacyRoutes = @("src/routes/client.js", "src/routes/vendor.js")
foreach ($route in $legacyRoutes) {
    if (Test-Path $route) {
        Remove-Item -Path $route -Force
        Write-Host "   ✅ Deleted $route" -ForegroundColor Green
    }
}

# --- STEP 5: Delete legacy templates (keep landing, manifesto) ---
Write-Host ""
Write-Host "🗑️  Step 5: Removing legacy templates..." -ForegroundColor Yellow

# Pages to DELETE (legacy VMP)
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
        Remove-Item -Path $path -Force
        Write-Host "   ✅ Deleted $path" -ForegroundColor Green
    }
}

# Pages to KEEP (marketing)
Write-Host ""
Write-Host "   📌 KEPT: src/views/pages/landing.html (marketing)" -ForegroundColor Cyan
Write-Host "   📌 KEPT: src/views/pages/manifesto.html (marketing)" -ForegroundColor Cyan

# --- STEP 6: Delete legacy partials ---
Write-Host ""
Write-Host "🗑️  Step 6: Removing legacy partials..." -ForegroundColor Yellow

$partials = Get-ChildItem -Path "src/views/partials" -Filter "*.html" -File -ErrorAction SilentlyContinue
foreach ($partial in $partials) {
    Remove-Item -Path $partial.FullName -Force
    Write-Host "   ✅ Deleted $($partial.FullName)" -ForegroundColor Green
}

# --- STEP 7: Delete legacy tests ---
Write-Host ""
Write-Host "🗑️  Step 7: Removing legacy tests..." -ForegroundColor Yellow
$legacyTests = @(
    "tests/server.test.js",
    "tests/server-soa-tenant-auto-default.test.js"
)
foreach ($test in $legacyTests) {
    if (Test-Path $test) {
        Remove-Item -Path $test -Force
        Write-Host "   ✅ Deleted $test" -ForegroundColor Green
    }
}

$soaTests = Get-ChildItem -Path "tests/utils" -Filter "soa-*.test.js" -File -ErrorAction SilentlyContinue
foreach ($test in $soaTests) {
    Remove-Item -Path $test.FullName -Force
    Write-Host "   ✅ Deleted $($test.FullName)" -ForegroundColor Green
}

# --- STEP 8: Delete legacy utils ---
Write-Host ""
Write-Host "🗑️  Step 8: Removing legacy utils..." -ForegroundColor Yellow
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
        Remove-Item -Path $path -Force
        Write-Host "   ✅ Deleted $path" -ForegroundColor Green
    }
}

# --- STEP 9: Delete legacy services ---
Write-Host ""
Write-Host "🗑️  Step 9: Removing legacy services..." -ForegroundColor Yellow
if (Test-Path "src/services/decisions") {
    Remove-Item -Path "src/services/decisions" -Recurse -Force
    Write-Host "   ✅ Deleted src/services/decisions/" -ForegroundColor Green
}

# --- STEP 10: Delete desktop client ---
Write-Host ""
Write-Host "🗑️  Step 10: Removing legacy desktop client..." -ForegroundColor Yellow
if (Test-Path "src/views/pages/desktop_client") {
    Remove-Item -Path "src/views/pages/desktop_client" -Recurse -Force
    Write-Host "   ✅ Deleted src/views/pages/desktop_client/" -ForegroundColor Green
}

# --- DONE ---
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "✨ Phase 13 Cleanup Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run: npm run dev"
Write-Host "  2. Test: http://localhost:9000/nexus/login"
Write-Host "  3. Test: http://localhost:9000/ (landing)"
Write-Host "  4. Commit: git add -A ; git commit -m 'Phase 13: Legacy VMP removed'"
Write-Host ""
Write-Host "To rollback:" -ForegroundColor Yellow
Write-Host "  Move-Item -Path 'server.js.legacy-backup' -Destination 'server.js' -Force"
Write-Host ""

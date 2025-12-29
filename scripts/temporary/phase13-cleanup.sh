#!/bin/bash
# ============================================================================
# Phase 13: Legacy VMP Cleanup Script
# ============================================================================
# Date: 2025-12-27
# Purpose: Remove legacy VMP files after Nexus migration
#
# USAGE:
#   chmod +x scripts/phase13-cleanup.sh
#   ./scripts/phase13-cleanup.sh
#
# WARNING: This script deletes files. Review before running.
# ============================================================================

echo "🧹 Phase 13: Legacy VMP Cleanup"
echo "================================"
echo ""

# --- STEP 1: Backup old server.js ---
echo "📦 Step 1: Backing up server.js..."
if [ -f "server.js" ]; then
    mv server.js server.js.legacy-backup
    echo "   ✅ server.js → server.js.legacy-backup"
fi

# --- STEP 2: Rename server-nexus.js to server.js ---
echo ""
echo "🔄 Step 2: Activating new server..."
if [ -f "server-nexus.js" ]; then
    mv server-nexus.js server.js
    echo "   ✅ server-nexus.js → server.js"
fi

# --- STEP 3: Delete legacy adapters ---
echo ""
echo "🗑️  Step 3: Removing legacy adapters..."
rm -f src/adapters/supabase.js
echo "   ✅ Deleted src/adapters/supabase.js"

# --- STEP 4: Delete legacy routes ---
echo ""
echo "🗑️  Step 4: Removing legacy routes..."
rm -f src/routes/client.js
rm -f src/routes/vendor.js
echo "   ✅ Deleted src/routes/client.js"
echo "   ✅ Deleted src/routes/vendor.js"

# --- STEP 5: Delete legacy templates (keep landing, manifesto) ---
echo ""
echo "🗑️  Step 5: Removing legacy templates..."

# Pages to DELETE (legacy VMP)
LEGACY_PAGES=(
    "accept.html"
    "case-detail.html"
    "case_dashboard.html"
    "case_detail.html"
    "case_template.html"
    "error.html"
    "forgot_password.html"
    "help.html"
    "home.html"
    "invoices.html"
    "invoice_detail.html"
    "invoice_list.html"
    "login.html"
    "new_case.html"
    "notifications.html"
    "ops_access_requests.html"
    "ops_cases.html"
    "ops_case_detail.html"
    "ops_command_center.html"
    "ops_dashboard.html"
    "ops_data_history.html"
    "ops_ingest.html"
    "ops_invite_new.html"
    "ops_ports.html"
    "ops_vendors.html"
    "payments.html"
    "payment_detail.html"
    "payment_history.html"
    "profile.html"
    "reset_password.html"
    "scanner.html"
    "settings.html"
    "sign_up.html"
    "sla_analytics.html"
    "soa_recon.html"
    "supabase_invite_handler.html"
    "supplier_dashboard.html"
    "vendor-dashboard.html"
    "vendor-management.html"
    "403.html"
)

for page in "${LEGACY_PAGES[@]}"; do
    if [ -f "src/views/pages/$page" ]; then
        rm -f "src/views/pages/$page"
        echo "   ✅ Deleted src/views/pages/$page"
    fi
done

# Pages to KEEP (marketing)
echo ""
echo "   📌 KEPT: src/views/pages/landing.html (marketing)"
echo "   📌 KEPT: src/views/pages/manifesto.html (marketing)"

# --- STEP 6: Delete legacy partials ---
echo ""
echo "🗑️  Step 6: Removing legacy partials..."

# Delete all partials except nexus ones
find src/views/partials -name "*.html" -type f 2>/dev/null | while read file; do
    rm -f "$file"
    echo "   ✅ Deleted $file"
done

# --- STEP 7: Delete legacy tests ---
echo ""
echo "🗑️  Step 7: Removing legacy tests..."
rm -f tests/server.test.js
rm -f tests/server-soa-*.test.js
rm -f tests/utils/soa-*.test.js
echo "   ✅ Deleted legacy test files"

# --- STEP 8: Delete legacy utils ---
echo ""
echo "🗑️  Step 8: Removing legacy utils..."
LEGACY_UTILS=(
    "email-parser.js"
    "whatsapp-parser.js"
    "ai-message-parser.js"
    "ai-data-validation.js"
    "ai-search.js"
    "sla-reminders.js"
    "soa-upload-helpers.js"
    "sla-cache.js"
)

for util in "${LEGACY_UTILS[@]}"; do
    if [ -f "src/utils/$util" ]; then
        rm -f "src/utils/$util"
        echo "   ✅ Deleted src/utils/$util"
    fi
done

# --- STEP 9: Delete legacy services ---
echo ""
echo "🗑️  Step 9: Removing legacy services..."
rm -rf src/services/decisions
echo "   ✅ Deleted src/services/decisions/"

# --- STEP 10: Delete desktop client ---
echo ""
echo "🗑️  Step 10: Removing legacy desktop client..."
rm -rf src/views/pages/desktop_client
echo "   ✅ Deleted src/views/pages/desktop_client/"

# --- DONE ---
echo ""
echo "============================================"
echo "✨ Phase 13 Cleanup Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Run: npm run dev"
echo "  2. Test: http://localhost:9000/nexus/login"
echo "  3. Test: http://localhost:9000/ (landing)"
echo "  4. Commit: git add -A && git commit -m 'Phase 13: Legacy VMP removed'"
echo ""
echo "To rollback:"
echo "  mv server.js.legacy-backup server.js"
echo ""

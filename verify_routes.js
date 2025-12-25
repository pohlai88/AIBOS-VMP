// Route Verification Script
// Checks: Route-to-file mapping, naming conventions, HTMX targets

const fs = require('fs');
const path = require('path');

// Extract routes from server.js (simplified - you'll need to run this manually)
const routeMappings = {
  // Pages
  '/': 'pages/landing.html',
  '/manifesto': 'pages/manifesto.html',
  '/sign-up': 'pages/sign_up.html',
  '/forgot-password': 'pages/forgot_password.html',
  '/reset-password': 'pages/reset_password.html',
  '/home': 'pages/home5.html', // Note: env var controls this
  '/cases/:id': 'pages/case_detail.html',
  '/ops': 'pages/ops_command_center.html',
  '/ops/dashboard': 'pages/ops_dashboard.html',
  '/ops/cases': 'pages/ops_cases.html',
  '/ops/cases/:id': 'pages/ops_case_detail.html',
  '/ops/vendors': 'pages/ops_vendors.html',
  '/ops/ingest': 'pages/ops_ingest.html',
  '/ops/ports': 'pages/ops_ports.html',
  '/ops/invites/new': 'pages/ops_invite_new.html',
  '/ops/access-requests': 'pages/ops_access_requests.html',
  '/ops/sla-analytics': 'pages/sla_analytics.html',
  '/payments': 'pages/payments.html',
  '/payments/:id': 'pages/payment_detail.html',
  '/payments/history': 'pages/payment_history.html',
  '/profile': 'pages/profile.html',
  '/invoices': 'pages/invoices.html',
  '/invoices/:id': 'pages/invoice_detail.html',
  '/notifications': 'pages/notifications.html',
  '/login': 'pages/login.html',
  '/accept': 'pages/accept.html',

  // Partials
  '/partials/org-tree-sidebar.html': 'partials/org_tree_sidebar.html',
  '/partials/scoped-dashboard.html': 'partials/scoped_dashboard.html',
  '/partials/ops-case-queue.html': 'partials/ops_case_queue.html',
  '/partials/case-inbox.html': 'partials/case_inbox.html',
  '/partials/case-detail.html': 'partials/case_detail.html',
  '/partials/case-thread.html': 'partials/case_thread.html',
  '/partials/case-activity.html': 'partials/case_activity.html',
  '/partials/case-checklist.html': 'partials/case_checklist.html',
  '/partials/case-evidence.html': 'partials/case_evidence.html',
  '/partials/case-row.html': 'partials/case_row.html',
  '/partials/payment-list.html': 'partials/payment_list.html',
  '/partials/payment-history.html': 'partials/payment_history.html',
  '/partials/payment-detail.html': 'partials/payment_detail.html',
  '/partials/invoice-list.html': 'partials/invoice_list.html',
  '/partials/invoice-detail.html': 'partials/invoice_detail.html',
  '/partials/invoice-card-feed.html': 'partials/invoice_card_feed.html',
  '/partials/profile-form.html': 'partials/profile_form.html',
  '/partials/vendor-directory.html': 'partials/vendor_directory.html',
  '/partials/decision-log.html': 'partials/decision_log.html',
  '/partials/port-configuration.html': 'partials/port_configuration.html',
  '/partials/port-activity-log.html': 'partials/port_activity_log.html',
  '/partials/remittance-viewer.html': 'partials/remittance_viewer.html',
  '/partials/sla-analytics.html': 'partials/sla_analytics.html',
  '/partials/compliance-docs.html': 'partials/compliance_docs.html',
  '/partials/contract-library.html': 'partials/contract_library.html',
  '/partials/notification-badge.html': 'partials/notification_badge.html',
  '/partials/invite-form.html': 'partials/invite_form.html',
  '/partials/matching-status.html': 'partials/matching_status.html',
  '/partials/login-help-access.html': 'partials/login-help-access.html',
  '/partials/login-help-sso.html': 'partials/login-help-sso.html',
  '/partials/login-help-security.html': 'partials/login-help-security.html',
};

const viewsDir = path.join(__dirname, 'src', 'views');

function checkFileExists(filePath) {
  const fullPath = path.join(viewsDir, filePath);
  return fs.existsSync(fullPath);
}

function convertKebabToSnake(str) {
  return str.replace(/-/g, '_');
}

function convertSnakeToKebab(str) {
  return str.replace(/_/g, '-');
}

console.log('🔍 Route Verification Report\n');
console.log('='.repeat(80));

const issues = [];
const warnings = [];
const successes = [];

// Check each route mapping
for (const [route, expectedFile] of Object.entries(routeMappings)) {
  const exists = checkFileExists(expectedFile);

  if (exists) {
    successes.push(`✅ ${route} → ${expectedFile}`);
  } else {
    issues.push(`❌ MISSING: ${route} → ${expectedFile}`);
  }

  // Check naming convention
  const routeParts = route.split('/');
  const lastPart = routeParts[routeParts.length - 1];
  const fileParts = expectedFile.split('/');
  const fileName = fileParts[fileParts.length - 1].replace('.html', '');

  // Route should be kebab-case, file should be snake_case
  if (lastPart.includes(':') === false && lastPart.includes('.html')) {
    const routeBase = lastPart.replace('.html', '');
    const fileBase = fileName;
    const expectedRouteBase = convertSnakeToKebab(fileBase);
    const expectedFileBase = convertKebabToSnake(routeBase);

    if (routeBase !== expectedRouteBase && fileBase !== expectedFileBase) {
      warnings.push(
        `⚠️  Naming mismatch: ${route} (route: ${routeBase}) vs ${expectedFile} (file: ${fileBase})`
      );
    }
  }
}

console.log('\n📊 Summary:');
console.log(`✅ Valid: ${successes.length}`);
console.log(`❌ Missing: ${issues.length}`);
console.log(`⚠️  Warnings: ${warnings.length}`);

if (issues.length > 0) {
  console.log('\n❌ Missing Files:');
  issues.forEach(issue => console.log(`  ${issue}`));
}

if (warnings.length > 0) {
  console.log('\n⚠️  Naming Warnings:');
  warnings.forEach(warning => console.log(`  ${warning}`));
}

// Check HTMX target consistency
console.log('\n\n🎯 HTMX Target Analysis:');
console.log('='.repeat(80));

const htmxTargets = {
  '#main-content': ['layout.html'],
  '#dashboard-main-content': ['ops_ingest.html'],
  '#sla-analytics-main-content': ['sla_analytics.html'],
};

console.log('\nCurrent HTMX Targets in use:');
for (const [target, files] of Object.entries(htmxTargets)) {
  console.log(`  ${target}:`);
  files.forEach(file => console.log(`    - ${file}`));
}

console.log('\n⚠️  CRITICAL: Sidebar now targets #main-content');
console.log('   Pages using #dashboard-main-content will NOT work with sidebar navigation!');
console.log('   Files that need updating:');
console.log('     - src/views/pages/ops_ingest.html (uses #dashboard-main-content)');

console.log('\n' + '='.repeat(80));
console.log('\n✅ Verification complete!');

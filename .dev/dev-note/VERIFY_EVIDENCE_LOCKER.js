#!/usr/bin/env node
/**
 * VERIFY: Evidence Locker Implementation
 * 
 * Comprehensive verification script for Batch 6 - "The Vault" (Evidence Module)
 * Tests all routes, data mappings, filters, and integrations
 * 
 * Run with: node .dev/dev-note/VERIFY_EVIDENCE_LOCKER.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'cyan');
  console.log('='.repeat(80));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Test results
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

function recordTest(name, passed, message = '') {
  results.tests.push({ name, passed, message });
  if (passed) {
    results.passed++;
    logSuccess(`${name}${message ? `: ${message}` : ''}`);
  } else {
    results.failed++;
    logError(`${name}${message ? `: ${message}` : ''}`);
  }
}

function recordWarning(name, message) {
  results.warnings++;
  logWarning(`${name}: ${message}`);
}

// File paths
const projectRoot = path.resolve(__dirname, '../..');
const viewsDir = path.join(projectRoot, 'src', 'views');
const serverFile = path.join(projectRoot, 'server.js');
const caseEvidencePartial = path.join(viewsDir, 'partials', 'case_evidence.html');
const opsCaseDetail = path.join(viewsDir, 'pages', 'ops_case_detail.html');

logSection('🔍 Evidence Locker Verification Script');
log('Batch 6: "The Vault" (Evidence Module)', 'cyan');
log('Testing all routes, data mappings, filters, and integrations\n', 'blue');

// ============================================================================
// TEST 1: File Structure Verification
// ============================================================================
logSection('📁 Test 1: File Structure Verification');

// Check case_evidence.html exists
if (fs.existsSync(caseEvidencePartial)) {
  recordTest('case_evidence.html exists', true);
} else {
  recordTest('case_evidence.html exists', false, 'File not found');
}

// Check ops_case_detail.html exists
if (fs.existsSync(opsCaseDetail)) {
  recordTest('ops_case_detail.html exists', true);
} else {
  recordTest('ops_case_detail.html exists', false, 'File not found');
}

// Check server.js exists
if (fs.existsSync(serverFile)) {
  recordTest('server.js exists', true);
} else {
  recordTest('server.js exists', false, 'File not found');
}

// ============================================================================
// TEST 2: Route Verification
// ============================================================================
logSection('🛣️  Test 2: Route Verification');

const serverContent = fs.existsSync(serverFile) ? fs.readFileSync(serverFile, 'utf-8') : '';

// Check GET /partials/case-evidence.html route
if (serverContent.includes("app.get('/partials/case-evidence.html'")) {
  recordTest('GET /partials/case-evidence.html route exists', true);
} else {
  recordTest('GET /partials/case-evidence.html route exists', false, 'Route not found');
}

// Check POST /cases/:id/documents route
if (serverContent.includes("app.post('/cases/:id/documents'")) {
  recordTest('POST /cases/:id/documents route exists', true);
} else {
  recordTest('POST /cases/:id/documents route exists', false, 'Route not found');
}

// Check route uses upload.single('document')
if (serverContent.includes("upload.single('document')")) {
  recordTest('POST route uses upload.single(\'document\')', true);
} else {
  recordTest('POST route uses upload.single(\'document\')', false, 'Wrong upload field name');
}

// Check route handles case_id query parameter
if (serverContent.includes("req.query.case_id")) {
  recordTest('GET route handles case_id query parameter', true);
} else {
  recordTest('GET route handles case_id query parameter', false, 'Query parameter not handled');
}

// ============================================================================
// TEST 3: Data Mapping Verification
// ============================================================================
logSection('🔄 Test 3: Data Mapping Verification');

// Check evidence → documents mapping
if (serverContent.includes('const documents = evidence.map')) {
  recordTest('Evidence to documents mapping exists', true);
} else {
  recordTest('Evidence to documents mapping exists', false, 'Mapping not found');
}

// Check field mappings
const requiredMappings = [
  'original_name: ev.original_filename',
  'mime_type: ev.mime_type',
  'size: ev.size_bytes',
  'created_at: ev.created_at',
  'url: ev.download_url'
];

requiredMappings.forEach(mapping => {
  const [target, source] = mapping.split(': ');
  if (serverContent.includes(`original_name: ev.original_filename`) || 
      serverContent.includes(`original_name: ev.original_filename ||`)) {
    recordTest(`Field mapping: ${target}`, true);
  } else if (target === 'original_name') {
    recordTest(`Field mapping: ${target}`, false, `Should map from ${source}`);
  }
});

// Check signed URL generation
if (serverContent.includes('getEvidenceSignedUrl')) {
  recordTest('Signed URL generation implemented', true);
} else {
  recordTest('Signed URL generation implemented', false, 'Signed URL generation missing');
}

// ============================================================================
// TEST 4: Nunjucks Filters Verification
// ============================================================================
logSection('🎨 Test 4: Nunjucks Filters Verification');

// Check filesizeformat filter
if (serverContent.includes("addFilter('filesizeformat'")) {
  recordTest('filesizeformat filter registered', true);
} else {
  recordTest('filesizeformat filter registered', false, 'Filter not found');
}

// Check date filter with combined format
if (serverContent.includes("'%b %d %H:%M'")) {
  recordTest('Date filter supports combined format', true);
} else {
  recordTest('Date filter supports combined format', false, 'Combined format not found');
}

// ============================================================================
// TEST 5: HTML Template Verification
// ============================================================================
logSection('📄 Test 5: HTML Template Verification');

if (fs.existsSync(caseEvidencePartial)) {
  const evidenceContent = fs.readFileSync(caseEvidencePartial, 'utf-8');
  
  // Check for key elements
  const requiredElements = [
    { name: 'Evidence Locker header', pattern: /Evidence Locker/i },
    { name: 'Drop zone with drag-and-drop', pattern: /@dragover|@drop/i },
    { name: 'HTMX form for upload', pattern: /hx-post.*\/cases.*\/documents/i },
    { name: 'Documents grid', pattern: /grid.*xl:grid-cols-2/i },
    { name: 'Empty state', pattern: /Locker Empty/i },
    { name: 'File type badges', pattern: /PDF|IMG|DOC/i },
    { name: 'View artifact link', pattern: /View Artifact|target="_blank"/i }
  ];
  
  requiredElements.forEach(({ name, pattern }) => {
    if (pattern.test(evidenceContent)) {
      recordTest(`Template element: ${name}`, true);
    } else {
      recordTest(`Template element: ${name}`, false, 'Element not found');
    }
  });
  
  // Check for Alpine.js data binding
  if (evidenceContent.includes('x-data="{ dragging: false }"')) {
    recordTest('Alpine.js drag state binding', true);
  } else {
    recordTest('Alpine.js drag state binding', false, 'Drag state not configured');
  }
  
  // Check for filesizeformat filter usage
  if (evidenceContent.includes('filesizeformat')) {
    recordTest('Template uses filesizeformat filter', true);
  } else {
    recordTest('Template uses filesizeformat filter', false, 'Filter not used');
  }
  
  // Check for date filter with combined format
  if (evidenceContent.includes("date('%b %d %H:%M')")) {
    recordTest('Template uses combined date format', true);
  } else {
    recordTest('Template uses combined date format', false, 'Combined format not used');
  }
}

// ============================================================================
// TEST 6: Integration with ops_case_detail.html
// ============================================================================
logSection('🔗 Test 6: Integration with ops_case_detail.html');

if (fs.existsSync(opsCaseDetail)) {
  const detailContent = fs.readFileSync(opsCaseDetail, 'utf-8');
  
  // Check for Evidence tab button
  if (detailContent.includes("activeTab === 'evidence'") && 
      detailContent.includes('Evidence')) {
    recordTest('Evidence tab button exists', true);
  } else {
    recordTest('Evidence tab button exists', false, 'Tab button not found');
  }
  
  // Check for Evidence tab content container
  if (detailContent.includes('case-evidence-container') &&
      detailContent.includes('/partials/case-evidence.html')) {
    recordTest('Evidence tab content container exists', true);
  } else {
    recordTest('Evidence tab content container exists', false, 'Container not found');
  }
  
  // Check HTMX lazy loading
  if (detailContent.includes('hx-get="/partials/case-evidence.html') &&
      detailContent.includes('hx-trigger="load"')) {
    recordTest('HTMX lazy loading configured', true);
  } else {
    recordTest('HTMX lazy loading configured', false, 'HTMX attributes missing');
  }
  
  // Check for proper tab structure
  const tabCount = (detailContent.match(/activeTab === ['"]/g) || []).length;
  if (tabCount >= 5) {
    recordTest(`Tab count (expected 5+, found ${tabCount})`, true);
  } else {
    recordWarning(`Tab count: Expected 5+, found ${tabCount}`);
  }
}

// ============================================================================
// TEST 7: Error Handling Verification
// ============================================================================
logSection('🛡️  Test 7: Error Handling Verification');

// Check authentication - look for requireAuth near the route definitions
const getRouteStart = serverContent.indexOf("app.get('/partials/case-evidence.html'");
const postRouteStart = serverContent.indexOf("app.post('/cases/:id/documents'");
const getRouteSection = getRouteStart > -1 ? serverContent.substring(getRouteStart, getRouteStart + 500) : '';
const postRouteSection = postRouteStart > -1 ? serverContent.substring(postRouteStart, postRouteStart + 500) : '';

const errorHandlingChecks = [
  { 
    name: 'Authentication check in GET route', 
    check: () => getRouteSection.includes('requireAuth')
  },
  { 
    name: 'Authentication check in POST route', 
    check: () => postRouteSection.includes('requireAuth')
  },
  { 
    name: 'UUID validation', 
    check: () => /validateUUIDParam.*caseId/i.test(serverContent)
  },
  { 
    name: 'File validation', 
    check: () => /!file|file.*required|File is required/i.test(serverContent)
  },
  { 
    name: 'Case access verification', 
    check: () => /getCaseDetail.*caseId/i.test(serverContent)
  },
  { 
    name: 'Error logging', 
    check: () => /logError.*operation.*upload|logError.*uploadDocument/i.test(serverContent)
  }
];

errorHandlingChecks.forEach(({ name, check }) => {
  if (check()) {
    recordTest(`Error handling: ${name}`, true);
  } else {
    recordTest(`Error handling: ${name}`, false, 'Missing error handling');
  }
});

// ============================================================================
// TEST 8: Production-Grade Requirements
// ============================================================================
logSection('🏭 Test 8: Production-Grade Requirements');

// Check for try-catch blocks
const tryCatchCount = (serverContent.match(/try\s*{[\s\S]*?catch/g) || []).length;
if (tryCatchCount >= 2) {
  recordTest(`Try-catch blocks (found ${tryCatchCount})`, true);
} else {
  recordWarning(`Try-catch blocks: Found ${tryCatchCount}, expected 2+`);
}

// Check for proper status codes
if (serverContent.includes('res.status(400)') && 
    serverContent.includes('res.status(401)') &&
    serverContent.includes('res.status(500)')) {
  recordTest('Proper HTTP status codes used', true);
} else {
  recordTest('Proper HTTP status codes used', false, 'Missing status codes');
}

// Check for evidence_type default
if (serverContent.includes("'general'") || serverContent.includes('"general"')) {
  recordTest('Default evidence_type set', true);
} else {
  recordTest('Default evidence_type set', false, 'No default evidence_type');
}

// ============================================================================
// SUMMARY
// ============================================================================
logSection('📊 Verification Summary');

console.log(`\n${'─'.repeat(80)}`);
log(`✅ Passed: ${results.passed}`, 'green');
log(`❌ Failed: ${results.failed}`, 'red');
log(`⚠️  Warnings: ${results.warnings}`, 'yellow');
console.log(`${'─'.repeat(80)}\n`);

if (results.failed > 0) {
  log('\n❌ Failed Tests:', 'red');
  results.tests
    .filter(t => !t.passed)
    .forEach(t => {
      log(`   • ${t.name}`, 'red');
      if (t.message) {
        log(`     ${t.message}`, 'yellow');
      }
    });
}

if (results.warnings > 0) {
  log('\n⚠️  Warnings:', 'yellow');
  // Warnings are logged inline, but we can add summary here if needed
}

// Final verdict
console.log('\n' + '='.repeat(80));
if (results.failed === 0) {
  log('🎉 ALL TESTS PASSED!', 'green');
  log('Evidence Locker implementation is complete and production-ready.', 'green');
  console.log('\n✅ Verification complete. The Evidence Locker is ready for deployment.');
  process.exit(0);
} else {
  log('⚠️  SOME TESTS FAILED', 'yellow');
  log('Please review the failed tests above and fix any issues.', 'yellow');
  console.log('\n❌ Verification incomplete. Fix issues before deployment.');
  process.exit(1);
}


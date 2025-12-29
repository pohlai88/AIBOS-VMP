#!/usr/bin/env node

/**
 * No-Drift Audit Script
 * 
 * Runs the 8 concrete audit queries to detect drift from PRD/CCP + template doctrine.
 * 
 * Usage:
 *   node scripts/audit/no-drift-audit.mjs
 * 
 * Exit codes:
 *   0 = No drift detected
 *   1 = Drift detected (see output)
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

process.chdir(projectRoot);

const results = {
  passed: [],
  failed: [],
  warnings: []
};

function runQuery(name, command, expected = 'no matches') {
  console.log(`\n🔍 ${name}...`);
  try {
    const output = execSync(command, { encoding: 'utf-8', cwd: projectRoot });
    const lines = output.trim().split('\n').filter(l => l);
    
    if (lines.length === 0 || (expected === 'no matches' && lines.length === 0)) {
      console.log(`  ✅ PASS: ${expected}`);
      results.passed.push(name);
      return true;
    } else {
      console.log(`  ⚠️  FOUND ${lines.length} match(es):`);
      lines.slice(0, 5).forEach(line => console.log(`     ${line}`));
      if (lines.length > 5) {
        console.log(`     ... and ${lines.length - 5} more`);
      }
      
      // Check if matches are acceptable
      const acceptablePatterns = [
        /nexus-circuit-breaker\.js.*comment/i,
        /nexus_sessions.*\.eq\(['"]id['"]/i,
        /supabase\.js.*legacy/i,
        /template\.js/i,
        /example\.js/i
      ];
      
      const allAcceptable = lines.every(line => 
        acceptablePatterns.some(pattern => pattern.test(line))
      );
      
      if (allAcceptable) {
        console.log(`  ✅ ACCEPTABLE: Matches are in legacy/template/example code`);
        results.passed.push(name);
        return true;
      } else {
        console.log(`  ❌ FAIL: Unexpected matches found`);
        results.failed.push(name);
        return false;
      }
    }
  } catch (error) {
    if (error.status === 1 && expected === 'no matches') {
      // ripgrep returns exit code 1 when no matches found - this is success
      console.log(`  ✅ PASS: No matches found`);
      results.passed.push(name);
      return true;
    } else {
      console.log(`  ❌ ERROR: ${error.message}`);
      results.failed.push(name);
      return false;
    }
  }
}

console.log('═══════════════════════════════════════════════════════════');
console.log('  No-Drift Audit: PRD/CCP + Template Doctrine Compliance');
console.log('═══════════════════════════════════════════════════════════');

// Query 1: Direct Supabase calls outside adapter/service
runQuery(
  'Direct Supabase calls outside adapter/service',
  'rg -n "supabase\\.from\\(" src/ | rg -v "nexus-adapter|services|base-repository" || true',
  'no matches (or only in comments/examples)'
);

// Query 2: Hardcoded .eq("id", ...) (PK drift check)
runQuery(
  'Hardcoded .eq("id", ...) usage',
  'rg -n "\\.eq\\(\\s*[\'\\"]id[\'\\"]" src/ | rg -v "tests" || true',
  'only in non-CRUD-S tables or legacy code'
);

// Query 3: @ts-ignore containment
runQuery(
  '@ts-ignore containment',
  'rg -n "@ts-ignore" src/ || true',
  'only in adapter boundary (nexus-adapter.js)'
);

// Query 4: Public URL leakage
runQuery(
  'Public URL leakage (getPublicUrl)',
  'rg -n "getPublicUrl|publicUrl|storage\\.from\\(.+\\).getPublicUrl" src/ || true',
  'no matches'
);

// Query 5: IMEI leakage
runQuery(
  'IMEI leakage check',
  'rg -n "imei" src/ -i || true',
  'no matches'
);

// Query 6: CRUD-S registry enforcement
runQuery(
  'CRUD-S registry enforcement',
  'rg -n "SOFT_DELETE_CAPABLE|softDeleteEntity|restoreEntity" src/ || true',
  'registry and enforcement functions found'
);

// Query 7: Signed URL usage
runQuery(
  'Signed URL usage (createSignedUrl)',
  'rg -n "createSignedUrl|createSignedDownloadUrl|createSignedUploadUrl" src/ || true',
  'signed URL helpers found'
);

// Query 8: Legacy vmpAdapter usage
runQuery(
  'Legacy vmpAdapter usage',
  'rg -n "vmpAdapter" src/ | rg -v "supabase\\.js|deprecated" || true',
  'only in deprecated compatibility layer'
);

// Summary
console.log('\n═══════════════════════════════════════════════════════════');
console.log('  Summary');
console.log('═══════════════════════════════════════════════════════════');
console.log(`✅ Passed: ${results.passed.length}`);
console.log(`❌ Failed: ${results.failed.length}`);
console.log(`⚠️  Warnings: ${results.warnings.length}`);

// CI-friendly single score line
let scoreLine;
if (results.failed.length > 0) {
  scoreLine = `NO_DRIFT: FAIL (${results.failed.length} boundary violations)`;
  console.log(`\n${scoreLine}`);
  console.log('\n❌ DRIFT DETECTED:');
  results.failed.forEach(name => console.log(`   - ${name}`));
  process.exit(1);
} else if (results.warnings.length > 0) {
  scoreLine = `NO_DRIFT: WARN (${results.warnings.length} legacy references only)`;
  console.log(`\n${scoreLine}`);
  console.log('\n⚠️  Legacy references found (acceptable, but should be migrated):');
  results.warnings.forEach(name => console.log(`   - ${name}`));
  process.exit(0);
} else {
  scoreLine = `NO_DRIFT: PASS (0 findings)`;
  console.log(`\n${scoreLine}`);
  console.log('\n✅ NO DRIFT DETECTED - Codebase aligned with PRD/CCP + template doctrine');
  process.exit(0);
}


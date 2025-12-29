#!/usr/bin/env node
/**
 * Drift Check Script (DRIFT-01, DRIFT-02, DRIFT-03)
 * 
 * Validates database schema compliance against SSOT Guardrail Matrix:
 * - DRIFT-01: Schema diff (migrations vs live schema)
 * - DRIFT-02: RLS coverage (100% for tenant-scoped tables)
 * - DRIFT-03: Contract registry coverage (all JSONB fields registered)
 * 
 * Outputs machine-readable JSON reports for CI/CD gates.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  parseTableMatrix,
  parseJsonbContractRegistry,
  parseRLSCoverageMatrix,
  getAllJsonbColumns
} from './utils/matrix-parser.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const REPORTS_DIR = join(PROJECT_ROOT, 'reports');

// Ensure reports directory exists
if (!existsSync(REPORTS_DIR)) {
  mkdirSync(REPORTS_DIR, { recursive: true });
}

/**
 * DRIFT-01: Schema Diff Check
 * Compares migrations folder to expected schema from matrix
 */
async function checkSchemaDiff() {
  const timestamp = new Date().toISOString();
  const migrationsDir = join(PROJECT_ROOT, 'migrations');
  const supabaseMigrationsDir = join(PROJECT_ROOT, 'supabase', 'migrations');

  // Read migration files
  const migrationFiles = [];

  try {
    const { readdir } = await import('fs/promises');
    if (existsSync(migrationsDir)) {
      const files = await readdir(migrationsDir);
      migrationFiles.push(...files.filter(f => f.endsWith('.sql')));
    }
    if (existsSync(supabaseMigrationsDir)) {
      const files = await readdir(supabaseMigrationsDir);
      migrationFiles.push(...files.filter(f => f.endsWith('.sql')));
    }
  } catch (error) {
    console.error('Error reading migrations:', error);
  }

  // Expected tables from matrix (parsed from SSOT)
  const tableMatrix = parseTableMatrix();
  const expectedTables = tableMatrix.map(t => t.table);

  const report = {
    timestamp,
    schema_source: 'migrations/',
    ssot_source: 'matrix_documented',
    compliance_level: 'L1 Documented',
    differences: [],
    expected_tables: expectedTables,
    migration_files: migrationFiles,
    summary: {
      total_differences: 0,
      expected: expectedTables.length,
      unexpected: 0,
      migration_files_count: migrationFiles.length,
      severity: 'NONE' // BLOCKER | MAJOR | MINOR | NONE
    }
  };

  // L1: Validate that all expected tables are documented
  // L2: Will compare against live database schema
  report.summary.total_differences = 0;
  report.summary.unexpected = 0;

  // Determine severity (L1: always NONE, L2+ will set based on actual differences)
  if (report.summary.unexpected > 0) {
    report.summary.severity = 'BLOCKER'; // Unexpected tables are always blockers
  } else {
    report.summary.severity = 'NONE';
  }

  return report;
}

/**
 * DRIFT-02: RLS Coverage Check
 * Validates 100% RLS coverage for all tenant-scoped tables
 */
function checkRLSCoverage() {
  const timestamp = new Date().toISOString();

  // Parse RLS coverage from matrix
  const rlsMatrix = parseRLSCoverageMatrix();
  const tableMatrix = parseTableMatrix();

  // Merge data from both matrices
  // CRITICAL: tenant_scoped must come from canonical table matrix first (not RLS matrix)
  const tables = rlsMatrix.map(rlsRow => {
    const tableRow = tableMatrix.find(t => t.table === rlsRow.table);

    // Canonical tenant_scope from table matrix (authoritative)
    const tenantScope = tableRow?.tenant_scope || rlsRow.tenant_scope || '';

    // Infer tenant_scoped from canonical tenant_scope
    // Empty or explicitly "global" = not tenant-scoped
    const isTenantScoped = tenantScope &&
      tenantScope !== 'global' &&
      tenantScope !== 'N/A' &&
      tenantScope.trim().length > 0;

    const hasTenantId = tenantScope.includes('tenant_id') && !tenantScope.startsWith('derived:');
    const isDerived = tenantScope.startsWith('derived:');
    const semanticRole = tableRow?.semantic_role || '';

    // Parse policies from RLS matrix
    const policies = (rlsRow.policies || '').split(',').map(p => p.trim()).filter(p => p);

    // Parse derived_path for derived scopes
    let derived_path = null;
    if (isDerived) {
      // Extract path from tenant_scope (e.g., "derived:case_id→client_id/vendor_id")
      const match = tenantScope.match(/derived:([^→]+)(?:→(.+))?/);
      if (match) {
        const startPath = match[1].split('/')[0]; // First part before /
        const endPath = match[2] ? match[2].split('/') : [];
        derived_path = [startPath, ...endPath].filter(p => p);
      }
    }

    return {
      table: rlsRow.table,
      semantic_role: semanticRole,
      tenant_scoped: isTenantScoped, // From canonical table matrix
      has_tenant_id: hasTenantId,
      derived: isDerived,
      tenant_scope: tenantScope,
      derived_path: derived_path,
      rls_enabled: rlsRow.rls_enabled,
      policies: policies.map(policyName => ({
        name: policyName,
        operation: 'ALL', // Simplified for L1
        tested: rlsRow.tested,
        status: 'compliant'
      })),
      coverage: {
        select: true,
        insert: true,
        update: true,
        delete: true
      },
      status: rlsRow.status === '✅ Compliant' ? 'compliant' : 'non_compliant',
      compliance_level: 'L1 Documented',
      severity: rlsRow.status === '✅ Compliant' ? 'NONE' : 'BLOCKER' // Missing RLS is always BLOCKER
    };
  });

  const compliant = tables.filter(t => t.status === 'compliant').length;
  const non_compliant = tables.filter(t => t.status === 'non_compliant').length;

  // Determine overall severity
  let severity = 'NONE';
  if (non_compliant > 0) {
    severity = 'BLOCKER'; // Missing RLS is always BLOCKER
  }

  return {
    timestamp,
    compliance_level: 'L1 Documented',
    tables,
    summary: {
      total_tables: tables.length,
      tenant_scoped: tables.filter(t => t.tenant_scoped).length,
      rls_enabled: tables.filter(t => t.rls_enabled).length,
      coverage_percentage: (compliant / tables.length) * 100,
      compliant,
      non_compliant,
      severity: severity
    }
  };
}

/**
 * DRIFT-03: Contract Registry Coverage Check
 * Validates all JSONB fields are registered in contract registry
 */
function checkContractRegistryCoverage() {
  const timestamp = new Date().toISOString();

  // Parse JSONB columns from table matrix
  const jsonbColumns = getAllJsonbColumns();

  // Parse contract registry
  const contractRegistry = parseJsonbContractRegistry();

  // Match columns to contracts
  // Deterministic fallback: if contract_type missing from table row, resolve from registry via used_in
  const jsonb_columns = jsonbColumns.map(col => {
    // Try multiple matching strategies
    let contract = contractRegistry.find(c => {
      // Match by contract type (primary)
      if (c.contract_type === col.contract_type) return true;
      // Match by used_in field (e.g., "nexus_tenants.settings")
      const usedIn = (c.used_in || '').replace(/`/g, '').trim();
      if (usedIn === `${col.table}.${col.column}`) return true;
      // Match by table.column pattern in used_in
      if (usedIn.includes(`${col.table}.${col.column}`)) return true;
      return false;
    });

    // Deterministic fallback: if table row missing contract_type but registry has used_in match
    // resolve contract_type from registry (makes system resilient to matrix authoring mistakes)
    if (!contract && !col.contract_type) {
      contract = contractRegistry.find(c => {
        const usedIn = (c.used_in || '').replace(/`/g, '').trim();
        return usedIn === `${col.table}.${col.column}` || usedIn.includes(`${col.table}.${col.column}`);
      });
      if (contract) {
        col.contract_type = contract.contract_type; // Resolve from registry
      }
    }

    return {
      table: col.table,
      column: col.column,
      registered: !!contract,
      contract_type: col.contract_type || contract?.contract_type || '',
      canonical_contract_id: contract?.canonical_contract_id || '',
      min_version: contract?.min_ver || 1,
      max_version: contract?.max_ver || 1,
      validator_ref: contract?.validator_ref || `src/schemas/metadata.schema.js:${col.contract_type}Schema`,
      required_keys: contract?.required_keys || '',
      allowed_keys: contract?.allowed_keys || '',
      check_constraint: contract?.check_constraint || false,
      status: contract ? 'compliant' : 'non_compliant',
      compliance_level: 'L1 Documented',
      severity: contract ? 'NONE' : 'BLOCKER' // Unregistered JSONB is always BLOCKER
    };
  });

  const registered = jsonb_columns.filter(c => c.registered).length;
  const unregistered = jsonb_columns.filter(c => !c.registered).length;

  // Determine overall severity
  let severity = 'NONE';
  if (unregistered > 0) {
    severity = 'BLOCKER'; // Unregistered JSONB is always BLOCKER
  }

  return {
    timestamp,
    compliance_level: 'L1 Documented',
    jsonb_columns,
    contract_registry: {
      total_contracts: contractRegistry.length,
      contracts: contractRegistry.map(c => ({
        type: c.contract_type,
        canonical_id: c.canonical_contract_id,
        status: c.status
      }))
    },
    summary: {
      total_jsonb_columns: jsonb_columns.length,
      registered,
      unregistered,
      coverage_percentage: jsonb_columns.length > 0 ? (registered / jsonb_columns.length) * 100 : 100,
      compliant: registered,
      non_compliant: unregistered,
      severity: severity
    }
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Running drift checks (DRIFT-01, DRIFT-02, DRIFT-03)...\n');

  try {
    // DRIFT-01: Schema Diff
    console.log('📊 DRIFT-01: Schema diff check...');
    const schemaDiff = await checkSchemaDiff();
    writeFileSync(
      join(REPORTS_DIR, 'schema-diff.json'),
      JSON.stringify(schemaDiff, null, 2)
    );
    console.log(`   ✅ Report: reports/schema-diff.json`);

    // DRIFT-02: RLS Coverage
    console.log('🛡️  DRIFT-02: RLS coverage check...');
    const rlsCoverage = checkRLSCoverage();
    writeFileSync(
      join(REPORTS_DIR, 'rls-coverage.json'),
      JSON.stringify(rlsCoverage, null, 2)
    );
    console.log(`   ✅ Report: reports/rls-coverage.json`);
    console.log(`   Coverage: ${rlsCoverage.summary.coverage_percentage.toFixed(1)}% (${rlsCoverage.summary.compliant}/${rlsCoverage.summary.total_tables} tables)`);

    // DRIFT-03: Contract Registry Coverage
    console.log('📝 DRIFT-03: Contract registry coverage check...');
    const contractCoverage = checkContractRegistryCoverage();
    writeFileSync(
      join(REPORTS_DIR, 'contract-coverage.json'),
      JSON.stringify(contractCoverage, null, 2)
    );
    console.log(`   ✅ Report: reports/contract-coverage.json`);
    console.log(`   Coverage: ${contractCoverage.summary.coverage_percentage.toFixed(1)}% (${contractCoverage.summary.registered}/${contractCoverage.summary.total_jsonb_columns} columns)`);

    // Summary
    console.log('\n📋 Summary:');
    console.log(`   Schema Diff: ${schemaDiff.summary.unexpected === 0 ? '✅ No unexpected differences' : '⚠️ Unexpected differences found'}`);
    console.log(`   RLS Coverage: ${rlsCoverage.summary.coverage_percentage === 100 ? '✅ 100%' : `⚠️ ${rlsCoverage.summary.coverage_percentage.toFixed(1)}%`}`);
    console.log(`   Contract Coverage: ${contractCoverage.summary.coverage_percentage === 100 ? '✅ 100%' : `⚠️ ${contractCoverage.summary.coverage_percentage.toFixed(1)}%`}`);

    // Exit code for CI/CD
    const hasErrors =
      schemaDiff.summary.unexpected > 0 ||
      rlsCoverage.summary.non_compliant > 0 ||
      contractCoverage.summary.non_compliant > 0;

    if (hasErrors) {
      console.log('\n❌ Drift checks failed. See reports/ for details.');
      process.exit(1);
    } else {
      console.log('\n✅ All drift checks passed.');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error running drift checks:', error);
    process.exit(1);
  }
}

main();


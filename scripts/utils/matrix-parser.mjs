#!/usr/bin/env node
/**
 * Matrix Parser Utility
 * 
 * Parses SSOT Guardrail Matrix markdown files to extract structured data:
 * - Table Guardrail Matrix (Section A)
 * - JSONB Contract Registry (Section B)
 * - RLS Coverage Matrix (Section D)
 * 
 * Used by drift check script to validate against documented expectations.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

/**
 * Parse markdown table row into object
 */
function parseTableRow(row, headers) {
    const cells = row.split('|').map(c => c.trim()).filter(c => c);
    if (cells.length !== headers.length) return null;

    const obj = {};
    headers.forEach((header, idx) => {
        let value = cells[idx] || '';
        // Remove markdown formatting (backticks, links, etc.)
        value = value
            .replace(/^`+|`+$/g, '') // Remove backticks
            .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove markdown links, keep text
            .trim();
        obj[header] = value;
    });
    return obj;
}

/**
 * Extract table data from markdown
 * 
 * Known section headers for safe boundary detection:
 * - A) Table Guardrail Matrix
 * - B) JSONB Contract Registry Matrix
 * - C) Promotion Matrix
 * - D) RLS Coverage Matrix
 * - E) Drift Checks Matrix
 */
const KNOWN_SECTIONS = [
    'A) Table Guardrail Matrix',
    'B) JSONB Contract Registry Matrix',
    'C) Promotion Matrix',
    'D) RLS Coverage Matrix',
    'E) Drift Checks Matrix'
];

function extractTableFromMarkdown(content, sectionHeader) {
    const lines = content.split('\n');
    let inSection = false;
    let headers = [];
    const rows = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check if we're entering the section
        if (line.includes(sectionHeader) && (line.startsWith('#') || line.startsWith('##'))) {
            inSection = true;
            continue;
        }

        // Check if we're leaving the section (next known section header only)
        // This prevents premature exit on H1 headings that aren't section boundaries
        if (inSection) {
            // Check if this is a known section header (not our current section)
            const isNextKnownSection = KNOWN_SECTIONS.some(knownSection => 
                knownSection !== sectionHeader && 
                line.includes(knownSection) && 
                (line.startsWith('#') || line.startsWith('##'))
            );
            if (isNextKnownSection) {
                break;
            }
        }

        if (!inSection) continue;

        // Find table header row (starts with |)
        if (line.startsWith('|') && headers.length === 0) {
            headers = line.split('|')
                .map(h => h.trim())
                .filter(h => h && !h.match(/^[-:]+$/))
                .map(h => h.toLowerCase().replace(/\s+/g, '_'));
            continue;
        }

        // Find separator row (skip it)
        if (line.match(/^\|[\s\-:]+$/)) continue;

        // Parse data rows
        if (line.startsWith('|') && headers.length > 0) {
            const row = parseTableRow(line, headers);
            if (row && Object.keys(row).length > 0) {
                rows.push(row);
            }
        }
    }

    return { headers, rows };
}

/**
 * Parse Table Guardrail Matrix (Section A)
 */
export function parseTableMatrix() {
    const matrixPath = join(PROJECT_ROOT, 'docs', 'ssot', 'db', 'DB_GUARDRAIL_MATRIX.md');
    const content = readFileSync(matrixPath, 'utf-8');

    const { rows } = extractTableFromMarkdown(content, 'A) Table Guardrail Matrix');

    return rows.map(row => {
        const tableName = (row.table || '').replace(/`/g, '').trim();
        return {
            table: tableName,
            purpose: row.purpose || '',
            semantic_role: row['semantic_role'] || '',
            tenant_scope: row.tenant_scope || '',
            derived_scope_proof: row.derived_scope_proof || '',
            core_columns: row['core_columns_(immutable)'] || '',
            jsonb_columns: row['jsonb_columns'] || '',
            jsonb_contract_types: row['jsonb_contract_types_(registered)'] || '',
            rls_policy_id: row['rls_policy_id'] || '',
            index_requirements: row['index_requirements'] || '',
            index_justification_link: row['index_justification_link'] || '',
            promotion_candidates: row['promotion_candidates'] || '',
            adapter_owner: row['adapter_owner'] || '',
            validator_owner: row['validator_owner'] || '',
            test_coverage: row['test_coverage'] || '',
            compliance_level: row['compliance_level'] || '',
            drift_status: row['drift_status'] || ''
        };
    }).filter(row => row.table && row.table.startsWith('nexus_'));
}

/**
 * Parse JSONB Contract Registry (Section B)
 */
export function parseJsonbContractRegistry() {
    const matrixPath = join(PROJECT_ROOT, 'docs', 'ssot', 'db', 'DB_GUARDRAIL_MATRIX.md');
    const content = readFileSync(matrixPath, 'utf-8');

    const { rows } = extractTableFromMarkdown(content, 'B) JSONB Contract Registry Matrix');

    return rows.map(row => ({
        contract_type: row['contract_type_(`type`)'] || row.contract_type || '',
        canonical_contract_id: row['canonical_contract_id'] || '',
        used_in: row['used_in_(tables.columns)'] || '',
        min_ver: parseInt(row['min_ver'] || row.min_ver || '1', 10),
        max_ver: parseInt(row['max_ver'] || row.max_ver || '1', 10),
        validator_ref: row['validator_ref_(zod)'] || row.validator_ref || '',
        required_keys: row['required_keys'] || '',
        allowed_keys: row['allowed_keys'] || '',
        check_constraint: row['check_constraint?'] === 'Yes' || row.check_constraint === 'Yes',
        index_keys_allowed: row['index_keys_allowed'] || '',
        migration_notes: row['migration_notes'] || '',
        owner: row.owner || '',
        status: row.status || ''
    })).filter(row => row.contract_type);
}

/**
 * Parse RLS Coverage Matrix (Section D)
 */
export function parseRLSCoverageMatrix() {
    const matrixPath = join(PROJECT_ROOT, 'docs', 'ssot', 'db', 'DB_GUARDRAIL_MATRIX.md');
    const content = readFileSync(matrixPath, 'utf-8');

    const { rows } = extractTableFromMarkdown(content, 'D) RLS Coverage Matrix');

    return rows.map(row => {
        const tableName = (row.table || '').replace(/`/g, '').trim();
        const policies = (row['policies_(ids)'] || '')
            .replace(/`/g, '')
            .split(',')
            .map(p => p.trim())
            .filter(p => p);

        return {
            table: tableName,
            tenant_scope: (row['tenant_scope'] || '').replace(/`/g, '').trim(),
            rls_enabled: row['rls_enabled'] === 'Yes' || row['rls_enabled'] === '✅ Yes',
            policies: policies.join(', '),
            roles_covered: row['roles_covered'] || '',
            tested: row['tested_(integration)'] === 'Yes' || row['tested_(integration)'] === '✅ Yes',
            notes: row.notes || '',
            status: row.status || ''
        };
    }).filter(row => row.table && row.table.startsWith('nexus_'));
}

/**
 * Get all JSONB columns from table matrix
 */
export function getAllJsonbColumns() {
    const tables = parseTableMatrix();
    const jsonbColumns = [];

    tables.forEach(table => {
        if (!table.jsonb_columns || table.jsonb_columns === 'None') return;

        // Clean and split columns
        const columns = table.jsonb_columns
            .replace(/`/g, '') // Remove backticks
            .split(',')
            .map(c => c.trim())
            .filter(c => c);

        // Clean and split contract types
        const contractTypes = (table.jsonb_contract_types || '')
            .replace(/`/g, '') // Remove backticks
            .split(',')
            .map(c => c.trim())
            .filter(c => c);

        columns.forEach((column, idx) => {
            if (column) {
                jsonbColumns.push({
                    table: table.table.replace(/`/g, ''), // Clean table name
                    column: column,
                    contract_type: contractTypes[idx] || ''
                });
            }
        });
    });

    return jsonbColumns;
}


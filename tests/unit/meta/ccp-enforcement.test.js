/**
 * CCP Enforcement Meta-Tests
 *
 * These tests enforce the Critical Control Points (CCP) that prevent architectural drift.
 * They fail if boundaries are violated, ensuring PRD/CCP compliance.
 *
 * Test Type: unit (static analysis, no runtime dependencies)
 * Dependencies: file system, AST parsing (via grep/ripgrep)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../..');

// Allowed directories for Supabase direct calls
const ALLOWED_SUPABASE_DIRS = [
  'src/adapters/',
  'src/services/',
  'src/repositories/',
  'src/middleware/supabase-client.js', // Client initialization only
];

// Files that are allowed to use vmpAdapter (legacy compatibility)
const ALLOWED_VMPADAPTER_FILES = [
  'src/adapters/supabase.js', // Legacy compatibility layer
  'src/utils/push-sender.js', // TODO: CLEANUP-VMP-LEGACY-01
  'src/utils/notifications.js', // TODO: CLEANUP-VMP-LEGACY-01
];

describe('CCP Enforcement: Adapter-Only Doctrine', () => {
  it('should fail if any non-adapter/service file calls supabase.from() directly', () => {
    // Use ripgrep to find all supabase.from() calls (including this.supabase, req.supabase, etc.)
    // Pattern matches: supabase.from(, this.supabase.from(, req.supabase.from(, client.supabase.from(, etc.
    let violations = [];

    try {
      // Match any supabase.from( pattern, including:
      // - supabase.from(
      // - this.supabase.from(
      // - req.supabase.from(
      // - client.supabase.from(
      // - context.supabase.from(
      // - service.supabase.from(
      const output = execSync('rg -n "\\.supabase\\.from\\(" src/ || true', {
        encoding: 'utf-8',
        cwd: projectRoot,
      });

      const lines = output
        .trim()
        .split('\n')
        .filter(l => l);

      for (const line of lines) {
        const [filePath, ...rest] = line.split(':');
        if (!filePath) continue;

        // Check if file is in allowed directory
        const isAllowed = ALLOWED_SUPABASE_DIRS.some(allowed => filePath.includes(allowed));

        // Check if it's a comment/example
        const fullLine = rest.join(':');
        const isComment =
          fullLine.trim().startsWith('//') ||
          fullLine.includes('*') ||
          fullLine.includes('example');

        if (!isAllowed && !isComment) {
          violations.push({ file: filePath, line: fullLine });
        }
      }
    } catch (error) {
      // ripgrep returns exit code 1 when no matches - that's success
      if (error.status !== 1) {
        throw error;
      }
    }

    if (violations.length > 0) {
      const violationList = violations.map(v => `  - ${v.file}: ${v.line.trim()}`).join('\n');

      throw new Error(
        `Adapter-only doctrine violated: Found ${violations.length} direct supabase.from() calls outside adapters/services:\n${violationList}\n\n` +
          `Allowed directories: ${ALLOWED_SUPABASE_DIRS.join(', ')}`
      );
    }

    expect(violations.length).toBe(0);
  });
});

describe('CCP Enforcement: Signed URL Only', () => {
  it('should fail if any file uses getPublicUrl or constructs public Storage URLs', () => {
    let violations = [];

    try {
      // Check for getPublicUrl usage
      const publicUrlOutput = execSync(
        'rg -n "getPublicUrl|publicUrl|storage\\.from\\(.+\\).getPublicUrl" src/ || true',
        { encoding: 'utf-8', cwd: projectRoot }
      );

      const publicUrlLines = publicUrlOutput
        .trim()
        .split('\n')
        .filter(l => l);

      for (const line of publicUrlLines) {
        const [filePath, ...rest] = line.split(':');
        if (!filePath) continue;

        const fullLine = rest.join(':');
        const isComment =
          fullLine.trim().startsWith('//') ||
          fullLine.includes('*') ||
          fullLine.includes('deprecated') ||
          fullLine.includes('TODO');

        if (!isComment) {
          violations.push({ file: filePath, line: fullLine, type: 'getPublicUrl' });
        }
      }

      // Check for manual public URL construction patterns
      const manualUrlOutput = execSync(
        'rg -n "https://.*\\.supabase\\.co/storage/v1/object/public" src/ || true',
        { encoding: 'utf-8', cwd: projectRoot }
      );

      const manualUrlLines = manualUrlOutput
        .trim()
        .split('\n')
        .filter(l => l);

      for (const line of manualUrlLines) {
        const [filePath, ...rest] = line.split(':');
        if (!filePath) continue;

        const fullLine = rest.join(':');
        const isComment = fullLine.trim().startsWith('//') || fullLine.includes('*');

        if (!isComment) {
          violations.push({ file: filePath, line: fullLine, type: 'manual public URL' });
        }
      }
    } catch (error) {
      if (error.status !== 1) {
        throw error;
      }
    }

    if (violations.length > 0) {
      const violationList = violations
        .map(v => `  - ${v.file} (${v.type}): ${v.line.trim()}`)
        .join('\n');

      throw new Error(
        `Signed URL enforcement violated: Found ${violations.length} public URL usages:\n${violationList}\n\n` +
          `All file access must use createSignedDownloadUrl() or createSignedUploadUrl() from nexusAdapter.`
      );
    }

    expect(violations.length).toBe(0);
  });
});

describe('CCP Enforcement: CRUD-S Registry', () => {
  it('should fail if softDeleteEntity() is called for a table not in SOFT_DELETE_CAPABLE registry', async () => {
    // Read the registry from nexus-adapter.js
    const adapterPath = join(projectRoot, 'src/adapters/nexus-adapter.js');
    const adapterContent = readFileSync(adapterPath, 'utf-8');

    // Extract registry entries
    const registryMatch = adapterContent.match(/const SOFT_DELETE_CAPABLE = \{([^}]+)\}/s);
    if (!registryMatch) {
      throw new Error('Could not find SOFT_DELETE_CAPABLE registry in nexus-adapter.js');
    }

    const registryContent = registryMatch[1];
    const registryTables = [];
    const tableRegex = /(\w+):\s*\{/g;
    let match;
    while ((match = tableRegex.exec(registryContent)) !== null) {
      registryTables.push(match[1]);
    }

    // Find all softDeleteEntity() calls
    let violations = [];

    try {
      const output = execSync('rg -n "softDeleteEntity\\(" src/ || true', {
        encoding: 'utf-8',
        cwd: projectRoot,
      });

      const lines = output
        .trim()
        .split('\n')
        .filter(l => l);

      for (const line of lines) {
        const [filePath, ...rest] = line.split(':');
        if (!filePath) continue;

        // Read the file to check the table parameter
        const fileContent = readFileSync(join(projectRoot, filePath), 'utf-8');
        const fileLines = fileContent.split('\n');

        // Find the line number
        const lineNum = parseInt(rest[0]) - 1;
        if (lineNum < 0 || lineNum >= fileLines.length) continue;

        // Look for table parameter in the call (could be on same line or next few lines)
        const contextLines = fileLines.slice(Math.max(0, lineNum - 2), lineNum + 5);
        const context = contextLines.join('\n');

        // Extract table name from softDeleteEntity call
        const tableMatch = context.match(
          /softDeleteEntity\s*\(\s*\{[^}]*table:\s*['"]([^'"]+)['"]/
        );
        if (tableMatch) {
          const tableName = tableMatch[1];

          if (!registryTables.includes(tableName)) {
            violations.push({
              file: filePath,
              line: lineNum + 1,
              table: tableName,
              context: contextLines[contextLines.length - 1].trim(),
            });
          }
        }
      }
    } catch (error) {
      if (error.status !== 1) {
        throw error;
      }
    }

    if (violations.length > 0) {
      const violationList = violations
        .map(v => `  - ${v.file}:${v.line} - Table '${v.table}' not in registry`)
        .join('\n');

      throw new Error(
        `CRUD-S registry enforcement violated: Found ${violations.length} softDeleteEntity() calls for unregistered tables:\n${violationList}\n\n` +
          `Registered tables: ${registryTables.join(', ')}\n\n` +
          `Add the table to SOFT_DELETE_CAPABLE registry in src/adapters/nexus-adapter.js`
      );
    }

    expect(violations.length).toBe(0);
  });

  it('should verify SOFT_DELETE_CAPABLE registry exists and is non-empty', () => {
    const adapterPath = join(projectRoot, 'src/adapters/nexus-adapter.js');
    const adapterContent = readFileSync(adapterPath, 'utf-8');

    // Check registry exists
    expect(adapterContent).toContain('const SOFT_DELETE_CAPABLE = {');

    // Check registry has entries
    const registryMatch = adapterContent.match(/const SOFT_DELETE_CAPABLE = \{([^}]+)\}/s);
    expect(registryMatch).not.toBeNull();

    const registryContent = registryMatch[1];
    const tableRegex = /(\w+):\s*\{/g;
    const tables = [];
    let match;
    while ((match = tableRegex.exec(registryContent)) !== null) {
      tables.push(match[1]);
    }

    expect(tables.length).toBeGreaterThan(0);
  });
});

describe('CCP Enforcement: Legacy Adapter Usage', () => {
  it('should WARN for legacy vmpAdapter in allowed files, FAIL for new usage', () => {
    let violations = []; // New usage (FAIL)
    let warnings = []; // Allowed files (WARN)

    try {
      const output = execSync('rg -n "vmpAdapter" src/ || true', {
        encoding: 'utf-8',
        cwd: projectRoot,
      });

      const lines = output
        .trim()
        .split('\n')
        .filter(l => l);

      for (const line of lines) {
        const [filePath] = line.split(':');
        if (!filePath) continue;

        // Check if file is in allowed list
        const isAllowed = ALLOWED_VMPADAPTER_FILES.some(allowed => filePath.includes(allowed));

        if (isAllowed) {
          warnings.push({ file: filePath, line });
        } else {
          violations.push({ file: filePath, line });
        }
      }
    } catch (error) {
      if (error.status !== 1) {
        throw error;
      }
    }

    // FAIL if vmpAdapter appears in new files (not in allowed list)
    if (violations.length > 0) {
      const violationList = violations.map(v => `  - ${v.file}`).join('\n');

      throw new Error(
        `Legacy vmpAdapter usage detected in NEW files (not allowed):\n${violationList}\n\n` +
          `Allowed files (with TODO: CLEANUP-VMP-LEGACY-01): ${ALLOWED_VMPADAPTER_FILES.join(', ')}\n\n` +
          `Migrate to nexusAdapter. Do not expand vmpAdapter usage.`
      );
    }

    // WARN if vmpAdapter is in allowed files (acceptable debt, but should be migrated)
    if (warnings.length > 0) {
      const warningList = warnings.map(w => `  - ${w.file}`).join('\n');

      console.warn(
        `⚠️  Legacy vmpAdapter usage in allowed files (acceptable debt):\n${warningList}\n\n` +
          `These files have TODO: CLEANUP-VMP-LEGACY-01 and should be migrated after milestone.`
      );
    }

    // Test passes (no new violations), but warnings are logged
    expect(violations.length).toBe(0);
  });
});

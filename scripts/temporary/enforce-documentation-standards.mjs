#!/usr/bin/env node
/**
 * Documentation Standards Enforcement Script
 * 
 * Checks:
 * 1. Only README.md allowed in root (no other .md files)
 * 2. All scripts in scripts/ directory
 * 3. Documentation in docs/ or .dev/dev-note/
 * 
 * Exit code: 0 = pass, 1 = fail
 */

import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const ALLOWED_ROOT_FILES = [
  'README.md',
  'package.json',
  'package-lock.json',
  'server.js',
  'jsconfig.json',
  'mcp.config.json',
  'playwright.config.js',
  'vitest.config.js',
  'vercel.json',
  '.cursorrules',
  '.editorconfig',
  '.eslintrc.json',
  '.gitattributes',
  '.gitignore',
  '.prettierignore',
  '.prettierrc'
];

const ALLOWED_ROOT_DIRS = [
  'node_modules',
  '.git',
  '.vscode',
  '.github',
  'api',
  'archive',
  'docs',
  'migrations',
  'public',
  'scripts',
  'src',
  'supabase',
  'tests',
  'types',
  '.dev',
  '.archive',
  '.playwright-mcp'
];

let violations = [];
let errors = [];

async function checkRootDirectory() {
  console.log('🔍 Checking root directory compliance...\n');
  
  try {
    const entries = await readdir(projectRoot, { withFileTypes: true });
    
    for (const entry of entries) {
      const name = entry.name;
      
      // Skip hidden files that start with . (except allowed ones)
      if (name.startsWith('.') && !ALLOWED_ROOT_FILES.includes(name) && !ALLOWED_ROOT_DIRS.includes(name)) {
        continue;
      }
      
      if (entry.isFile()) {
        // Check if file is allowed
        if (!ALLOWED_ROOT_FILES.includes(name)) {
          // Check if it's a documentation file
          if (name.endsWith('.md')) {
            violations.push({
              type: 'documentation',
              file: name,
              message: `Documentation file "${name}" should be in docs/ or .dev/dev-note/, not root`
            });
          }
          // Check if it's a script file
          else if (name.endsWith('.js') && name !== 'server.js') {
            violations.push({
              type: 'script',
              file: name,
              message: `Script file "${name}" should be in scripts/ directory, not root`
            });
          }
          // Other files
          else {
            violations.push({
              type: 'other',
              file: name,
              message: `File "${name}" is not in allowed root files list`
            });
          }
        }
      }
    }
    
    return violations.length === 0;
  } catch (error) {
    errors.push(`Error reading root directory: ${error.message}`);
    return false;
  }
}

async function main() {
  const passed = await checkRootDirectory();
  
  console.log('\n' + '='.repeat(60));
  console.log('DOCUMENTATION STANDARDS ENFORCEMENT');
  console.log('='.repeat(60) + '\n');
  
  if (errors.length > 0) {
    console.error('❌ ERRORS:');
    errors.forEach(err => console.error(`   ${err}`));
    console.log('');
  }
  
  if (violations.length === 0) {
    console.log('✅ PASS: Root directory is compliant');
    console.log(`   Allowed files: ${ALLOWED_ROOT_FILES.length}`);
    console.log(`   Allowed directories: ${ALLOWED_ROOT_DIRS.length}`);
    process.exit(0);
  } else {
    console.log(`❌ FAIL: ${violations.length} violation(s) found\n`);
    
    // Group by type
    const byType = violations.reduce((acc, v) => {
      if (!acc[v.type]) acc[v.type] = [];
      acc[v.type].push(v);
      return acc;
    }, {});
    
    if (byType.documentation) {
      console.log('📄 Documentation Files in Root (should be in docs/ or .dev/dev-note/):');
      byType.documentation.forEach(v => {
        console.log(`   ❌ ${v.file}`);
        console.log(`      ${v.message}`);
      });
      console.log('');
    }
    
    if (byType.script) {
      console.log('📜 Script Files in Root (should be in scripts/):');
      byType.script.forEach(v => {
        console.log(`   ❌ ${v.file}`);
        console.log(`      ${v.message}`);
      });
      console.log('');
    }
    
    if (byType.other) {
      console.log('📦 Other Files in Root:');
      byType.other.forEach(v => {
        console.log(`   ❌ ${v.file}`);
        console.log(`      ${v.message}`);
      });
      console.log('');
    }
    
    console.log('='.repeat(60));
    console.log(`\n❌ COMPLIANCE: ${((ALLOWED_ROOT_FILES.length) / (ALLOWED_ROOT_FILES.length + violations.length) * 100).toFixed(1)}%`);
    console.log('\n💡 Fix: Move files to appropriate directories:');
    console.log('   - Documentation → docs/ or .dev/dev-note/');
    console.log('   - Scripts → scripts/');
    console.log('   - See DOCUMENTATION_STANDARDS.md for details\n');
    
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


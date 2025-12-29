#!/usr/bin/env node
/**
 * Documentation Naming Convention Validator
 * Validates all docs follow SCREAMING_SNAKE_CASE and directory structure
 */

import { readdir, stat } from 'fs/promises';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const docsRoot = join(projectRoot, 'docs');

const SCREAMING_SNAKE_CASE = /^[A-Z][A-Z0-9_]*\.md$/;
const KEBAB_CASE = /^[a-z][a-z0-9-]*$/;

const ALLOWED_ROOT_FILES = ['README.md', 'DOCUMENTATION_STANDARDS.md', 'DOCUMENTATION_REGISTRY.md'];
const ALLOWED_DIRECTORIES = [
  'architecture',
  'design-system',
  'development',
  'integrations'
];

const DEVELOPMENT_SUBDIRS = ['workflows', 'guides', 'policies', 'error-handling', 'notes'];
const INTEGRATION_SUBDIRS = ['supabase', 'mcp', 'services'];

let violations = [];
let compliant = 0;
let total = 0;

function validateFileName(fileName) {
  if (ALLOWED_ROOT_FILES.includes(fileName)) {
    return { valid: true };
  }
  
  if (!SCREAMING_SNAKE_CASE.test(fileName)) {
    return {
      valid: false,
      reason: `File name must be SCREAMING_SNAKE_CASE (e.g., FILE_NAME.md), got: ${fileName}`
    };
  }
  
  return { valid: true };
}

function validateDirectoryName(dirName) {
  if (!KEBAB_CASE.test(dirName)) {
    return {
      valid: false,
      reason: `Directory name must be kebab-case (e.g., design-system), got: ${dirName}`
    };
  }
  
  return { valid: true };
}

async function scanDirectory(dir, relativePath = '') {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        // Validate directory name
        const dirValidation = validateDirectoryName(entry.name);
        if (!dirValidation.valid) {
          violations.push({
            type: 'directory',
            path: relPath,
            issue: dirValidation.reason
          });
        }
        
        // Check if directory is allowed
        if (relativePath === '') {
          // Top-level directory
          if (!ALLOWED_DIRECTORIES.includes(entry.name)) {
            violations.push({
              type: 'directory',
              path: relPath,
              issue: `Top-level directory "${entry.name}" not in allowed list: ${ALLOWED_DIRECTORIES.join(', ')}`
            });
          }
        } else if (relativePath === 'development') {
          // Development subdirectory
          if (!DEVELOPMENT_SUBDIRS.includes(entry.name)) {
            violations.push({
              type: 'directory',
              path: relPath,
              issue: `Development subdirectory "${entry.name}" not in allowed list: ${DEVELOPMENT_SUBDIRS.join(', ')}`
            });
          }
        } else if (relativePath === 'integrations') {
          // Integration subdirectory
          if (!INTEGRATION_SUBDIRS.includes(entry.name)) {
            violations.push({
              type: 'directory',
              path: relPath,
              issue: `Integration subdirectory "${entry.name}" not in allowed list: ${INTEGRATION_SUBDIRS.join(', ')}`
            });
          }
        }
        
        // Recursively scan subdirectory
        await scanDirectory(fullPath, relPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        total++;
        
        // Validate file name
        const fileValidation = validateFileName(entry.name);
        if (fileValidation.valid) {
          compliant++;
        } else {
          violations.push({
            type: 'file',
            path: relPath,
            issue: fileValidation.reason
          });
        }
        
        // Check if file is in root when it shouldn't be
        if (relativePath === '' && !ALLOWED_ROOT_FILES.includes(entry.name)) {
          violations.push({
            type: 'file',
            path: relPath,
            issue: `File "${entry.name}" should not be in docs root. Move to appropriate subdirectory.`
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning ${dir}:`, error.message);
  }
}

async function main() {
  console.log('=== DOCUMENTATION NAMING CONVENTION VALIDATION ===\n');
  
  await scanDirectory(docsRoot);
  
  console.log(`Total files scanned: ${total}`);
  console.log(`Compliant: ${compliant}`);
  console.log(`Violations: ${violations.length}\n`);
  
  if (violations.length === 0) {
    console.log('✅ ALL DOCUMENTATION FILES COMPLY WITH NAMING CONVENTIONS');
    console.log(`✅ Compliance: 100%`);
    process.exit(0);
  } else {
    console.log('❌ VIOLATIONS FOUND:\n');
    
    const fileViolations = violations.filter(v => v.type === 'file');
    const dirViolations = violations.filter(v => v.type === 'directory');
    
    if (fileViolations.length > 0) {
      console.log('File Naming Violations:');
      fileViolations.forEach(v => {
        console.log(`  ❌ ${v.path}`);
        console.log(`     ${v.issue}`);
      });
      console.log('');
    }
    
    if (dirViolations.length > 0) {
      console.log('Directory Naming Violations:');
      dirViolations.forEach(v => {
        console.log(`  ❌ ${v.path}`);
        console.log(`     ${v.issue}`);
      });
      console.log('');
    }
    
    const compliance = Math.round((compliant / total) * 100);
    console.log(`❌ Compliance: ${compliance}%`);
    console.log(`\nFix violations to achieve 100% compliance.`);
    
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


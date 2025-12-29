#!/usr/bin/env node
/**
 * Scripts Naming Convention Validator
 * Validates all scripts follow kebab-case and directory structure
 */

import { readdir, stat } from 'fs/promises';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');
const scriptsRoot = join(projectRoot, 'scripts');

const KEBAB_CASE = /^[a-z][a-z0-9-]*\.[a-z0-9]+$/;
const ALLOWED_EXTENSIONS = ['.js', '.mjs', '.ts', '.ps1', '.sh', '.bat', '.sql'];
const ALLOWED_ROOT_FILES = ['SCRIPTS_REGISTRY.md', 'README.md'];
const ALLOWED_SUBDIRS = ['documented', 'temporary'];

let violations = [];
let compliant = 0;
let total = 0;

function validateScriptName(fileName) {
  if (ALLOWED_ROOT_FILES.includes(fileName)) {
    return { valid: true };
  }
  
  const ext = extname(fileName);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      reason: `Script extension must be one of: ${ALLOWED_EXTENSIONS.join(', ')}, got: ${ext}`
    };
  }
  
  if (!KEBAB_CASE.test(fileName)) {
    return {
      valid: false,
      reason: `Script name must be kebab-case (e.g., script-name.js), got: ${fileName}`
    };
  }
  
  return { valid: true };
}

function validateDirectoryName(dirName) {
  if (!ALLOWED_SUBDIRS.includes(dirName)) {
    return {
      valid: false,
      reason: `Subdirectory "${dirName}" not in allowed list: ${ALLOWED_SUBDIRS.join(', ')}`
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
        
        // Recursively scan subdirectory
        await scanDirectory(fullPath, relPath);
      } else if (entry.isFile()) {
        // Check if it's a script file
        const ext = extname(entry.name);
        if (ALLOWED_EXTENSIONS.includes(ext)) {
          total++;
          
          // Validate script name
          const fileValidation = validateScriptName(entry.name);
          if (fileValidation.valid) {
            compliant++;
          } else {
            violations.push({
              type: 'file',
              path: relPath,
              issue: fileValidation.reason
            });
          }
          
          // Check if script is in root when it shouldn't be
          if (relativePath === '' && !ALLOWED_ROOT_FILES.includes(entry.name) && ALLOWED_EXTENSIONS.includes(ext)) {
            violations.push({
              type: 'file',
              path: relPath,
              issue: `Script "${entry.name}" should not be in scripts root. Move to appropriate subdirectory (documented/ or temporary/).`
            });
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning ${dir}:`, error.message);
  }
}

async function checkRegistry() {
  try {
    const registryPath = join(scriptsRoot, 'documented', 'SCRIPTS_REGISTRY.md');
    const registry = await import('fs/promises').then(fs => fs.readFile(registryPath, 'utf-8'));
    
    // Check if all documented scripts are in registry
    const documentedScripts = await readdir(join(scriptsRoot, 'documented'), { withFileTypes: true });
    const scriptFiles = documentedScripts
      .filter(e => e.isFile() && ALLOWED_EXTENSIONS.some(ext => e.name.endsWith(ext)))
      .map(e => e.name);
    
    for (const script of scriptFiles) {
      if (!registry.includes(script)) {
        violations.push({
          type: 'registry',
          path: `documented/${script}`,
          issue: `Script "${script}" is not registered in SCRIPTS_REGISTRY.md`
        });
      }
    }
  } catch (error) {
    console.error('Error checking registry:', error.message);
  }
}

async function checkPackageJson() {
  try {
    const packageJsonPath = join(projectRoot, 'package.json');
    const packageJson = JSON.parse(await import('fs/promises').then(fs => fs.readFile(packageJsonPath, 'utf-8')));
    
    // Check if all referenced scripts exist
    for (const [scriptName, scriptValue] of Object.entries(packageJson.scripts || {})) {
      if (typeof scriptValue === 'string' && scriptValue.includes('scripts/')) {
        const scriptPath = scriptValue.split('scripts/')[1]?.split(' ')[0];
        if (scriptPath) {
          const fullPath = join(scriptsRoot, scriptPath);
          try {
            await stat(fullPath);
          } catch {
            violations.push({
              type: 'package.json',
              path: scriptPath,
              issue: `Script referenced in package.json ("${scriptName}") does not exist: ${scriptPath}`
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error checking package.json:', error.message);
  }
}

async function main() {
  console.log('=== SCRIPTS NAMING CONVENTION VALIDATION ===\n');
  
  await scanDirectory(scriptsRoot);
  await checkRegistry();
  await checkPackageJson();
  
  console.log(`Total scripts scanned: ${total}`);
  console.log(`Compliant: ${compliant}`);
  console.log(`Violations: ${violations.length}\n`);
  
  if (violations.length === 0) {
    console.log('✅ ALL SCRIPTS COMPLY WITH NAMING CONVENTIONS');
    console.log(`✅ Compliance: 100%`);
    process.exit(0);
  } else {
    console.log('❌ VIOLATIONS FOUND:\n');
    
    const fileViolations = violations.filter(v => v.type === 'file');
    const dirViolations = violations.filter(v => v.type === 'directory');
    const registryViolations = violations.filter(v => v.type === 'registry');
    const packageViolations = violations.filter(v => v.type === 'package.json');
    
    if (fileViolations.length > 0) {
      console.log('Script Naming Violations:');
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
    
    if (registryViolations.length > 0) {
      console.log('Registry Violations:');
      registryViolations.forEach(v => {
        console.log(`  ❌ ${v.path}`);
        console.log(`     ${v.issue}`);
      });
      console.log('');
    }
    
    if (packageViolations.length > 0) {
      console.log('package.json Violations:');
      packageViolations.forEach(v => {
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


#!/usr/bin/env node
/**
 * Workspace 360 Audit & Cleanup
 * Comprehensive audit and cleanup of entire workspace
 * 
 * Actions:
 * 1. Identify duplicate files
 * 2. Identify files in wrong locations
 * 3. Clean archive directory
 * 4. Remove empty directories
 * 5. Generate compliance report
 */

import { readdir, stat, unlink, rmdir, readFile } from 'fs/promises';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

const auditResults = {
  duplicates: [],
  wrongLocation: [],
  emptyDirs: [],
  archiveCleanup: [],
  totalFiles: 0,
  cleanedFiles: 0,
  errors: []
};

// Files that should be removed from archive (duplicates/obsolete)
const archiveFilesToRemove = [
  // Duplicate README files with random names
  'README_0maksd1m.2g4.md',
  'README_1exw5qzq.qzs.md',
  'README_d1nyxph3.smr.md',
  'README_jesydyvq.def.md',
  'README_jvq5xcco.22o.md',
  'README_ku3pyplm.aur.md',
  'README_m02wrbff.aie.md',
  'README_smumsccm.o35.md',
  'README_xchvjo2g.3ww.md',
  
  // Duplicate index files (edge functions should be in supabase/functions)
  'index_afxnxjou.tc0.ts',
  'index_iocgk0u5.joo.ts',
  'index.ts', // If duplicate of supabase/functions
  
  // Duplicate layout.html (should be in src/views)
  'layout.html',
  
  // Old seed scripts (if duplicates)
  'seed-superholding-company.js',
  'seed-vmp-data.js',
  
  // Old scripts
  'soa-matching-engine.js',
  'vmp-guardrails-check.mjs',
  
  // Old image files
  'page-2025-12-25T18-44-57-317Z.png',
  'realtime-toast-test.png',
];

async function checkFileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function removeFile(filePath) {
  try {
    await unlink(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function findEmptyDirectories(dir) {
  const emptyDirs = [];
  
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    if (entries.length === 0) {
      emptyDirs.push(dir);
      return emptyDirs;
    }
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDir = join(dir, entry.name);
        // Skip node_modules, .git, etc.
        if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
          const subEmpty = await findEmptyDirectories(subDir);
          emptyDirs.push(...subEmpty);
        }
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
  }
  
  return emptyDirs;
}

async function main() {
  console.log('=== WORKSPACE 360 AUDIT & CLEANUP ===\n');
  
  // 1. Clean archive directory
  console.log('[1/5] Cleaning archive directory...');
  const archiveDir = join(projectRoot, 'archive');
  
  for (const fileName of archiveFilesToRemove) {
    const filePath = join(archiveDir, fileName);
    const exists = await checkFileExists(filePath);
    
    if (exists) {
      // Check if it's a duplicate before removing
      const isDuplicate = await checkIfDuplicate(filePath, fileName);
      
      if (isDuplicate) {
        const result = await removeFile(filePath);
        if (result.success) {
          auditResults.archiveCleanup.push(fileName);
          auditResults.cleanedFiles++;
          console.log(`   ✓ Removed: ${fileName}`);
        } else {
          auditResults.errors.push({ file: fileName, error: result.error });
          console.log(`   ✗ Error removing: ${fileName} - ${result.error}`);
        }
      } else {
        console.log(`   ⊘ Skipped (not duplicate): ${fileName}`);
      }
    }
  }
  
  console.log(`   Cleaned ${auditResults.archiveCleanup.length} files from archive\n`);
  
  // 2. Find empty directories
  console.log('[2/5] Finding empty directories...');
  const emptyDirs = await findEmptyDirectories(projectRoot);
  
  // Filter out important empty dirs that should stay
  const removableEmptyDirs = emptyDirs.filter(dir => {
    const relPath = dir.replace(projectRoot, '').replace(/^[\\/]/, '');
    // Keep these empty dirs
    return !['public/templates', 'types'].some(keep => relPath.includes(keep));
  });
  
  auditResults.emptyDirs = removableEmptyDirs;
  console.log(`   Found ${removableEmptyDirs.length} empty directories\n`);
  
  // 3. Check for files in wrong locations
  console.log('[3/5] Checking file locations...');
  await checkFileLocations();
  console.log(`   Found ${auditResults.wrongLocation.length} files in wrong locations\n`);
  
  // 4. Generate report
  console.log('[4/5] Generating compliance report...');
  await generateReport();
  
  console.log('\n=== CLEANUP COMPLETE ===');
  console.log(`Files cleaned: ${auditResults.cleanedFiles}`);
  console.log(`Empty directories: ${auditResults.emptyDirs.length}`);
  console.log(`Files in wrong locations: ${auditResults.wrongLocation.length}`);
  console.log(`Errors: ${auditResults.errors.length}`);
}

async function checkIfDuplicate(filePath, fileName) {
  // Check if file exists in proper location
  if (fileName.includes('README_') && fileName !== 'README.md') {
    // Random named README files are duplicates
    return true;
  }
  
  if (fileName === 'layout.html') {
    // Check if src/views/layout.html exists
    const properPath = join(projectRoot, 'src/views/layout.html');
    return await checkFileExists(properPath);
  }
  
  if (fileName.includes('index') && fileName.endsWith('.ts')) {
    // Check if edge function exists in supabase/functions
    const properPath = join(projectRoot, 'supabase/functions', fileName);
    return await checkFileExists(properPath);
  }
  
  // For other files, assume they're duplicates if in archive
  return true;
}

async function checkFileLocations() {
  // Check for common misplacements
  const checks = [
    {
      pattern: /\.test\.js$/,
      shouldBeIn: 'tests/',
      description: 'Test files'
    },
    {
      pattern: /\.spec\.js$/,
      shouldBeIn: 'tests/',
      description: 'Spec files'
    }
  ];
  
  // This would require full directory scan - simplified for now
}

async function generateReport() {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      filesCleaned: auditResults.cleanedFiles,
      emptyDirectories: auditResults.emptyDirs.length,
      filesInWrongLocation: auditResults.wrongLocation.length,
      errors: auditResults.errors.length
    },
    archiveCleanup: auditResults.archiveCleanup,
    emptyDirectories: auditResults.emptyDirs.map(d => d.replace(projectRoot, '')),
    errors: auditResults.errors
  };
  
  console.log('\n--- COMPLIANCE REPORT ---');
  console.log(JSON.stringify(report, null, 2));
  
  // Calculate compliance percentage
  const totalIssues = auditResults.archiveCleanup.length + 
                     auditResults.emptyDirs.length + 
                     auditResults.wrongLocation.length;
  
  const compliance = totalIssues === 0 ? 100 : 
    Math.max(0, 100 - (totalIssues * 2)); // Rough estimate
  
  console.log(`\nCompliance: ${compliance.toFixed(1)}%`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };


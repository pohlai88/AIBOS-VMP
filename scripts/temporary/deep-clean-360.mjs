#!/usr/bin/env node
/**
 * Deep Clean 360 - Complete Archive Consolidation
 * Archives all duplicates, legacy, temporary files to single global archive
 */

import { readdir, stat, rename, mkdir, rmdir } from 'fs/promises';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const globalArchive = join(projectRoot, 'archive');

const EXCLUDE_PATHS = [
  'node_modules',
  '.git',
  'archive',
  '.archive',
  'docs',
  'src',
  'public',
  'tests',
  'types',
  'api',
  'migrations',
  'supabase',
  'scripts'
];

const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /archive/,
  /\.archive/,
  /package-lock\.json/,
  /\.min\.(js|css)/,
  /server\.js$/,
  /package\.json$/,
  /README\.md$/
];

async function shouldExclude(path) {
  const relPath = path.replace(projectRoot + '\\', '').replace(projectRoot + '/', '');
  const parts = relPath.split(/[\\/]/);
  
  // Check if any part matches exclude paths
  if (parts.some(part => EXCLUDE_PATHS.includes(part))) {
    return true;
  }
  
  // Check patterns
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(path));
}

async function getAllFiles(dir, fileList = []) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (await shouldExclude(fullPath)) {
        continue;
      }
      
      if (entry.isDirectory()) {
        await getAllFiles(fullPath, fileList);
      } else if (entry.isFile()) {
        fileList.push(fullPath);
      }
    }
  } catch (error) {
    // Skip permission errors
  }
  
  return fileList;
}

function generateUniqueName(archiveDir, fileName) {
  const base = basename(fileName, extname(fileName));
  const ext = extname(fileName);
  let counter = 1;
  let uniqueName = fileName;
  
  while (true) {
    const testPath = join(archiveDir, uniqueName);
    try {
      // Check if exists (synchronous check would be better, but async for now)
      return uniqueName;
    } catch {
      uniqueName = `${base}_${counter}${ext}`;
      counter++;
    }
  }
}

async function moveToArchive(filePath, archiveDir) {
  try {
    const fileName = basename(filePath);
    let destPath = join(archiveDir, fileName);
    
    // Handle duplicates
    let counter = 1;
    while (true) {
      try {
        await stat(destPath);
        // File exists, create unique name
        const base = basename(fileName, extname(fileName));
        const ext = extname(fileName);
        destPath = join(archiveDir, `${base}_${counter}${ext}`);
        counter++;
      } catch {
        // File doesn't exist, use this path
        break;
      }
    }
    
    await rename(filePath, destPath);
    return { success: true, dest: destPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('=== DEEP CLEAN 360 - PRECISION MODE ===\n');
  
  // Ensure archive exists
  try {
    await mkdir(globalArchive, { recursive: true });
  } catch (error) {
    // Already exists
  }
  
  const results = {
    duplicates: { found: 0, archived: 0, errors: [] },
    legacy: { found: 0, archived: 0, errors: [] },
    temp: { found: 0, archived: 0, errors: [] },
    testOutputs: { found: 0, archived: 0, errors: [] },
    largeFiles: { found: 0, archived: 0, errors: [] }
  };
  
  // Get all files
  console.log('[1/6] Scanning entire project...');
  const allFiles = await getAllFiles(projectRoot);
  console.log(`   Found ${allFiles.length} files to analyze\n`);
  
  // 1. Find duplicates
  console.log('[2/6] Finding duplicate files...');
  const fileMap = new Map();
  const duplicates = [];
  
  for (const filePath of allFiles) {
    const fileName = basename(filePath);
    if (!fileMap.has(fileName)) {
      fileMap.set(fileName, []);
    }
    fileMap.get(fileName).push(filePath);
  }
  
  for (const [fileName, paths] of fileMap.entries()) {
    if (paths.length > 1) {
      // Keep first, archive rest
      const sorted = paths.sort();
      duplicates.push(...sorted.slice(1));
      results.duplicates.found += paths.length - 1;
    }
  }
  
  console.log(`   Found ${duplicates.length} duplicate files`);
  
  // Archive duplicates
  for (const filePath of duplicates) {
    const result = await moveToArchive(filePath, globalArchive);
    if (result.success) {
      results.duplicates.archived++;
    } else {
      results.duplicates.errors.push({ file: filePath, error: result.error });
    }
  }
  
  console.log(`   Archived ${results.duplicates.archived} duplicates\n`);
  
  // 2. Find legacy files (vmp, old patterns)
  console.log('[3/6] Finding legacy files...');
  const legacyFiles = [];
  
  for (const filePath of allFiles) {
    const fileName = basename(filePath);
    const lowerName = fileName.toLowerCase();
    
    if (lowerName.includes('vmp') || 
        lowerName.includes('legacy') || 
        lowerName.includes('old') || 
        lowerName.includes('deprecated') ||
        lowerName.includes('backup')) {
      legacyFiles.push(filePath);
      results.legacy.found++;
    }
  }
  
  console.log(`   Found ${legacyFiles.length} legacy files`);
  
  // Archive legacy
  for (const filePath of legacyFiles) {
    const result = await moveToArchive(filePath, globalArchive);
    if (result.success) {
      results.legacy.archived++;
    } else {
      results.legacy.errors.push({ file: filePath, error: result.error });
    }
  }
  
  console.log(`   Archived ${results.legacy.archived} legacy files\n`);
  
  // 3. Find temporary files
  console.log('[4/6] Finding temporary files...');
  const tempFiles = [];
  
  for (const filePath of allFiles) {
    const fileName = basename(filePath);
    const ext = extname(fileName).toLowerCase();
    
    if (['.tmp', '.temp', '.bak', '.swp', '~'].includes(ext) ||
        fileName.startsWith('~') ||
        fileName.endsWith('.bak')) {
      tempFiles.push(filePath);
      results.temp.found++;
    }
  }
  
  console.log(`   Found ${tempFiles.length} temporary files`);
  
  // Archive temp
  for (const filePath of tempFiles) {
    const result = await moveToArchive(filePath, globalArchive);
    if (result.success) {
      results.temp.archived++;
    } else {
      results.temp.errors.push({ file: filePath, error: result.error });
    }
  }
  
  console.log(`   Archived ${results.temp.archived} temporary files\n`);
  
  // 4. Find test outputs
  console.log('[5/6] Finding test output files...');
  const testOutputs = [];
  
  for (const filePath of allFiles) {
    const fileName = basename(filePath).toLowerCase();
    const ext = extname(fileName).toLowerCase();
    
    if ((ext === '.txt' || ext === '.log') && 
        (fileName.includes('test') || fileName.includes('output'))) {
      testOutputs.push(filePath);
      results.testOutputs.found++;
    }
  }
  
  console.log(`   Found ${testOutputs.length} test output files`);
  
  // Archive test outputs
  for (const filePath of testOutputs) {
    const result = await moveToArchive(filePath, globalArchive);
    if (result.success) {
      results.testOutputs.archived++;
    } else {
      results.testOutputs.errors.push({ file: filePath, error: result.error });
    }
  }
  
  console.log(`   Archived ${results.testOutputs.archived} test outputs\n`);
  
  // 5. Find large files (>500KB)
  console.log('[6/6] Finding large files...');
  const largeFiles = [];
  
  for (const filePath of allFiles) {
    try {
      const stats = await stat(filePath);
      if (stats.size > 500 * 1024) { // >500KB
        const fileName = basename(filePath).toLowerCase();
        const ext = extname(fileName).toLowerCase();
        
        if (['.txt', '.log', '.sql', '.json'].includes(ext) ||
            fileName.includes('test') || 
            fileName.includes('output') ||
            fileName.includes('dump')) {
          largeFiles.push(filePath);
          results.largeFiles.found++;
        }
      }
    } catch (error) {
      // Skip files we can't stat
    }
  }
  
  console.log(`   Found ${largeFiles.length} large files`);
  
  // Archive large files
  for (const filePath of largeFiles) {
    const result = await moveToArchive(filePath, globalArchive);
    if (result.success) {
      results.largeFiles.archived++;
    } else {
      results.largeFiles.errors.push({ file: filePath, error: result.error });
    }
  }
  
  console.log(`   Archived ${results.largeFiles.archived} large files\n`);
  
  // Summary
  console.log('=== SUMMARY ===');
  const totalFound = results.duplicates.found + results.legacy.found + 
                     results.temp.found + results.testOutputs.found + 
                     results.largeFiles.found;
  const totalArchived = results.duplicates.archived + results.legacy.archived +
                       results.temp.archived + results.testOutputs.archived +
                       results.largeFiles.archived;
  const totalErrors = results.duplicates.errors.length + results.legacy.errors.length +
                     results.temp.errors.length + results.testOutputs.errors.length +
                     results.largeFiles.errors.length;
  
  console.log(`Total files found: ${totalFound}`);
  console.log(`Total archived: ${totalArchived}`);
  console.log(`Total errors: ${totalErrors}`);
  
  if (totalErrors > 0) {
    console.log('\nErrors:');
    Object.entries(results).forEach(([category, data]) => {
      if (data.errors.length > 0) {
        console.log(`\n${category}:`);
        data.errors.forEach(err => {
          console.log(`  ${err.file}: ${err.error}`);
        });
      }
    });
  }
  
  // Get final archive count
  try {
    const archiveFiles = await readdir(globalArchive);
    const archiveStats = await Promise.all(
      archiveFiles.map(async (file) => {
        try {
          const stats = await stat(join(globalArchive, file));
          return stats.size;
        } catch {
          return 0;
        }
      })
    );
    const totalSize = archiveStats.reduce((sum, size) => sum + size, 0) / (1024 * 1024);
    
    console.log(`\nFinal archive: ${archiveFiles.length} files, ${totalSize.toFixed(2)} MB`);
  } catch (error) {
    console.log(`\nCould not read archive directory: ${error.message}`);
  }
  
  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


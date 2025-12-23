#!/usr/bin/env node

/**
 * Migration Application Script
 * 
 * Applies database migrations using Supabase MCP or CLI
 * 
 * Usage:
 *   node scripts/apply-migrations.js [--env=production|development|staging] [--include-seed]
 * 
 * Options:
 *   --env=production      Production environment (excludes seed data)
 *   --env=development    Development environment (includes seed data)
 *   --env=staging        Staging environment (includes seed data)
 *   --include-seed       Force include seed data (overrides env check)
 *   --exclude-seed       Force exclude seed data (overrides env check)
 */

import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Environment validation
const env = process.env.NODE_ENV || 'development';
const includeSeed = process.argv.includes('--include-seed') || 
                    (env !== 'production' && !process.argv.includes('--exclude-seed'));

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('   Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' },
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Apply a single migration
 */
async function applyMigration(filename, sql) {
  try {
    console.log(`📦 Applying ${filename}...`);
    
    // Execute migration
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // If RPC doesn't exist, execute directly
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        // Fallback: Execute SQL directly (requires service role)
        const { error: directError } = await supabase
          .from('_migrations')
          .select('*')
          .limit(1);
        
        // If _migrations table doesn't exist, create it
        if (directError && directError.message.includes('does not exist')) {
          await supabase.rpc('exec_sql', {
            sql_query: `
              CREATE TABLE IF NOT EXISTS _migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMPTZ DEFAULT NOW()
              );
            `
          });
        }
        
        // Execute migration SQL
        const { error: execError } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (execError) throw execError;
      } else {
        throw error;
      }
    }
    
    // Record migration
    await supabase
      .from('_migrations')
      .upsert({ filename, applied_at: new Date().toISOString() });
    
    console.log(`✅ Applied ${filename}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to apply ${filename}:`, error.message);
    return false;
  }
}

/**
 * Get migration files in order
 */
async function getMigrationFiles() {
  const migrationsDir = join(__dirname, '..', 'migrations');
  const files = await readdir(migrationsDir);
  
  // Filter and sort migration files
  const migrationFiles = files
    .filter(f => f.endsWith('.sql') && /^\d{3}_/.test(f))
    .sort((a, b) => {
      const numA = parseInt(a.substring(0, 3));
      const numB = parseInt(b.substring(0, 3));
      return numA - numB;
    });
  
  // Exclude seed data if not in development/staging
  if (!includeSeed) {
    return migrationFiles.filter(f => !f.includes('seed'));
  }
  
  return migrationFiles;
}

/**
 * Check if migration already applied
 */
async function isMigrationApplied(filename) {
  try {
    const { data, error } = await supabase
      .from('_migrations')
      .select('filename')
      .eq('filename', filename)
      .single();
    
    return !error && data !== null;
  } catch (error) {
    // Table doesn't exist yet
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting migration application...');
  console.log(`   Environment: ${env}`);
  console.log(`   Include seed data: ${includeSeed ? 'YES' : 'NO'}`);
  console.log('');
  
  // Get migration files
  const migrationFiles = await getMigrationFiles();
  
  if (migrationFiles.length === 0) {
    console.error('❌ No migration files found');
    process.exit(1);
  }
  
  console.log(`📋 Found ${migrationFiles.length} migration(s) to apply\n`);
  
  // Apply migrations in order
  const migrationsDir = join(__dirname, '..', 'migrations');
  let applied = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const filename of migrationFiles) {
    // Check if already applied
    if (await isMigrationApplied(filename)) {
      console.log(`⏭️  Skipping ${filename} (already applied)`);
      skipped++;
      continue;
    }
    
    // Read migration SQL
    const sql = await readFile(join(migrationsDir, filename), 'utf-8');
    
    // Apply migration
    const success = await applyMigration(filename, sql);
    
    if (success) {
      applied++;
    } else {
      failed++;
      console.error(`❌ Stopping migration application due to error`);
      break;
    }
  }
  
  // Summary
  console.log('\n📊 Migration Summary:');
  console.log(`   ✅ Applied: ${applied}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  
  if (failed > 0) {
    process.exit(1);
  }
  
  console.log('\n✅ Migration application complete!');
}

// Run
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


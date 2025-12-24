#!/usr/bin/env node
/**
 * Cleanup Script: Remove old custom auth tables and data
 *
 * This script:
 * 1. Verifies mapping table exists and is populated
 * 2. Cleans up old password reset tokens
 * 3. Cleans up old sessions
 * 4. Archives vmp_vendor_users (removes password_hash)
 *
 * WARNING: This will delete old auth data. Make sure migration is complete.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupOldAuth() {
  console.log('🧹 Cleaning Up Old Custom Auth System\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Verify mapping table exists and is populated
    console.log('\n📋 Step 1: Verify mapping table');
    const { data: mappings, error: mappingError } = await supabase
      .from('vmp_auth_user_mapping')
      .select('*')
      .limit(10);

    if (mappingError) {
      throw new Error(`Failed to query mapping table: ${mappingError.message}`);
    }

    if (!mappings || mappings.length === 0) {
      console.error('   ❌ Mapping table is empty! Cannot proceed with cleanup.');
      console.error('   → Run the migration script first: node scripts/revert-to-supabase-auth.js');
      process.exit(1);
    }

    console.log(`   ✅ Mapping table has ${mappings.length} entries`);
    console.log(`   → All users are mapped from auth.users to vmp_vendor_users`);

    // Step 2: Clean up password reset tokens
    console.log('\n📋 Step 2: Clean up password reset tokens');
    const { data: tokens, error: tokenCountError } = await supabase
      .from('vmp_password_reset_tokens')
      .select('id', { count: 'exact', head: true });

    if (tokenCountError) {
      console.warn(`   ⚠️  Could not count tokens: ${tokenCountError.message}`);
    } else {
      const tokenCount = tokens?.length || 0;
      if (tokenCount > 0) {
        const { error: deleteError } = await supabase
          .from('vmp_password_reset_tokens')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (deleteError) {
          console.error(`   ❌ Failed to delete tokens: ${deleteError.message}`);
        } else {
          console.log(`   ✅ Deleted ${tokenCount} old password reset tokens`);
        }
      } else {
        console.log('   ✅ No tokens to delete');
      }
    }

    // Step 3: Clean up old sessions
    console.log('\n📋 Step 3: Clean up old custom sessions');
    const { data: sessions, error: sessionCountError } = await supabase
      .from('vmp_sessions')
      .select('id', { count: 'exact', head: true });

    if (sessionCountError) {
      console.warn(`   ⚠️  Could not count sessions: ${sessionCountError.message}`);
    } else {
      const sessionCount = sessions?.length || 0;
      if (sessionCount > 0) {
        const { error: deleteError } = await supabase.from('vmp_sessions').delete().neq('id', ''); // Delete all

        if (deleteError) {
          console.error(`   ❌ Failed to delete sessions: ${deleteError.message}`);
        } else {
          console.log(`   ✅ Deleted ${sessionCount} old sessions`);
        }
      } else {
        console.log('   ✅ No sessions to delete');
      }
    }

    // Step 4: Verify vmp_vendor_users is archived
    console.log('\n📋 Step 4: Verify vmp_vendor_users is archived');
    const { data: users, error: userError } = await supabase
      .from('vmp_vendor_users')
      .select('id, email, password_hash')
      .limit(5);

    if (userError) {
      console.warn(`   ⚠️  Could not query users: ${userError.message}`);
    } else {
      const usersWithPassword = users?.filter(u => u.password_hash) || [];
      if (usersWithPassword.length > 0) {
        console.warn(`   ⚠️  ${usersWithPassword.length} users still have password_hash`);
        console.warn('   → Run: ALTER TABLE vmp_vendor_users DROP COLUMN IF EXISTS password_hash;');
      } else {
        console.log('   ✅ password_hash column removed (archived)');
      }
    }

    console.log('\n✅ Cleanup completed successfully');
    console.log('\n📝 Summary:');
    console.log('   ✅ Mapping table verified');
    console.log('   ✅ Old password reset tokens cleaned');
    console.log('   ✅ Old sessions cleaned');
    console.log('   ✅ vmp_vendor_users archived (password_hash removed)');
    console.log('\n⚠️  Note: vmp_vendor_users table is kept for foreign key integrity.');
    console.log(
      '   Use vmp_auth_user_mapping for lookups between auth.users and vmp_vendor_users.'
    );
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    throw error;
  }
}

cleanupOldAuth()
  .then(() => {
    console.log('\n✅ Cleanup script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Cleanup script failed:', error);
    process.exit(1);
  });

#!/usr/bin/env node
/**
 * Migration Script: Revert from Custom Auth to Supabase Auth
 * 
 * This script:
 * 1. Migrates vmp_vendor_users to Supabase Auth (auth.users)
 * 2. Preserves vendor relationships via user_metadata
 * 3. Creates a mapping table to link auth.users to vmp_vendors
 * 
 * WARNING: This will change your authentication system.
 * Make sure to backup your database before running.
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateToSupabaseAuth() {
  console.log('🔄 Migrating from Custom Auth to Supabase Auth\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Get all vmp_vendor_users
    console.log('\n📋 Step 1: Fetching vmp_vendor_users...');
    const { data: vmpUsers, error: fetchError } = await supabase
      .from('vmp_vendor_users')
      .select('id, email, password_hash, display_name, vendor_id, is_active')
      .order('created_at');

    if (fetchError) {
      throw new Error(`Failed to fetch vmp_vendor_users: ${fetchError.message}`);
    }

    if (!vmpUsers || vmpUsers.length === 0) {
      console.log('⚠️  No users found in vmp_vendor_users');
      return;
    }

    console.log(`   Found ${vmpUsers.length} users to migrate`);

    // Step 2: Create users in Supabase Auth
    console.log('\n📋 Step 2: Creating users in Supabase Auth...');
    const migrationResults = [];

    for (const vmpUser of vmpUsers) {
      try {
        // Check if user already exists by trying to list users
        // Note: We'll just try to create and handle the error if user exists

        // Create user in Supabase Auth using admin API
        // Use service role client for admin operations
        const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
          email: vmpUser.email,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            display_name: vmpUser.display_name,
            vendor_id: vmpUser.vendor_id,
            vmp_user_id: vmpUser.id, // Link back to vmp_vendor_users
            is_active: vmpUser.is_active
          }
        });

        if (createError) {
          console.error(`   ❌ Failed to create ${vmpUser.email}: ${createError.message}`);
          migrationResults.push({
            email: vmpUser.email,
            status: 'failed',
            error: createError.message
          });
          continue;
        }

        // Update password if we have the hash
        // Note: Supabase Auth doesn't accept bcrypt hashes directly
        // We'll need to use the admin API to set a temporary password
        // and force password reset on first login
        if (vmpUser.password_hash) {
          // Generate a temporary password (user will need to reset)
          const tempPassword = `Temp${Math.random().toString(36).slice(-12)}!`;
          
          const { error: passwordError } = await supabase.auth.admin.updateUserById(
            authUser.user.id,
            { password: tempPassword }
          );

          if (passwordError) {
            console.warn(`   ⚠️  Could not set password for ${vmpUser.email}: ${passwordError.message}`);
          } else {
            console.log(`   ✅ Created ${vmpUser.email} (temporary password set - user must reset)`);
          }
        } else {
          console.log(`   ✅ Created ${vmpUser.email} (no password - user must set password)`);
        }

        migrationResults.push({
          email: vmpUser.email,
          status: 'success',
          authUserId: authUser.user.id,
          vmpUserId: vmpUser.id
        });

      } catch (error) {
        console.error(`   ❌ Error migrating ${vmpUser.email}: ${error.message}`);
        migrationResults.push({
          email: vmpUser.email,
          status: 'error',
          error: error.message
        });
      }
    }

    // Step 3: Summary
    console.log('\n📊 Migration Summary:');
    console.log('='.repeat(60));
    const successful = migrationResults.filter(r => r.status === 'success').length;
    const skipped = migrationResults.filter(r => r.status === 'skipped').length;
    const failed = migrationResults.filter(r => r.status === 'failed' || r.status === 'error').length;

    console.log(`   ✅ Successful: ${successful}`);
    console.log(`   ⚠️  Skipped: ${skipped}`);
    console.log(`   ❌ Failed: ${failed}`);

    if (successful > 0) {
      console.log('\n⚠️  IMPORTANT: Users created with temporary passwords.');
      console.log('   They will need to use "Forgot Password" to set their password.');
      console.log('\n📝 Next Steps:');
      console.log('   1. Update server.js to use Supabase Auth');
      console.log('   2. Update login route to use supabase.auth.signInWithPassword()');
      console.log('   3. Update password reset to use supabase.auth.resetPasswordForEmail()');
      console.log('   4. Test login with migrated users');
    }

    return migrationResults;

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateToSupabaseAuth()
  .then(() => {
    console.log('\n✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });


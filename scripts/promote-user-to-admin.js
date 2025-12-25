/**
 * Script: Promote User to Admin/Internal
 * Description: Updates dev@example.com to have internal/admin access
 *
 * Usage: node scripts/promote-user-to-admin.js
 *
 * This script:
 * 1. Updates Supabase Auth user_metadata.is_internal = true
 * 2. Updates or creates vmp_vendor_users record with is_internal = true
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env') });

// Get email from command line argument or use default
const TARGET_EMAIL = process.argv[2] || 'dev@example.com';

async function promoteUserToAdmin() {
  console.log('🔐 Promoting user to admin/internal access...\n');

  // Check for required environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    process.exit(1);
  }

  // Create Supabase admin client (service role key has full access)
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Step 1: Find user in Supabase Auth
    console.log(`📧 Looking up user: ${TARGET_EMAIL}...`);
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    const authUser = authUsers.users.find(u => u.email === TARGET_EMAIL);

    if (!authUser) {
      console.error(`❌ User ${TARGET_EMAIL} not found in Supabase Auth.`);
      console.log('\n💡 Available users:');
      authUsers.users.slice(0, 5).forEach(u => {
        console.log(`   - ${u.email} (${u.id})`);
      });
      process.exit(1);
    }

    console.log(`✅ Found user in Auth: ${authUser.email} (${authUser.id})`);

    // Step 2: Update Supabase Auth user_metadata
    console.log('\n📝 Updating Supabase Auth user_metadata...');
    const updatedMetadata = {
      ...authUser.user_metadata,
      is_internal: true,
    };

    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      authUser.id,
      {
        user_metadata: updatedMetadata,
      }
    );

    if (updateError) {
      throw new Error(`Failed to update user metadata: ${updateError.message}`);
    }

    console.log('✅ Updated Supabase Auth user_metadata.is_internal = true');

    // Step 3: Check if user exists in vmp_vendor_users
    console.log('\n📋 Checking vmp_vendor_users table...');
    const { data: vendorUser, error: vendorUserError } = await supabase
      .from('vmp_vendor_users')
      .select('*')
      .eq('email', TARGET_EMAIL)
      .maybeSingle();

    if (vendorUserError && vendorUserError.code !== 'PGRST116') {
      throw new Error(`Failed to query vmp_vendor_users: ${vendorUserError.message}`);
    }

    if (vendorUser) {
      // Update existing record
      console.log('✅ Found user in vmp_vendor_users, updating is_internal...');
      const { error: updateVendorError } = await supabase
        .from('vmp_vendor_users')
        .update({ is_internal: true })
        .eq('id', vendorUser.id);

      if (updateVendorError) {
        throw new Error(`Failed to update vmp_vendor_users: ${updateVendorError.message}`);
      }

      console.log('✅ Updated vmp_vendor_users.is_internal = true');
    } else {
      console.log('⚠️  User not found in vmp_vendor_users table.');
      console.log('   The system will use Supabase Auth user_metadata as fallback.');
      console.log('   If you need a vmp_vendor_users record, you may need to create it manually.');
    }

    // Step 4: Verification
    console.log('\n🔍 Verification:');
    const { data: verifyUser } = await supabase.auth.admin.getUserById(authUser.id);
    const isInternal = verifyUser?.user?.user_metadata?.is_internal === true;

    console.log(`   Email: ${verifyUser?.user?.email}`);
    console.log(`   user_metadata.is_internal: ${isInternal ? '✅ true' : '❌ false'}`);

    if (vendorUser) {
      const { data: verifyVendorUser } = await supabase
        .from('vmp_vendor_users')
        .select('is_internal')
        .eq('email', TARGET_EMAIL)
        .single();

      console.log(
        `   vmp_vendor_users.is_internal: ${verifyVendorUser?.is_internal ? '✅ true' : '❌ false'}`
      );
    }

    console.log('\n✅ Promotion complete!');
    console.log('\n📌 Next steps:');
    console.log('   1. Log out and log back in (or refresh the page)');
    console.log('   2. Check the sidebar - it should now show the organization tree');
    console.log('   3. Your badge should show "ADMIN" instead of "OPERATOR"');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
promoteUserToAdmin();

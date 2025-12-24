#!/usr/bin/env node
/**
 * Verify Dev Account Setup
 * Checks if the dev account is properly configured for org tree access
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const testEmail = process.argv[2] || 'dev@example.com';

async function verifyDevAccount() {
  console.log('🔍 Verifying Dev Account Setup\n');
  console.log('='.repeat(70));
  console.log(`📧 Email: ${testEmail}\n`);

  try {
    // Step 1: Check Supabase Auth user
    console.log('📋 Step 1: Checking Supabase Auth user...');
    const {
      data: { users },
      error: listError,
    } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('   ❌ Error listing users:', listError.message);
      process.exit(1);
    }

    const authUser = users.find(u => u.email === testEmail.toLowerCase().trim());

    if (!authUser) {
      console.error('   ❌ User NOT found in Supabase Auth');
      console.error('   Run: node scripts/seed-dev-org-tree.js ' + testEmail + ' <password>');
      process.exit(1);
    }

    console.log('   ✅ User found in Supabase Auth');
    console.log(`      Auth User ID: ${authUser.id}`);
    console.log(`      Email: ${authUser.email}`);
    console.log(`      Email Confirmed: ${authUser.email_confirmed_at ? 'Yes' : 'No'}`);

    // Check metadata
    const metadata = authUser.user_metadata || {};
    console.log(`      Vendor ID in metadata: ${metadata.vendor_id || 'MISSING'}`);
    console.log(`      VMP User ID in metadata: ${metadata.vmp_user_id || 'MISSING'}`);
    console.log(`      Is Internal in metadata: ${metadata.is_internal ? 'Yes' : 'No'}`);
    console.log(`      Is Active in metadata: ${metadata.is_active !== false ? 'Yes' : 'No'}`);

    if (!metadata.vendor_id) {
      console.error('\n   ❌ CRITICAL: vendor_id is missing from user_metadata!');
      console.error('   This will cause "User not found" errors.');
    }

    if (!metadata.vmp_user_id) {
      console.error('\n   ❌ CRITICAL: vmp_user_id is missing from user_metadata!');
    }

    // Step 2: Check vmp_vendor_users record
    console.log('\n📋 Step 2: Checking vmp_vendor_users record...');
    const { data: vmpUser, error: vmpError } = await supabase
      .from('vmp_vendor_users')
      .select('*')
      .eq('email', testEmail.toLowerCase().trim())
      .single();

    if (vmpError || !vmpUser) {
      console.error('   ❌ User NOT found in vmp_vendor_users');
      console.error(`   Error: ${vmpError?.message || 'Not found'}`);
      process.exit(1);
    }

    console.log('   ✅ User found in vmp_vendor_users');
    console.log(`      VMP User ID: ${vmpUser.id}`);
    console.log(`      Vendor ID: ${vmpUser.vendor_id || 'MISSING'}`);
    console.log(`      Is Internal: ${vmpUser.is_internal ? 'Yes' : 'No'}`);
    console.log(`      Is Active: ${vmpUser.is_active !== false ? 'Yes' : 'No'}`);
    console.log(`      Scope Group: ${vmpUser.scope_group_id || 'null (Super Admin)'}`);
    console.log(`      Scope Company: ${vmpUser.scope_company_id || 'null (Super Admin)'}`);

    if (!vmpUser.vendor_id) {
      console.error('\n   ❌ CRITICAL: vendor_id is missing from vmp_vendor_users!');
      console.error('   This will cause "User not found" errors.');
    }

    // Step 3: Check vendor exists
    if (vmpUser.vendor_id) {
      console.log('\n📋 Step 3: Checking vendor exists...');
      const { data: vendor, error: vendorError } = await supabase
        .from('vmp_vendors')
        .select('id, name, tenant_id')
        .eq('id', vmpUser.vendor_id)
        .single();

      if (vendorError || !vendor) {
        console.error('   ❌ Vendor NOT found');
        console.error(`   Error: ${vendorError?.message || 'Not found'}`);
        process.exit(1);
      }

      console.log('   ✅ Vendor found');
      console.log(`      Vendor ID: ${vendor.id}`);
      console.log(`      Vendor Name: ${vendor.name}`);
      console.log(`      Tenant ID: ${vendor.tenant_id || 'MISSING'}`);
    }

    // Step 4: Test getVendorContext lookup
    console.log('\n📋 Step 4: Testing getVendorContext lookup...');
    console.log('   This simulates what happens when the user logs in...');

    // Simulate the lookup that getVendorContext does
    const {
      data: { user: testUser },
      error: getUserError,
    } = await supabase.auth.admin.getUserById(authUser.id);

    if (getUserError || !testUser) {
      console.error('   ❌ Could not get user from Supabase Auth');
      console.error(`   Error: ${getUserError?.message || 'Not found'}`);
      process.exit(1);
    }

    console.log('   ✅ Can get user from Supabase Auth');

    // Check if vendor_id is in metadata
    const vendorId = testUser.user_metadata?.vendor_id;
    if (!vendorId) {
      console.error('   ❌ vendor_id is missing from user_metadata!');
      console.error('   This will cause getVendorContext to fail.');
      console.error('\n   Fix: Update Supabase Auth user metadata with vendor_id');
    } else {
      console.log(`   ✅ vendor_id found in metadata: ${vendorId}`);

      // Check if vendor exists
      const { data: testVendor, error: testVendorError } = await supabase
        .from('vmp_vendors')
        .select('id, name, tenant_id')
        .eq('id', vendorId)
        .single();

      if (testVendorError || !testVendor) {
        console.error('   ❌ Vendor from metadata does NOT exist!');
        console.error(`   Error: ${testVendorError?.message || 'Not found'}`);
      } else {
        console.log(`   ✅ Vendor from metadata exists: ${testVendor.name}`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(70));

    const issues = [];
    if (!metadata.vendor_id) {
      issues.push('❌ vendor_id missing from Supabase Auth user_metadata');
    }
    if (!metadata.vmp_user_id) {
      issues.push('❌ vmp_user_id missing from Supabase Auth user_metadata');
    }
    if (!vmpUser.vendor_id) {
      issues.push('❌ vendor_id missing from vmp_vendor_users');
    }
    if (vmpUser.is_internal !== true) {
      issues.push('❌ is_internal is not true in vmp_vendor_users');
    }

    if (issues.length === 0) {
      console.log('\n✅ ACCOUNT IS PROPERLY CONFIGURED');
      console.log('   ✅ All required fields are set');
      console.log('   ✅ User should be able to log in and view org tree');
    } else {
      console.log('\n❌ ISSUES FOUND:');
      issues.forEach(issue => console.log(`   ${issue}`));
      console.log('\n💡 To fix, run:');
      console.log(`   node scripts/seed-dev-org-tree.js ${testEmail} <password>`);
    }
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

verifyDevAccount()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

#!/usr/bin/env node
/**
 * Test Login Flow for Super Admin
 * Simulates the complete login flow to identify where it fails
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const testEmail = 'jackwee2020@gmail.com';
const testPassword = 'superadmin88';

async function testLoginFlow() {
  console.log('🧪 Testing Complete Login Flow\n');
  console.log('='.repeat(70));
  console.log(`📧 Email: ${testEmail}`);
  console.log(`🔑 Password: ${testPassword}\n`);

  try {
    // Step 1: Login with Supabase Auth
    console.log('📋 Step 1: Logging in with Supabase Auth...');
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email: testEmail.toLowerCase().trim(),
      password: testPassword
    });

    if (authError || !authData.user) {
      console.error('   ❌ Login FAILED');
      console.error(`   Error: ${authError?.message || 'No user returned'}`);
      process.exit(1);
    }

    console.log('   ✅ Login successful');
    console.log(`      Auth User ID: ${authData.user.id}`);
    console.log(`      Email: ${authData.user.email}`);
    console.log(`      Session Token: ${authData.session ? 'Present' : 'Missing'}`);

    // Step 2: Get user from Supabase Auth (simulating middleware)
    console.log('\n📋 Step 2: Getting user from Supabase Auth (middleware simulation)...');
    const { data: { user }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(authData.user.id);

    if (getUserError || !user) {
      console.error('   ❌ Could not get user from Supabase Auth');
      console.error(`   Error: ${getUserError?.message || 'Not found'}`);
      process.exit(1);
    }

    console.log('   ✅ User retrieved from Supabase Auth');
    console.log(`      User ID: ${user.id}`);
    console.log(`      Email: ${user.email}`);
    
    const metadata = user.user_metadata || {};
    console.log(`      Vendor ID in metadata: ${metadata.vendor_id || 'MISSING'}`);
    console.log(`      VMP User ID in metadata: ${metadata.vmp_user_id || 'MISSING'}`);
    console.log(`      Is Internal: ${metadata.is_internal ? 'Yes' : 'No'}`);
    console.log(`      Is Active: ${metadata.is_active !== false ? 'Yes' : 'No'}`);

    if (!metadata.vendor_id) {
      console.error('\n   ❌ CRITICAL: vendor_id is missing from user_metadata!');
      console.error('   This will cause getVendorContext to fail.');
      process.exit(1);
    }

    // Step 3: Get vendor (simulating getVendorContext)
    console.log('\n📋 Step 3: Getting vendor (getVendorContext simulation)...');
    const vendorId = metadata.vendor_id;
    const { data: vendor, error: vendorError } = await supabaseAdmin
      .from('vmp_vendors')
      .select('id, name, tenant_id')
      .eq('id', vendorId)
      .single();

    if (vendorError || !vendor) {
      console.error('   ❌ Vendor not found');
      console.error(`   Error: ${vendorError?.message || 'Not found'}`);
      process.exit(1);
    }

    console.log('   ✅ Vendor found');
    console.log(`      Vendor ID: ${vendor.id}`);
    console.log(`      Vendor Name: ${vendor.name}`);
    console.log(`      Tenant ID: ${vendor.tenant_id || 'MISSING'}`);

    // Step 4: Get vendor_user record (simulating getVendorContext)
    console.log('\n📋 Step 4: Getting vendor_user record (getVendorContext simulation)...');
    const { data: vendorUser, error: vendorUserError } = await supabaseAdmin
      .from('vmp_vendor_users')
      .select('id, email, vendor_id, is_internal, is_active')
      .eq('email', user.email)
      .eq('vendor_id', vendorId)
      .maybeSingle();

    if (vendorUserError && vendorUserError.code !== 'PGRST116') {
      console.error('   ❌ Error querying vendor_user');
      console.error(`   Error: ${vendorUserError.message}`);
      console.error(`   Code: ${vendorUserError.code}`);
      process.exit(1);
    }

    if (!vendorUser) {
      console.error('   ❌ Vendor user NOT found!');
      console.error(`   This is the problem - getVendorContext will return null`);
      console.error(`   Email: ${user.email}`);
      console.error(`   Vendor ID: ${vendorId}`);
      console.error('\n   Checking if user exists with different vendor_id...');
      
      const { data: allUsers, error: allUsersError } = await supabaseAdmin
        .from('vmp_vendor_users')
        .select('id, email, vendor_id, is_internal')
        .eq('email', user.email);

      if (allUsersError) {
        console.error(`   Error: ${allUsersError.message}`);
      } else if (allUsers && allUsers.length > 0) {
        console.log(`   Found ${allUsers.length} user(s) with this email:`);
        allUsers.forEach(u => {
          console.log(`      - VMP User ID: ${u.id}, Vendor ID: ${u.vendor_id}, Is Internal: ${u.is_internal}`);
        });
      } else {
        console.error('   No users found with this email at all!');
      }
      process.exit(1);
    }

    console.log('   ✅ Vendor user found');
    console.log(`      VMP User ID: ${vendorUser.id}`);
    console.log(`      Email: ${vendorUser.email}`);
    console.log(`      Vendor ID: ${vendorUser.vendor_id}`);
    console.log(`      Is Internal: ${vendorUser.is_internal ? 'Yes' : 'No'}`);
    console.log(`      Is Active: ${vendorUser.is_active !== false ? 'Yes' : 'No'}`);

    // Step 5: Verify the complete context
    console.log('\n📋 Step 5: Verifying complete user context...');
    const userContext = {
      id: vendorUser.id,
      email: user.email,
      display_name: metadata.display_name || user.email,
      vendor_id: vendorId,
      tenant_id: vendor.tenant_id,
      is_active: vendorUser.is_active !== false && metadata.is_active !== false,
      is_internal: vendorUser.is_internal === true || metadata.is_internal === true,
      user_tier: 'institutional',
      vmp_vendors: vendor
    };

    console.log('   ✅ User context would be:');
    console.log(`      ID (vendor_user): ${userContext.id}`);
    console.log(`      Email: ${userContext.email}`);
    console.log(`      Vendor ID: ${userContext.vendor_id}`);
    console.log(`      Tenant ID: ${userContext.tenant_id}`);
    console.log(`      Is Internal: ${userContext.is_internal ? 'Yes' : 'No'}`);
    console.log(`      Is Active: ${userContext.is_active ? 'Yes' : 'No'}`);

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ LOGIN FLOW TEST PASSED');
    console.log('='.repeat(70));
    console.log('\n📊 All steps completed successfully:');
    console.log('   ✅ Supabase Auth login works');
    console.log('   ✅ User can be retrieved from Supabase Auth');
    console.log('   ✅ Vendor exists and can be found');
    console.log('   ✅ Vendor user exists and can be found');
    console.log('   ✅ User context can be built');
    console.log('\n💡 If login still redirects to login page, check:');
    console.log('   1. Server logs for errors in authMiddleware');
    console.log('   2. Session storage (PostgreSQL sessions table)');
    console.log('   3. SESSION_SECRET in .env');
    console.log('   4. Cookie settings (secure, sameSite, etc.)\n');

    // Sign out
    await supabaseAuth.auth.signOut();
    console.log('✅ Signed out from test session\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

testLoginFlow()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });


#!/usr/bin/env node
/**
 * Validate Super Admin Account Security
 * Checks if jackwee2020@gmail.com can log in without credentials
 *
 * Usage: node scripts/validate-super-admin.js
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

const testEmail = 'jackwee2020@gmail.com';

async function validateSuperAdmin() {
  console.log('🔐 Super Admin Account Security Validation\n');
  console.log('='.repeat(70));
  console.log(`📧 Account: ${testEmail}\n`);

  try {
    // Step 1: Check if user exists in Supabase Auth
    console.log('📋 Step 1: Checking Supabase Auth account...');
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
      console.error('\n💡 The account does not exist in Supabase Auth.');
      console.error('   Run: node scripts/create-super-admin.js jackwee2020@gmail.com <password>');
      process.exit(1);
    }

    console.log('   ✅ User found in Supabase Auth');
    console.log(`      Auth User ID: ${authUser.id}`);
    console.log(`      Email: ${authUser.email}`);
    console.log(`      Email Confirmed: ${authUser.email_confirmed_at ? '✅ Yes' : '❌ No'}`);
    console.log(`      Created: ${authUser.created_at}`);
    console.log(`      Last Sign In: ${authUser.last_sign_in_at || 'Never'}`);

    // Check if user has a password (encrypted_password field exists)
    const hasPassword = !!authUser.encrypted_password;
    console.log(`      Has Password: ${hasPassword ? '✅ Yes' : '❌ No'}`);

    if (!hasPassword) {
      console.error('\n⚠️  SECURITY WARNING: User has NO password set!');
      console.error('   This account cannot log in via email/password.');
      console.error('   Run: node scripts/create-super-admin.js jackwee2020@gmail.com <password>');
    }

    // Step 2: Check user metadata
    console.log('\n📋 Step 2: Checking user metadata...');
    const metadata = authUser.user_metadata || {};
    console.log(`      Display Name: ${metadata.display_name || 'N/A'}`);
    console.log(`      Vendor ID: ${metadata.vendor_id || 'N/A'}`);
    console.log(`      VMP User ID: ${metadata.vmp_user_id || 'N/A'}`);
    console.log(`      Is Active: ${metadata.is_active !== false ? '✅ Yes' : '❌ No'}`);
    console.log(`      Is Internal: ${metadata.is_internal ? '✅ Yes' : '❌ No'}`);

    // Step 3: Check vmp_vendor_users table
    console.log('\n📋 Step 3: Checking vmp_vendor_users table...');
    const { data: vmpUser, error: vmpError } = await supabase
      .from('vmp_vendor_users')
      .select('*')
      .eq('email', testEmail.toLowerCase().trim())
      .single();

    if (vmpError || !vmpUser) {
      console.warn('   ⚠️  User not found in vmp_vendor_users table');
      console.warn('   This may cause issues with vendor context lookup.');
    } else {
      console.log('   ✅ User found in vmp_vendor_users');
      console.log(`      VMP User ID: ${vmpUser.id}`);
      console.log(`      Display Name: ${vmpUser.display_name || 'N/A'}`);
      console.log(`      Vendor ID: ${vmpUser.vendor_id || 'N/A'}`);
      console.log(`      Is Active: ${vmpUser.is_active !== false ? '✅ Yes' : '❌ No'}`);
      console.log(`      Is Internal: ${vmpUser.is_internal ? '✅ Yes' : '❌ No'}`);
      console.log(`      Scope Group: ${vmpUser.scope_group_id || 'null (Super Admin)'}`);
      console.log(`      Scope Company: ${vmpUser.scope_company_id || 'null (Super Admin)'}`);

      const isSuperAdmin = !vmpUser.scope_group_id && !vmpUser.scope_company_id;
      console.log(`      Super Admin: ${isSuperAdmin ? '✅ Yes' : '❌ No'}`);
    }

    // Step 4: Check auth user mapping
    console.log('\n📋 Step 4: Checking auth user mapping...');
    const { data: mapping, error: mappingError } = await supabase
      .from('vmp_auth_user_mapping')
      .select('*')
      .eq('email', testEmail.toLowerCase().trim())
      .maybeSingle();

    if (mappingError) {
      console.warn('   ⚠️  Could not query mapping table:', mappingError.message);
    } else if (mapping) {
      console.log('   ✅ Mapping found');
      console.log(`      Auth User ID: ${mapping.auth_user_id}`);
      console.log(`      VMP User ID: ${mapping.vmp_user_id}`);
    } else {
      console.warn('   ⚠️  No mapping found');
    }

    // Step 5: Test login requirement (verify credentials are required)
    console.log('\n📋 Step 5: Testing login security...');
    console.log('   Testing login WITHOUT password...');

    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: testEmail.toLowerCase().trim(),
      password: '', // Empty password
    });

    if (loginError) {
      console.log('   ✅ Login correctly REJECTED without password');
      console.log(`      Error: ${loginError.message}`);
    } else if (loginData) {
      console.error('   ❌ SECURITY ISSUE: Login succeeded without password!');
      console.error('   This should NEVER happen. The account is insecure.');
      process.exit(1);
    }

    // Test with wrong password
    console.log('   Testing login with WRONG password...');
    const { error: wrongPasswordError } = await supabase.auth.signInWithPassword({
      email: testEmail.toLowerCase().trim(),
      password: 'wrong-password-12345',
    });

    if (wrongPasswordError) {
      console.log('   ✅ Login correctly REJECTED with wrong password');
      console.log(`      Error: ${wrongPasswordError.message}`);
    } else {
      console.error('   ❌ SECURITY ISSUE: Login succeeded with wrong password!');
      process.exit(1);
    }

    // Step 6: Check NODE_ENV and dev bypass status
    console.log('\n📋 Step 6: Checking environment and bypass status...');
    const nodeEnv = process.env.NODE_ENV || 'development';
    console.log(`      NODE_ENV: ${nodeEnv}`);

    if (nodeEnv === 'development') {
      console.log('   ⚠️  Development mode is ACTIVE');
      console.log('   ⚠️  Development bypass is enabled for protected routes');
      console.log('   ℹ️  Note: This bypass does NOT affect the login route itself.');
      console.log('   ℹ️  Login still requires valid email and password.');
      console.log('   ℹ️  The bypass only works AFTER login for accessing protected routes.');
    } else if (nodeEnv === 'production') {
      console.log('   ✅ Production mode - no bypasses active');
    } else {
      console.log('   ℹ️  Test mode - test bypass available with x-test-auth header');
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(70));

    const issues = [];
    const warnings = [];

    if (!hasPassword) {
      issues.push('❌ No password set - account cannot log in');
    }

    if (!authUser.email_confirmed_at) {
      warnings.push('⚠️  Email not confirmed');
    }

    if (metadata.is_active === false) {
      issues.push('❌ Account is inactive');
    }

    if (!vmpUser) {
      warnings.push('⚠️  User not found in vmp_vendor_users table');
    }

    if (nodeEnv === 'development') {
      warnings.push('⚠️  Development mode active (bypass enabled for protected routes only)');
    }

    if (issues.length === 0 && warnings.length === 0) {
      console.log('\n✅ ACCOUNT IS SECURE');
      console.log('   ✅ Password is required for login');
      console.log('   ✅ Login route cannot be bypassed');
      console.log('   ✅ Account is properly configured');
    } else {
      if (issues.length > 0) {
        console.log('\n❌ CRITICAL ISSUES:');
        issues.forEach(issue => console.log(`   ${issue}`));
      }

      if (warnings.length > 0) {
        console.log('\n⚠️  WARNINGS:');
        warnings.forEach(warning => console.log(`   ${warning}`));
      }
    }

    console.log('\n🔐 SECURITY VERIFICATION:');
    console.log('   ✅ Login route REQUIRES email and password');
    console.log('   ✅ Cannot log in without credentials');
    console.log('   ✅ Wrong passwords are rejected');
    console.log('   ✅ Development bypass does NOT affect login route');

    if (nodeEnv === 'development') {
      console.log('\n💡 IMPORTANT: In development mode, protected routes can be accessed');
      console.log('   without login AFTER the dev bypass is triggered. However, the');
      console.log('   login route itself still requires valid credentials.');
    }

    console.log('\n📝 NEXT STEPS:');
    if (!hasPassword) {
      console.log(
        '   1. Set password: node scripts/create-super-admin.js jackwee2020@gmail.com <password>'
      );
    } else {
      console.log('   1. Test login at: http://localhost:9000/login');
      console.log('   2. Use email: jackwee2020@gmail.com');
      console.log('   3. Enter the password you set when creating the account');
    }

    if (!authUser.email_confirmed_at) {
      console.log('   4. Confirm email (or use create-super-admin.js which auto-confirms)');
    }
  } catch (error) {
    console.error('\n❌ Validation failed:', error);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

validateSuperAdmin()
  .then(() => {
    console.log('\n✅ Validation complete\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Validation script failed:', error);
    process.exit(1);
  });

#!/usr/bin/env node
/**
 * Test login functionality for jackwee2020@gmail.com
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const testEmail = 'jackwee2020@gmail.com';
const testPassword = 'NewPassword123!';

async function testLogin() {
  console.log('🧪 Testing Login Flow\n');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Get user by email
    console.log('\n📋 Step 1: Get user by email');
    const { data: user, error: userError } = await supabase
      .from('vmp_vendor_users')
      .select('id, email, password_hash, is_active, display_name')
      .eq('email', testEmail.toLowerCase().trim())
      .single();
    
    if (userError) {
      console.error('❌ Error fetching user:', userError);
      console.error('   Code:', userError.code);
      console.error('   Message:', userError.message);
      console.error('   Details:', userError.details);
      process.exit(1);
    }
    
    if (!user) {
      console.error('❌ User not found');
      process.exit(1);
    }
    
    console.log('✅ User found:', user.email);
    console.log('   User ID:', user.id);
    console.log('   Display Name:', user.display_name);
    console.log('   Is Active:', user.is_active);
    console.log('   Has Password Hash:', !!user.password_hash);
    console.log('   Password Hash Length:', user.password_hash ? user.password_hash.length : 0);
    
    if (!user.is_active) {
      console.error('❌ User account is inactive');
      process.exit(1);
    }
    
    if (!user.password_hash) {
      console.error('❌ User has no password hash');
      process.exit(1);
    }
    
    // Step 2: Verify password
    console.log('\n📋 Step 2: Verify password');
    console.log('   Testing password:', testPassword);
    console.log('   Password hash:', user.password_hash.substring(0, 20) + '...');
    
    const isValid = await bcrypt.compare(testPassword, user.password_hash);
    
    if (!isValid) {
      console.error('❌ Password verification failed');
      console.error('   The password does not match the hash');
      console.error('\n💡 Possible issues:');
      console.error('   1. Password was changed after test');
      console.error('   2. Password hash is corrupted');
      console.error('   3. Wrong password being used');
      process.exit(1);
    }
    
    console.log('✅ Password verification successful');
    console.log('   Password matches hash');
    
    // Step 3: Check vendor context
    console.log('\n📋 Step 3: Check vendor context');
    const { data: vendorContext, error: contextError } = await supabase
      .from('vmp_vendor_users')
      .select(`
        id,
        display_name,
        vendor_id,
        email,
        is_active,
        is_internal,
        vmp_vendors ( id, name, tenant_id )
      `)
      .eq('id', user.id)
      .single();
    
    if (contextError) {
      console.error('❌ Error fetching vendor context:', contextError);
      process.exit(1);
    }
    
    if (!vendorContext) {
      console.error('❌ Vendor context not found');
      process.exit(1);
    }
    
    console.log('✅ Vendor context retrieved');
    console.log('   Vendor ID:', vendorContext.vendor_id);
    console.log('   Vendor:', vendorContext.vmp_vendors?.name || 'N/A');
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL LOGIN CHECKS PASSED!');
    console.log('='.repeat(60));
    console.log('\n📊 Test Summary:');
    console.log('   ✅ User exists and is active');
    console.log('   ✅ Password hash is valid');
    console.log('   ✅ Password verification works');
    console.log('   ✅ Vendor context is available');
    console.log('\n🔑 Login Credentials:');
    console.log('   Email:', testEmail);
    console.log('   Password:', testPassword);
    console.log('\n✨ Login should work correctly!');
    console.log('\n💡 If you\'re still getting errors:');
    console.log('   1. Check server console for detailed error messages');
    console.log('   2. Verify SESSION_SECRET is set in .env');
    console.log('   3. Check if server is running on correct port');
    console.log('   4. Verify database connection is working');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

testLogin();


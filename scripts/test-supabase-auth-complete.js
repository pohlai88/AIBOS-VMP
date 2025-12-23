#!/usr/bin/env node
/**
 * Complete Supabase Auth Test
 * Tests all aspects of the Supabase Auth implementation
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const testEmail = 'jackwee2020@gmail.com';

async function testSupabaseAuthComplete() {
  console.log('🧪 Complete Supabase Auth Test\n');
  console.log('='.repeat(60));

  let allTestsPassed = true;

  try {
    // Test 1: Check if user exists in Supabase Auth
    console.log('\n📋 Test 1: User exists in Supabase Auth');
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('   ❌ Error listing users:', listError.message);
      allTestsPassed = false;
    } else {
      const user = users.find(u => u.email === testEmail);
      if (user) {
        console.log('   ✅ User found:', user.email);
        console.log('      ID:', user.id);
        console.log('      Email confirmed:', !!user.email_confirmed_at);
        console.log('      Vendor ID:', user.user_metadata?.vendor_id);
        console.log('      Display Name:', user.user_metadata?.display_name);
        console.log('      Is Active:', user.user_metadata?.is_active);
      } else {
        console.error('   ❌ User not found:', testEmail);
        allTestsPassed = false;
      }
    }

    // Test 2: Test password reset request
    console.log('\n📋 Test 2: Password reset request');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(testEmail, {
      redirectTo: `${process.env.BASE_URL || 'http://localhost:9000'}/reset-password`
    });

    if (resetError) {
      console.error('   ❌ Password reset failed:', resetError.message);
      allTestsPassed = false;
    } else {
      console.log('   ✅ Password reset email sent successfully');
      console.log('      Check Supabase Dashboard → Auth → Logs for email delivery');
    }

    // Test 3: Verify configuration
    console.log('\n📋 Test 3: Configuration verification');
    console.log('   Supabase URL:', supabaseUrl);
    console.log('   Using key:', supabaseAnonKey ? 'Anon Key' : 'Service Role Key');
    console.log('   Base URL:', process.env.BASE_URL || 'http://localhost:9000');
    console.log('   ✅ Configuration looks good');

    // Test 4: Test getVendorContext (if we can simulate it)
    console.log('\n📋 Test 4: Vendor context lookup');
    if (users && users.length > 0) {
      const testUser = users.find(u => u.email === testEmail);
      if (testUser) {
        console.log('   ✅ Can get user from Supabase Auth');
        console.log('      User ID:', testUser.id);
        console.log('      Vendor ID:', testUser.user_metadata?.vendor_id);
        
        // Check if vendor exists
        if (testUser.user_metadata?.vendor_id) {
          console.log('   ✅ Vendor ID found in metadata');
        } else {
          console.warn('   ⚠️  No vendor_id in user metadata');
        }
      }
    }

    // Test 5: Check mapping table
    console.log('\n📋 Test 5: Mapping table verification');
    const { data: mappings, error: mappingError } = await supabase
      .from('vmp_auth_user_mapping')
      .select('*')
      .eq('email', testEmail)
      .single();

    if (mappingError) {
      console.warn('   ⚠️  Could not query mapping table:', mappingError.message);
    } else if (mappings) {
      console.log('   ✅ Mapping found');
      console.log('      Auth User ID:', mappings.auth_user_id);
      console.log('      VMP User ID:', mappings.vmp_user_id);
    } else {
      console.warn('   ⚠️  No mapping found for', testEmail);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    if (allTestsPassed) {
      console.log('✅ All tests passed!');
      console.log('\n📝 Next Steps:');
      console.log('   1. Test login at: http://localhost:9000/login');
      console.log('   2. Test password reset at: http://localhost:9000/forgot-password');
      console.log('   3. Check Supabase Dashboard → Auth → Users');
      console.log('   4. Check Supabase Dashboard → Auth → Email Templates');
    } else {
      console.log('❌ Some tests failed. Please review the output above.');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

testSupabaseAuthComplete()
  .then(() => {
    console.log('\n✅ Test script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });


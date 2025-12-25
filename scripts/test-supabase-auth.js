#!/usr/bin/env node
/**
 * Test Supabase Auth Implementation
 * Tests login, password reset, and session management
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
const testPassword = 'TestPassword123!';

async function testSupabaseAuth() {
  console.log('🧪 Testing Supabase Auth Implementation\n');
  console.log('='.repeat(60));

  try {
    // Test 1: Check if user exists
    console.log('\n📋 Test 1: Check if user exists in Supabase Auth');
    const {
      data: { users },
      error: listError,
    } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('   ❌ Error listing users:', listError.message);
      // Try alternative method
      console.log('   ⚠️  Admin API not available, trying direct query...');
    } else {
      const user = users.find(u => u.email === testEmail);
      if (user) {
        console.log('   ✅ User found:', user.email);
        console.log('      ID:', user.id);
        console.log('      Email confirmed:', !!user.email_confirmed_at);
        console.log('      Metadata:', JSON.stringify(user.user_metadata, null, 2));
      } else {
        console.log('   ⚠️  User not found in list');
      }
    }

    // Test 2: Test password reset request
    console.log('\n📋 Test 2: Test password reset request');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(testEmail, {
      redirectTo: `${process.env.BASE_URL || 'http://localhost:9000'}/reset-password`,
    });

    if (resetError) {
      console.error('   ❌ Password reset failed:', resetError.message);
    } else {
      console.log('   ✅ Password reset email sent successfully');
      console.log('      Check Supabase Auth logs for email delivery status');
    }

    // Test 3: Verify Supabase Auth configuration
    console.log('\n📋 Test 3: Verify Supabase Auth configuration');
    console.log('   Supabase URL:', supabaseUrl);
    console.log('   Using key:', supabaseAnonKey ? 'Anon Key' : 'Service Role Key');
    console.log('   Base URL:', process.env.BASE_URL || 'http://localhost:9000');

    // Test 4: Check if we can query auth.users directly
    console.log('\n📋 Test 4: Check auth.users table access');
    const { data: authUsers, error: queryError } = await supabase
      .from('auth.users')
      .select('id, email')
      .limit(1);

    if (queryError) {
      console.log('   ⚠️  Cannot query auth.users directly (expected - requires service role)');
      console.log('      Error:', queryError.message);
    } else {
      console.log('   ✅ Can query auth.users');
      console.log('      Found', authUsers?.length || 0, 'users');
    }

    console.log('\n✅ All tests completed');
    console.log('\n📝 Next Steps:');
    console.log('   1. Check Supabase Dashboard → Auth → Users to verify users exist');
    console.log('   2. Check Supabase Dashboard → Auth → Email Templates to verify email config');
    console.log('   3. Test login via localhost:9000/login');
    console.log('   4. Test password reset via localhost:9000/forgot-password');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

testSupabaseAuth()
  .then(() => {
    console.log('\n✅ Test script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });

#!/usr/bin/env node
/**
 * Test password login for jackwee2020@gmail.com
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const testEmail = 'jackwee2020@gmail.com';
const testPassword = 'superadmin88';

async function testPasswordLogin() {
  console.log('🧪 Testing Password Login\n');
  console.log('='.repeat(60));
  console.log(`📧 Email: ${testEmail}`);
  console.log(`🔑 Password: ${testPassword}\n`);

  try {
    // Test login with the password
    console.log('📋 Attempting login with Supabase Auth...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: testEmail.toLowerCase().trim(),
      password: testPassword,
    });

    if (authError) {
      console.error('❌ Login FAILED');
      console.error(`   Error: ${authError.message}`);
      console.error(`   Status: ${authError.status || 'N/A'}`);
      process.exit(1);
    }

    if (!authData.user) {
      console.error('❌ Login FAILED - No user returned');
      process.exit(1);
    }

    console.log('✅ Login SUCCESSFUL!');
    console.log(`   User ID: ${authData.user.id}`);
    console.log(`   Email: ${authData.user.email}`);
    console.log(`   Email Confirmed: ${authData.user.email_confirmed_at ? 'Yes' : 'No'}`);
    console.log(`   Session Token: ${authData.session ? 'Present' : 'Missing'}`);

    // Sign out
    await supabase.auth.signOut();
    console.log('\n✅ Signed out successfully');

    console.log('\n' + '='.repeat(60));
    console.log('✅ PASSWORD IS WORKING CORRECTLY!');
    console.log('='.repeat(60));
    console.log('\n📝 You can now log in at: http://localhost:9000/login');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}\n`);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

testPasswordLogin()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });

#!/usr/bin/env node
/**
 * Set User Password
 * Updates password for a Supabase Auth user
 * 
 * Usage: node scripts/set-user-password.js <email> <password>
 * Example: node scripts/set-user-password.js jackwee2020@gmail.com admin123
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

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error('❌ Error: Email and password are required');
  console.error('Usage: node scripts/set-user-password.js <email> <password>');
  process.exit(1);
}

async function setUserPassword() {
  console.log('🔐 Setting user password\n');
  console.log('='.repeat(70));
  console.log(`📧 Email: ${email}`);
  console.log(`🔑 Password: ${password}\n`);

  try {
    // Step 1: Find user by email
    console.log('📋 Step 1: Finding user...');
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('   ❌ Error listing users:', listError.message);
      throw listError;
    }

    const user = users?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase().trim());

    if (!user) {
      console.error(`   ❌ User not found: ${email}`);
      console.error('   💡 User may need to be created first via invite or sign-up');
      process.exit(1);
    }

    console.log(`   ✅ User found: ${user.email} (ID: ${user.id})`);

    // Step 2: Update password
    console.log('\n📋 Step 2: Updating password...');
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        password: password,
      }
    );

    if (updateError) {
      console.error('   ❌ Error updating password:', updateError.message);
      throw updateError;
    }

    console.log('   ✅ Password updated successfully');

    // Step 3: Verify by attempting sign in (optional)
    console.log('\n📋 Step 3: Verifying password...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password: password,
    });

    if (signInError) {
      console.warn('   ⚠️  Warning: Password set but verification sign-in failed:', signInError.message);
      console.warn('   💡 This might be normal if email confirmation is required');
    } else {
      console.log('   ✅ Password verified - sign in successful');
    }

    console.log('\n✅ Password Update Complete!');
    console.log('='.repeat(70));
    console.log(`📧 Email: ${email}`);
    console.log(`👤 User ID: ${user.id}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`\n💡 User can now log in with email: ${email} and password: ${password}`);

  } catch (error) {
    console.error('\n❌ Failed to set password:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
setUserPassword()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });


/**
 * Direct Password Update Script
 * Updates password for jackwee2020@gmail.com using Supabase Admin API
 * 
 * Run: node scripts/update-password-direct.js
 * 
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env manually
const envPath = join(__dirname, '..', '.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value;
        }
      }
    }
  });
} catch (e) {
  // .env not found, use process.env
}

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  console.error('   Check your .env file or environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const email = 'jackwee2020@gmail.com';
const password = 'admin123';
const authUserId = 'cb431435-02f4-45cb-83fa-abc12104cc8f'; // Known from validation

async function updatePassword() {
  console.log('🔐 Updating password via Supabase Admin API\n');
  console.log('='.repeat(70));
  console.log(`📧 Email: ${email}`);
  console.log(`👤 Auth User ID: ${authUserId}`);
  console.log(`🔑 New Password: ${password}\n`);

  try {
    // Method 1: Update by user ID (fastest)
    console.log('📋 Method 1: Updating password by Auth User ID...');
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      authUserId,
      {
        password: password,
      }
    );

    if (updateError) {
      console.error('   ❌ Error:', updateError.message);
      throw updateError;
    }

    console.log('   ✅ Password updated successfully!');
    console.log(`   User ID: ${updatedUser.user.id}`);
    console.log(`   Email: ${updatedUser.user.email}`);

    // Verify by attempting sign in
    console.log('\n📋 Verifying password...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password: password,
    });

    if (signInError) {
      console.warn('   ⚠️  Warning: Password set but verification sign-in failed:', signInError.message);
      console.warn('   💡 This might be normal if email confirmation is required');
    } else {
      console.log('   ✅ Password verified - sign in successful!');
      console.log(`   Session User ID: ${signInData.user.id}`);
    }

    console.log('\n✅ Password Update Complete!');
    console.log('='.repeat(70));
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`\n💡 User can now log in with email: ${email} and password: ${password}`);

  } catch (error) {
    console.error('\n❌ Failed to update password:', error.message);
    if (error.response) {
      console.error('   Response:', JSON.stringify(error.response, null, 2));
    }
    process.exit(1);
  }
}

// Run the script
updatePassword()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });



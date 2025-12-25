/**
 * Quick Password Setup for jackwee2020@gmail.com
 * This script sets the password directly using Supabase Admin API
 * 
 * Run: node scripts/setup-jack-password.js
 * 
 * Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are in .env
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const email = 'jackwee2020@gmail.com';
const password = 'admin123';

(async () => {
  try {
    console.log(`🔐 Setting password for ${email}...\n`);
    
    // List all users to find the one we need
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;
    
    const user = users?.find(u => u.email?.toLowerCase() === email.toLowerCase().trim());
    
    if (!user) {
      console.log('👤 User not found in Supabase Auth, creating...');
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password: password,
        email_confirm: true,
        user_metadata: {
          vendor_id: '20000000-0000-0000-0000-000000000001',
          user_tier: 'institutional',
          is_internal: true,
          is_active: true,
          display_name: 'Jack Wee',
        },
      });
      
      if (createError) throw createError;
      console.log('✅ User created successfully!');
      console.log(`   User ID: ${newUser.user.id}`);
      console.log(`   Email: ${newUser.user.email}`);
      console.log(`   Password: ${password}`);
    } else {
      console.log(`👤 User found: ${user.email} (ID: ${user.id})`);
      console.log('🔑 Updating password...');
      
      const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
        password: password,
      });
      
      if (updateError) throw updateError;
      console.log('✅ Password updated successfully!');
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
    }
    
    console.log('\n✨ Done! User can now login with:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('   Response:', error.response);
    }
    process.exit(1);
  }
})();


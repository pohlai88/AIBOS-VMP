import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkAuthUser() {
  try {
    const { data: users, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error('Error listing users:', error);
      process.exit(1);
    }

    const user = users.users.find(u => u.email === 'jackwee2020@gmail.com');

    if (!user) {
      console.log('❌ User not found in Supabase Auth');
      process.exit(1);
    }

    console.log('✅ Supabase Auth User Found:');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Email Confirmed:', user.email_confirmed_at ? 'Yes' : 'No');
    console.log('Created:', user.created_at);
    console.log('\nUser Metadata:');
    console.log(JSON.stringify(user.user_metadata, null, 2));

    console.log('\n--- Checking Required Fields ---');
    console.log('✓ vendor_id:', user.user_metadata?.vendor_id || '❌ MISSING');
    console.log('✓ display_name:', user.user_metadata?.display_name || '❌ MISSING');
    console.log('✓ is_active:', user.user_metadata?.is_active);
    console.log('✓ is_internal:', user.user_metadata?.is_internal);
    console.log('✓ is_super_admin:', user.user_metadata?.is_super_admin);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkAuthUser();

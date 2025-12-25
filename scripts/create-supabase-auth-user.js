import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createSupabaseAuthUser() {
  try {
    const email = 'jackwee2020@gmail.com';
    const password = 'admin123';

    // First, get the user from vmp_vendor_users
    const { data: vmpUser, error: vmpError } = await supabase
      .from('vmp_vendor_users')
      .select('*')
      .eq('email', email)
      .single();

    if (vmpError || !vmpUser) {
      console.error('User not found in vmp_vendor_users:', vmpError);
      process.exit(1);
    }

    console.log('Found VMP user:', {
      id: vmpUser.id,
      email: vmpUser.email,
      display_name: vmpUser.display_name,
      vendor_id: vmpUser.vendor_id
    });

    // Check if auth user already exists
    const { data: existingAuthUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
    } else {
      const existingUser = existingAuthUsers.users.find(u => u.email === email);
      if (existingUser) {
        console.log('\n⚠️  Auth user already exists. Updating password and metadata...');
        
        // Update existing user
        const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
          existingUser.id,
          {
            password: password,
            email_confirm: true,
            user_metadata: {
              vendor_id: vmpUser.vendor_id,
              display_name: vmpUser.display_name,
              is_active: vmpUser.is_active,
              is_internal: vmpUser.is_internal,
              is_super_admin: vmpUser.is_super_admin,
            }
          }
        );

        if (updateError) {
          console.error('Error updating auth user:', updateError);
          process.exit(1);
        }

        console.log('✅ Successfully updated Supabase Auth user');
        console.log('Auth User ID:', updateData.user.id);
        console.log('\nLogin credentials:');
        console.log('Email:', email);
        console.log('Password:', password);
        return;
      }
    }

    // Create new auth user
    console.log('\nCreating new Supabase Auth user...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        vendor_id: vmpUser.vendor_id,
        display_name: vmpUser.display_name,
        is_active: vmpUser.is_active,
        is_internal: vmpUser.is_internal,
        is_super_admin: vmpUser.is_super_admin,
      }
    });

    if (authError) {
      console.error('Error creating Supabase Auth user:', authError);
      process.exit(1);
    }

    console.log('✅ Successfully created Supabase Auth user');
    console.log('Auth User ID:', authData.user.id);
    console.log('\nLogin credentials:');
    console.log('Email:', email);
    console.log('Password:', password);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

createSupabaseAuthUser();

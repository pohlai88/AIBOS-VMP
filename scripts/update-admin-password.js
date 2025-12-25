import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateAdminPassword() {
  try {
    // Hash the password using bcrypt (same as used in the app)
    const password = 'admin123';
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    console.log('Generated bcrypt hash:', passwordHash);

    // Update the super admin user's password
    const { data, error } = await supabase
      .from('vmp_vendor_users')
      .update({ password_hash: passwordHash })
      .eq('email', 'jackwee2020@gmail.com')
      .select();

    if (error) {
      console.error('Error updating password:', error);
      process.exit(1);
    }

    console.log('✅ Successfully updated admin password');
    console.log('User:', data[0]);
    console.log('\nLogin credentials:');
    console.log('Email: jackwee2020@gmail.com');
    console.log('Password: admin123');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

updateAdminPassword();

/**
 * Quick Password Reset Script
 * Run this with: node -e "import('./scripts/reset-password-quick.js')"
 * Or use: node --input-type=module -e "$(cat scripts/reset-password-quick.js)"
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
const envPath = join(__dirname, '..', '.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  });
} catch (e) {
  // .env not found, use process.env
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
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

async function resetPassword() {
  console.log('🔐 Resetting password for:', email);
  
  try {
    // Find user
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;
    
    const user = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) {
      console.error('❌ User not found in Supabase Auth');
      console.log('💡 Creating user...');
      
      // Create user if doesn't exist
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password: password,
        email_confirm: true,
        user_metadata: {
          vendor_id: '20000000-0000-0000-0000-000000000001',
          user_tier: 'institutional',
          is_internal: true,
          is_active: true,
        },
      });
      
      if (createError) throw createError;
      console.log('✅ User created with password:', password);
      return;
    }
    
    // Update password
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: password,
    });
    
    if (updateError) throw updateError;
    console.log('✅ Password updated successfully');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetPassword();


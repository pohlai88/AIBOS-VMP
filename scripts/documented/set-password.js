#!/usr/bin/env node
/**
 * Helper script to set/update password for a vendor user
 * Usage: node scripts/set-password.js <email> <password>
 * Example: node scripts/set-password.js admin@acme.com   testpassword123
 */

import bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: node scripts/set-password.js <email> <password>');
  console.error('Example: node scripts/set-password.js admin@acme.com testpassword123');
  process.exit(1);
}

async function setPassword() {
  try {
    // Hash the password
    console.log('Hashing password...');
    const passwordHash = await bcrypt.hash(password, 10);

    // Update the user
    console.log(`Updating password for ${email}...`);
    const { data, error } = await supabase
      .from('vmp_vendor_users')
      .update({ password_hash: passwordHash })
      .eq('email', email.toLowerCase().trim())
      .select();

    if (error) {
      console.error('Error updating password:', error);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.error(`Error: User with email ${email} not found`);
      process.exit(1);
    }

    console.log('✅ Password updated successfully!');
    console.log(`User: ${data[0].email}`);
    console.log(`User ID: ${data[0].id}`);
    console.log(`\nYou can now login with:`);
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

setPassword();

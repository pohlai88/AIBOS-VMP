#!/usr/bin/env node
/**
 * Create or update Supabase Auth user for super admin
 * Usage: node scripts/create-super-admin.js <email> <password>
 * Example: node scripts/create-super-admin.js jackwee2020@gmail.com admin123
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
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
  console.error('Usage: node scripts/create-super-admin.js <email> <password>');
  console.error('Example: node scripts/create-super-admin.js jackwee2020@gmail.com admin123');
  process.exit(1);
}

async function createSuperAdmin() {
  try {
    console.log(`\n🔧 Setting up super admin: ${email}\n`);

    // 1. Get user from vmp_vendor_users
    console.log('1. Checking vmp_vendor_users...');
    const { data: vmpUser, error: vmpError } = await supabase
      .from('vmp_vendor_users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (vmpError || !vmpUser) {
      console.error(`❌ User not found in vmp_vendor_users: ${vmpError?.message || 'Not found'}`);
      process.exit(1);
    }

    console.log(`   ✅ Found user: ${vmpUser.display_name || vmpUser.email}`);
    console.log(`   - ID: ${vmpUser.id}`);
    console.log(`   - Vendor ID: ${vmpUser.vendor_id}`);
    console.log(`   - Is Internal: ${vmpUser.is_internal}`);
    console.log(`   - Scope Group: ${vmpUser.scope_group_id || 'null (Super Admin)'}`);
    console.log(`   - Scope Company: ${vmpUser.scope_company_id || 'null (Super Admin)'}`);

    // 2. Check if user exists in Supabase Auth
    console.log('\n2. Checking Supabase Auth...');
    const {
      data: { users },
      error: listError,
    } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error(`❌ Error listing users: ${listError.message}`);
      process.exit(1);
    }

    const existingAuthUser = users.find(u => u.email === email.toLowerCase().trim());

    let authUserId;
    if (existingAuthUser) {
      console.log(`   ⚠️  User already exists in Supabase Auth`);
      console.log(`   - Auth User ID: ${existingAuthUser.id}`);
      authUserId = existingAuthUser.id;

      // Update password
      console.log('\n3. Updating password...');
      const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
        authUserId,
        { password: password }
      );

      if (updateError) {
        console.error(`❌ Error updating password: ${updateError.message}`);
        process.exit(1);
      }

      console.log('   ✅ Password updated successfully');

      // Update user metadata
      const { error: metadataError } = await supabase.auth.admin.updateUserById(authUserId, {
        user_metadata: {
          display_name: vmpUser.display_name,
          vendor_id: vmpUser.vendor_id,
          vmp_user_id: vmpUser.id,
          is_active: vmpUser.is_active,
          is_internal: vmpUser.is_internal,
        },
      });

      if (metadataError) {
        console.warn(`   ⚠️  Warning: Could not update metadata: ${metadataError.message}`);
      } else {
        console.log('   ✅ User metadata updated');
      }
    } else {
      // Create new user
      console.log('   ℹ️  User not found in Supabase Auth, creating...');
      console.log('\n3. Creating Supabase Auth user...');

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        email_confirm: true, // Auto-confirm email
        password: password,
        user_metadata: {
          display_name: vmpUser.display_name,
          vendor_id: vmpUser.vendor_id,
          vmp_user_id: vmpUser.id,
          is_active: vmpUser.is_active,
          is_internal: vmpUser.is_internal,
        },
      });

      if (createError) {
        console.error(`❌ Error creating user: ${createError.message}`);
        process.exit(1);
      }

      console.log('   ✅ User created successfully');
      authUserId = newUser.user.id;
    }

    // 4. Create/update mapping
    console.log('\n4. Creating auth user mapping...');
    const { data: mapping, error: mappingError } = await supabase
      .from('vmp_auth_user_mapping')
      .upsert(
        {
          auth_user_id: authUserId,
          vmp_user_id: vmpUser.id,
          email: email.toLowerCase().trim(),
        },
        {
          onConflict: 'auth_user_id',
        }
      )
      .select()
      .single();

    if (mappingError) {
      console.warn(`   ⚠️  Warning: Could not create mapping: ${mappingError.message}`);
    } else {
      console.log('   ✅ Mapping created/updated');
    }

    // 5. Verify super admin status
    console.log('\n5. Verifying super admin status...');
    const isSuperAdmin = !vmpUser.scope_group_id && !vmpUser.scope_company_id;

    if (isSuperAdmin) {
      console.log('   ✅ User is configured as Super Admin');
      console.log('   - Can access all tenants, groups, and companies');
      console.log('   - Can edit org tree structure');
    } else {
      console.log('   ⚠️  User is NOT a super admin');
      console.log(`   - Scope Group: ${vmpUser.scope_group_id || 'null'}`);
      console.log(`   - Scope Company: ${vmpUser.scope_company_id || 'null'}`);
      console.log('\n   To make this user a super admin, run:');
      console.log(
        `   UPDATE vmp_vendor_users SET scope_group_id = NULL, scope_company_id = NULL WHERE email = '${email}';`
      );
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ SETUP COMPLETE');
    console.log('='.repeat(60));
    console.log(`\n📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`👤 Display Name: ${vmpUser.display_name || email}`);
    console.log(`🆔 Auth User ID: ${authUserId}`);
    console.log(`🆔 VMP User ID: ${vmpUser.id}`);
    console.log(`🔐 Is Internal: ${vmpUser.is_internal ? 'Yes' : 'No'}`);
    console.log(`👑 Super Admin: ${isSuperAdmin ? 'Yes' : 'No'}`);
    console.log(`\n🌐 Login at: http://localhost:9000/login`);
    console.log(`\n⚠️  Note: This password is stored in plain text in this script output.`);
    console.log(`   Change it after first login for security.\n`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createSuperAdmin();

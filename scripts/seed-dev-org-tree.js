#!/usr/bin/env node
/**
 * Seed Dev Account with Organization Tree Data
 * Creates a dev account (dev@example.com or mr@example.com) with full org tree access
 *
 * Usage: node scripts/seed-dev-org-tree.js [email] [password]
 * Example: node scripts/seed-dev-org-tree.js dev@example.com dev123
 * Example: node scripts/seed-dev-org-tree.js mr@example.com mr123
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

// Default values
const DEFAULT_EMAIL = 'dev@example.com';
const DEFAULT_PASSWORD = 'dev123';

const [email, password] = process.argv.slice(2);
const targetEmail = (email || DEFAULT_EMAIL).toLowerCase().trim();
const targetPassword = password || DEFAULT_PASSWORD;

// Tenant and Vendor IDs from seed data
const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const VENDOR_ID = '20000000-0000-0000-0000-000000000001';

async function seedDevOrgTree() {
  console.log('🌱 Seeding Dev Account with Organization Tree Data\n');
  console.log('='.repeat(70));
  console.log(`📧 Email: ${targetEmail}`);
  console.log(`🔑 Password: ${targetPassword}\n`);

  try {
    // Step 1: Ensure tenant exists
    console.log('📋 Step 1: Ensuring tenant exists...');
    const { data: tenant, error: tenantError } = await supabase
      .from('vmp_tenants')
      .select('id, name')
      .eq('id', TENANT_ID)
      .single();

    if (tenantError || !tenant) {
      console.log('   Creating tenant...');
      const { error: createTenantError } = await supabase.from('vmp_tenants').insert({
        id: TENANT_ID,
        name: 'Nexus Group',
      });

      if (createTenantError) {
        console.error('   ❌ Error creating tenant:', createTenantError.message);
        process.exit(1);
      }
      console.log('   ✅ Tenant created');
    } else {
      console.log(`   ✅ Tenant exists: ${tenant.name}`);
    }

    // Step 2: Ensure vendor exists
    console.log('\n📋 Step 2: Ensuring vendor exists...');
    const { data: vendor, error: vendorError } = await supabase
      .from('vmp_vendors')
      .select('id, name, tenant_id')
      .eq('id', VENDOR_ID)
      .single();

    if (vendorError || !vendor) {
      console.log('   Creating vendor...');
      const { error: createVendorError } = await supabase.from('vmp_vendors').insert({
        id: VENDOR_ID,
        tenant_id: TENANT_ID,
        name: 'Internal Operations',
        status: 'active',
      });

      if (createVendorError) {
        console.error('   ❌ Error creating vendor:', createVendorError.message);
        process.exit(1);
      }
      console.log('   ✅ Vendor created');
    } else {
      console.log(`   ✅ Vendor exists: ${vendor.name}`);
    }

    // Step 3: Create groups for org tree
    console.log('\n📋 Step 3: Creating organization groups...');
    const groups = [
      {
        id: '90000000-0000-0000-0000-000000000001',
        tenant_id: TENANT_ID,
        name: 'Manufacturing Division',
        code: 'MFG-DIV',
      },
      {
        id: '90000000-0000-0000-0000-000000000002',
        tenant_id: TENANT_ID,
        name: 'Distribution Division',
        code: 'DIST-DIV',
      },
    ];

    for (const group of groups) {
      const { error: groupError } = await supabase
        .from('vmp_groups')
        .upsert(group, { onConflict: 'id' });

      if (groupError) {
        console.warn(`   ⚠️  Warning creating group ${group.name}:`, groupError.message);
      } else {
        console.log(`   ✅ Group: ${group.name} (${group.code})`);
      }
    }

    // Step 4: Ensure companies exist and link to groups
    console.log('\n📋 Step 4: Ensuring companies exist and linking to groups...');
    const companies = [
      {
        id: '10000000-0000-0000-0000-000000000001',
        tenant_id: TENANT_ID,
        name: 'Nexus Manufacturing',
        legal_name: 'Nexus Manufacturing Pte Ltd',
        country_code: 'SG',
        currency_code: 'SGD',
        group_id: '90000000-0000-0000-0000-000000000001', // Manufacturing Division
      },
      {
        id: '10000000-0000-0000-0000-000000000002',
        tenant_id: TENANT_ID,
        name: 'Nexus Distribution',
        legal_name: 'Nexus Distribution Sdn Bhd',
        country_code: 'MY',
        currency_code: 'MYR',
        group_id: '90000000-0000-0000-0000-000000000002', // Distribution Division
      },
    ];

    for (const company of companies) {
      const { error: companyError } = await supabase
        .from('vmp_companies')
        .upsert(company, { onConflict: 'id' });

      if (companyError) {
        console.warn(`   ⚠️  Warning creating company ${company.name}:`, companyError.message);
      } else {
        console.log(
          `   ✅ Company: ${company.name} → Group: ${company.group_id ? 'Linked' : 'Ungrouped'}`
        );
      }
    }

    // Step 5: Create or update vmp_vendor_users record
    console.log('\n📋 Step 5: Creating/updating vmp_vendor_users record...');
    const { data: existingVmpUser, error: vmpUserCheckError } = await supabase
      .from('vmp_vendor_users')
      .select('*')
      .eq('email', targetEmail)
      .maybeSingle();

    let vmpUserId;
    if (existingVmpUser) {
      console.log('   ⚠️  User already exists in vmp_vendor_users, updating...');
      vmpUserId = existingVmpUser.id;

      const { error: updateError } = await supabase
        .from('vmp_vendor_users')
        .update({
          vendor_id: VENDOR_ID,
          display_name:
            targetEmail.split('@')[0].charAt(0).toUpperCase() + targetEmail.split('@')[0].slice(1),
          is_active: true,
          is_internal: true,
          scope_group_id: null, // Super admin - no scope restrictions
          scope_company_id: null, // Super admin - no scope restrictions
        })
        .eq('id', vmpUserId);

      if (updateError) {
        console.error('   ❌ Error updating user:', updateError.message);
        process.exit(1);
      }
      console.log('   ✅ User updated');
    } else {
      console.log('   Creating new user...');
      // Let database generate UUID
      const { data: newUser, error: createError } = await supabase
        .from('vmp_vendor_users')
        .insert({
          vendor_id: VENDOR_ID,
          email: targetEmail,
          display_name:
            targetEmail.split('@')[0].charAt(0).toUpperCase() + targetEmail.split('@')[0].slice(1),
          is_active: true,
          is_internal: true,
          scope_group_id: null, // Super admin
          scope_company_id: null, // Super admin
        })
        .select()
        .single();

      if (createError) {
        console.error('   ❌ Error creating user:', createError.message);
        process.exit(1);
      }
      console.log('   ✅ User created');
      vmpUserId = newUser.id;
    }

    console.log(`   VMP User ID: ${vmpUserId}`);
    console.log(`   Is Internal: ✅ Yes`);
    console.log(`   Super Admin: ✅ Yes (no scope restrictions)`);

    // Step 6: Create or update Supabase Auth user
    console.log('\n📋 Step 6: Creating/updating Supabase Auth user...');
    const {
      data: { users },
      error: listError,
    } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('   ❌ Error listing users:', listError.message);
      process.exit(1);
    }

    const existingAuthUser = users.find(u => u.email === targetEmail);
    let authUserId;

    if (existingAuthUser) {
      console.log('   ⚠️  User already exists in Supabase Auth, updating...');
      authUserId = existingAuthUser.id;

      // Update password
      const { error: updatePasswordError } = await supabase.auth.admin.updateUserById(authUserId, {
        password: targetPassword,
      });

      if (updatePasswordError) {
        console.error('   ❌ Error updating password:', updatePasswordError.message);
        process.exit(1);
      }
      console.log('   ✅ Password updated');

      // Update metadata
      const { error: metadataError } = await supabase.auth.admin.updateUserById(authUserId, {
        user_metadata: {
          display_name:
            targetEmail.split('@')[0].charAt(0).toUpperCase() + targetEmail.split('@')[0].slice(1),
          vendor_id: VENDOR_ID,
          vmp_user_id: vmpUserId,
          is_active: true,
          is_internal: true,
        },
      });

      if (metadataError) {
        console.warn('   ⚠️  Warning: Could not update metadata:', metadataError.message);
      } else {
        console.log('   ✅ User metadata updated');
      }
    } else {
      console.log('   Creating new Supabase Auth user...');
      const { data: newAuthUser, error: createAuthError } = await supabase.auth.admin.createUser({
        email: targetEmail,
        email_confirm: true,
        password: targetPassword,
        user_metadata: {
          display_name:
            targetEmail.split('@')[0].charAt(0).toUpperCase() + targetEmail.split('@')[0].slice(1),
          vendor_id: VENDOR_ID,
          vmp_user_id: vmpUserId,
          is_active: true,
          is_internal: true,
        },
      });

      if (createAuthError) {
        console.error('   ❌ Error creating user:', createAuthError.message);
        process.exit(1);
      }
      console.log('   ✅ User created');
      authUserId = newAuthUser.user.id;
    }

    console.log(`   Auth User ID: ${authUserId}`);

    // Step 7: Create auth user mapping
    console.log('\n📋 Step 7: Creating auth user mapping...');
    const { error: mappingError } = await supabase.from('vmp_auth_user_mapping').upsert(
      {
        auth_user_id: authUserId,
        vmp_user_id: vmpUserId,
        email: targetEmail,
      },
      {
        onConflict: 'auth_user_id',
      }
    );

    if (mappingError) {
      console.warn('   ⚠️  Warning: Could not create mapping:', mappingError.message);
    } else {
      console.log('   ✅ Mapping created/updated');
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ SEEDING COMPLETE');
    console.log('='.repeat(70));
    console.log(`\n📧 Email: ${targetEmail}`);
    console.log(`🔑 Password: ${targetPassword}`);
    console.log(
      `👤 Display Name: ${targetEmail.split('@')[0].charAt(0).toUpperCase() + targetEmail.split('@')[0].slice(1)}`
    );
    console.log(`🆔 Auth User ID: ${authUserId}`);
    console.log(`🆔 VMP User ID: ${vmpUserId}`);
    console.log(`🔐 Is Internal: ✅ Yes`);
    console.log(`👑 Super Admin: ✅ Yes`);
    console.log(`\n🌳 Organization Tree:`);
    console.log(`   Tenant: Nexus Group`);
    console.log(`   Groups: 2 (Manufacturing Division, Distribution Division)`);
    console.log(`   Companies: 2 (linked to groups)`);
    console.log(`\n🌐 Login at: http://localhost:9000/login`);
    console.log(`\n✨ After login, you should see the org tree sidebar!`);
    console.log(`\n⚠️  Note: This password is stored in plain text in this script output.`);
    console.log(`   Change it after first login for security.\n`);
  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

seedDevOrgTree()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

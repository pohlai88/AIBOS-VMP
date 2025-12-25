#!/usr/bin/env node
/**
 * Seed Superholding Company for Super Admin
 * Creates a "Superholding" or "Super Company" and links it to the super admin account
 *
 * Usage: node scripts/seed-superholding-company.js [email]
 * Example: node scripts/seed-superholding-company.js jackwee2020@gmail.com
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

const targetEmail = (process.argv[2] || 'jackwee2020@gmail.com').toLowerCase().trim();

async function seedSuperholdingCompany() {
  console.log('🏢 Seeding Superholding Company for Super Admin\n');
  console.log('='.repeat(70));
  console.log(`📧 Super Admin Email: ${targetEmail}\n`);

  try {
    // Step 1: Get super admin user
    console.log('📋 Step 1: Finding super admin user...');
    const { data: vmpUser, error: vmpError } = await supabase
      .from('vmp_vendor_users')
      .select('id, email, vendor_id, display_name, is_internal')
      .eq('email', targetEmail)
      .single();

    if (vmpError || !vmpUser) {
      console.error('   ❌ User not found in vmp_vendor_users');
      console.error(`   Error: ${vmpError?.message || 'Not found'}`);
      console.error('\n   Run: node scripts/create-super-admin.js ' + targetEmail + ' <password>');
      process.exit(1);
    }

    console.log('   ✅ User found');
    console.log(`      VMP User ID: ${vmpUser.id}`);
    console.log(`      Display Name: ${vmpUser.display_name || vmpUser.email}`);
    console.log(`      Vendor ID: ${vmpUser.vendor_id || 'MISSING'}`);
    console.log(`      Is Internal: ${vmpUser.is_internal ? 'Yes' : 'No'}`);

    if (!vmpUser.vendor_id) {
      console.error('\n   ❌ User has no vendor_id. Cannot link to company.');
      console.error('   The user must be associated with a vendor first.');
      process.exit(1);
    }

    // Step 2: Get vendor and tenant
    console.log('\n📋 Step 2: Getting vendor and tenant information...');
    const { data: vendor, error: vendorError } = await supabase
      .from('vmp_vendors')
      .select('id, name, tenant_id')
      .eq('id', vmpUser.vendor_id)
      .single();

    if (vendorError || !vendor) {
      console.error('   ❌ Vendor not found');
      console.error(`   Error: ${vendorError?.message || 'Not found'}`);
      process.exit(1);
    }

    console.log('   ✅ Vendor found');
    console.log(`      Vendor ID: ${vendor.id}`);
    console.log(`      Vendor Name: ${vendor.name}`);
    console.log(`      Tenant ID: ${vendor.tenant_id || 'MISSING'}`);

    if (!vendor.tenant_id) {
      console.error('\n   ❌ Vendor has no tenant_id. Cannot create company.');
      process.exit(1);
    }

    const tenantId = vendor.tenant_id;

    // Step 3: Create Superholding Company
    console.log('\n📋 Step 3: Creating Superholding Company...');
    const SUPERHOLDING_COMPANY_ID = 'a0000000-0000-0000-0000-000000000001';
    const companyData = {
      id: SUPERHOLDING_COMPANY_ID,
      tenant_id: tenantId,
      name: 'Superholding',
      legal_name: 'Superholding Corporation',
      country_code: 'SG',
      currency_code: 'SGD',
      tax_id: 'SUPER-001',
      group_id: null, // Top-level company, not in a group
    };

    const { data: company, error: companyError } = await supabase
      .from('vmp_companies')
      .upsert(companyData, { onConflict: 'id' })
      .select()
      .single();

    if (companyError) {
      console.error('   ❌ Error creating company:', companyError.message);
      process.exit(1);
    }

    console.log('   ✅ Superholding Company created/updated');
    console.log(`      Company ID: ${company.id}`);
    console.log(`      Company Name: ${company.name}`);
    console.log(`      Legal Name: ${company.legal_name}`);
    console.log(`      Country: ${company.country_code}`);
    console.log(`      Currency: ${company.currency_code}`);

    // Step 4: Link vendor to company
    console.log('\n📋 Step 4: Linking vendor to Superholding Company...');
    const { data: link, error: linkError } = await supabase
      .from('vmp_vendor_company_links')
      .upsert(
        {
          vendor_id: vendor.id,
          company_id: company.id,
          status: 'active',
          erp_vendor_code: 'SUPER-VENDOR-001',
        },
        {
          onConflict: 'vendor_id,company_id',
        }
      )
      .select()
      .single();

    if (linkError) {
      console.error('   ❌ Error creating vendor-company link:', linkError.message);
      process.exit(1);
    }

    console.log('   ✅ Vendor-Company link created/updated');
    console.log(`      Link ID: ${link.id}`);
    console.log(`      Vendor: ${vendor.name}`);
    console.log(`      Company: ${company.name}`);
    console.log(`      Status: ${link.status}`);

    // Step 5: Optionally set scope_company_id (but keep super admin privileges)
    console.log('\n📋 Step 5: Updating user scope (optional)...');
    console.log('   Note: Super admin has scope_group_id=null and scope_company_id=null');
    console.log('   This allows full access to all companies.');
    console.log('   If you want to scope to this company only, we can set scope_company_id.');

    // Keep super admin privileges (null scopes = full access)
    // But we can verify the user is properly configured
    const { data: updatedUser, error: updateError } = await supabase
      .from('vmp_vendor_users')
      .select('id, email, vendor_id, scope_group_id, scope_company_id, is_internal')
      .eq('id', vmpUser.id)
      .single();

    if (updateError) {
      console.warn('   ⚠️  Could not verify user scope:', updateError.message);
    } else {
      console.log('   ✅ User scope verified');
      console.log(
        `      Scope Group: ${updatedUser.scope_group_id || 'null (Super Admin - Full Access)'}`
      );
      console.log(
        `      Scope Company: ${updatedUser.scope_company_id || 'null (Super Admin - Full Access)'}`
      );
      console.log(`      Is Internal: ${updatedUser.is_internal ? 'Yes' : 'No'}`);

      if (updatedUser.scope_group_id === null && updatedUser.scope_company_id === null) {
        console.log('   ✅ User has Super Admin privileges (can access all companies)');
      }
    }

    // Step 6: Verify Supabase Auth user metadata
    console.log('\n📋 Step 6: Verifying Supabase Auth user metadata...');
    const {
      data: { users },
      error: listError,
    } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.warn('   ⚠️  Could not list users:', listError.message);
    } else {
      const authUser = users.find(u => u.email === targetEmail);
      if (authUser) {
        console.log('   ✅ Supabase Auth user found');
        console.log(`      Auth User ID: ${authUser.id}`);
        const metadata = authUser.user_metadata || {};
        console.log(`      Vendor ID in metadata: ${metadata.vendor_id || 'MISSING'}`);
        console.log(`      Is Internal in metadata: ${metadata.is_internal ? 'Yes' : 'No'}`);
      } else {
        console.warn('   ⚠️  User not found in Supabase Auth');
      }
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ SEEDING COMPLETE');
    console.log('='.repeat(70));
    console.log(`\n📧 Super Admin: ${targetEmail}`);
    console.log(`🏢 Superholding Company:`);
    console.log(`   - ID: ${company.id}`);
    console.log(`   - Name: ${company.name}`);
    console.log(`   - Legal Name: ${company.legal_name}`);
    console.log(`   - Country: ${company.country_code}`);
    console.log(`   - Currency: ${company.currency_code}`);
    console.log(`\n🔗 Vendor-Company Link:`);
    console.log(`   - Vendor: ${vendor.name} (${vendor.id})`);
    console.log(`   - Company: ${company.name} (${company.id})`);
    console.log(`   - Status: Active`);
    console.log(`\n👑 Super Admin Status:`);
    console.log(`   - Can access ALL companies (scope_group_id=null, scope_company_id=null)`);
    console.log(`   - Linked to Superholding Company via vendor`);
    console.log(`   - Can view org tree with all companies`);
    console.log(`\n✨ The super admin is now linked to the Superholding Company!`);
    console.log(`   You can see this company in the org tree sidebar.\n`);
  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

seedSuperholdingCompany()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

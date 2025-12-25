#!/usr/bin/env node
/**
 * Setup Default Tenant and Vendor
 * Creates default tenant "DE LETTUCE BEAR BERHAD" and a default vendor for onboarding
 * 
 * Usage: node scripts/setup-default-tenant-vendor.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

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

// Default tenant name
const TENANT_NAME = 'DE LETTUCE BEAR BERHAD';
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_VENDOR_ID = '20000000-0000-0000-0000-000000000001';
const DEFAULT_VENDOR_NAME = 'Default Vendor';

async function setupDefaultTenantAndVendor() {
  console.log('🌱 Setting up Default Tenant and Vendor\n');
  console.log('='.repeat(70));
  console.log(`🏢 Tenant: ${TENANT_NAME}`);
  console.log(`🏪 Vendor: ${DEFAULT_VENDOR_NAME}\n`);

  try {
    // Step 1: Create or update tenant
    console.log('📋 Step 1: Setting up tenant...');
    const { data: existingTenant, error: checkError } = await supabase
      .from('vmp_tenants')
      .select('id, name')
      .eq('id', DEFAULT_TENANT_ID)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = not found, which is OK
      console.error('   ❌ Error checking tenant:', checkError.message);
      throw checkError;
    }

    if (existingTenant) {
      // Update existing tenant name
      const { error: updateError } = await supabase
        .from('vmp_tenants')
        .update({ name: TENANT_NAME })
        .eq('id', DEFAULT_TENANT_ID);

      if (updateError) {
        console.error('   ❌ Error updating tenant:', updateError.message);
        throw updateError;
      }
      console.log(`   ✅ Tenant updated: ${TENANT_NAME}`);
    } else {
      // Create new tenant
      const { error: createError } = await supabase
        .from('vmp_tenants')
        .insert({
          id: DEFAULT_TENANT_ID,
          name: TENANT_NAME,
          created_at: new Date().toISOString(),
        });

      if (createError) {
        console.error('   ❌ Error creating tenant:', createError.message);
        throw createError;
      }
      console.log(`   ✅ Tenant created: ${TENANT_NAME}`);
    }

    // Step 2: Create or update default vendor
    console.log('\n📋 Step 2: Setting up default vendor...');
    const { data: existingVendor, error: vendorCheckError } = await supabase
      .from('vmp_vendors')
      .select('id, name, tenant_id, status')
      .eq('id', DEFAULT_VENDOR_ID)
      .single();

    if (vendorCheckError && vendorCheckError.code !== 'PGRST116') {
      console.error('   ❌ Error checking vendor:', vendorCheckError.message);
      throw vendorCheckError;
    }

    if (existingVendor) {
      // Update existing vendor
      const { error: updateError } = await supabase
        .from('vmp_vendors')
        .update({
          name: DEFAULT_VENDOR_NAME,
          tenant_id: DEFAULT_TENANT_ID,
          status: 'active',
        })
        .eq('id', DEFAULT_VENDOR_ID);

      if (updateError) {
        console.error('   ❌ Error updating vendor:', updateError.message);
        throw updateError;
      }
      console.log(`   ✅ Vendor updated: ${DEFAULT_VENDOR_NAME}`);
    } else {
      // Create new vendor
      const { error: createError } = await supabase
        .from('vmp_vendors')
        .insert({
          id: DEFAULT_VENDOR_ID,
          tenant_id: DEFAULT_TENANT_ID,
          name: DEFAULT_VENDOR_NAME,
          status: 'active',
          created_at: new Date().toISOString(),
        });

      if (createError) {
        console.error('   ❌ Error creating vendor:', createError.message);
        throw createError;
      }
      console.log(`   ✅ Vendor created: ${DEFAULT_VENDOR_NAME}`);
    }

    // Step 3: Verify setup
    console.log('\n📋 Step 3: Verifying setup...');
    const { data: tenant, error: tenantError } = await supabase
      .from('vmp_tenants')
      .select('id, name')
      .eq('id', DEFAULT_TENANT_ID)
      .single();

    const { data: vendor, error: vendorError } = await supabase
      .from('vmp_vendors')
      .select('id, name, tenant_id, status')
      .eq('id', DEFAULT_VENDOR_ID)
      .single();

    if (tenantError || !tenant) {
      console.error('   ❌ Error verifying tenant:', tenantError?.message);
      throw tenantError || new Error('Tenant not found');
    }

    if (vendorError || !vendor) {
      console.error('   ❌ Error verifying vendor:', vendorError?.message);
      throw vendorError || new Error('Vendor not found');
    }

    console.log('\n✅ Setup Complete!');
    console.log('='.repeat(70));
    console.log(`🏢 Tenant ID: ${tenant.id}`);
    console.log(`🏢 Tenant Name: ${tenant.name}`);
    console.log(`🏪 Vendor ID: ${vendor.id}`);
    console.log(`🏪 Vendor Name: ${vendor.name}`);
    console.log(`🔗 Vendor Tenant ID: ${vendor.tenant_id}`);
    console.log(`📊 Vendor Status: ${vendor.status}`);
    console.log('\n💡 You can now create invites for vendors under this tenant.');
    console.log(`💡 Use vendor ID: ${DEFAULT_VENDOR_ID} for testing.`);

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the setup
setupDefaultTenantAndVendor()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });


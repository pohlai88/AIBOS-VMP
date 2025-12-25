import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testVendorContext() {
  try {
    // Get the auth user
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return;
    }

    const authUser = authUsers.users.find(u => u.email === 'jackwee2020@gmail.com');
    
    if (!authUser) {
      console.error('❌ Auth user not found');
      return;
    }

    console.log('✅ Auth user found:');
    console.log('  ID:', authUser.id);
    console.log('  Email:', authUser.email);
    console.log('  Metadata:', JSON.stringify(authUser.user_metadata, null, 2));

    // Get vendor_user record
    const { data: vendorUser, error: vendorError } = await supabase
      .from('vmp_vendor_users')
      .select('*')
      .eq('email', authUser.email)
      .single();

    if (vendorError) {
      console.error('❌ Error getting vendor user:', vendorError);
      return;
    }

    console.log('\n✅ Vendor user found:');
    console.log('  ID:', vendorUser.id);
    console.log('  Vendor ID:', vendorUser.vendor_id);
    console.log('  Is Active:', vendorUser.is_active);
    console.log('  Is Internal:', vendorUser.is_internal);

    // Get vendor
    const { data: vendor, error: vendorLookupError } = await supabase
      .from('vmp_vendors')
      .select('*')
      .eq('id', vendorUser.vendor_id)
      .single();

    if (vendorLookupError) {
      console.error('❌ Error getting vendor:', vendorLookupError);
      return;
    }

    console.log('\n✅ Vendor found:');
    console.log('  ID:', vendor.id);
    console.log('  Name:', vendor.name);
    console.log('  Tenant ID:', vendor.tenant_id);
    console.log('  Status:', vendor.status);

    // Check if vendor_id matches in metadata
    const metadataVendorId = authUser.user_metadata?.vendor_id;
    if (metadataVendorId !== vendorUser.vendor_id) {
      console.log('\n⚠️  WARNING: Vendor ID mismatch!');
      console.log('  Auth metadata vendor_id:', metadataVendorId);
      console.log('  VMP user vendor_id:', vendorUser.vendor_id);
    } else {
      console.log('\n✅ Vendor IDs match in both Auth and VMP tables');
    }

    console.log('\n✅ All checks passed - user should be able to login');
  } catch (err) {
    console.error('Error:', err);
  }
}

testVendorContext();

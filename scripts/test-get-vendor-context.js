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

async function testGetVendorContext() {
  try {
    const authUserId = 'cb431435-02f4-45cb-83fa-abc12104cc8f';
    
    console.log('Testing getVendorContext for:', authUserId);
    
    // Get user from Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(authUserId);
    
    if (authError || !authData.user) {
      console.error('❌ Error getting auth user:', authError);
      process.exit(1);
    }
    
    console.log('✅ Auth user found:', authData.user.email);
    console.log('User metadata:', JSON.stringify(authData.user.user_metadata, null, 2));
    
    const vendorId = authData.user.user_metadata?.vendor_id;
    console.log('\nVendor ID from metadata:', vendorId);
    
    // Get vendor
    const { data: vendor, error: vendorError } = await supabase
      .from('vmp_vendors')
      .select('*')
      .eq('id', vendorId)
      .single();
      
    if (vendorError) {
      console.error('❌ Error getting vendor:', vendorError);
      process.exit(1);
    }
    
    console.log('✅ Vendor found:', vendor.name);
    console.log('Vendor data:', JSON.stringify(vendor, null, 2));
    
    // Get vendor_user record
    const { data: vendorUser, error: vendorUserError } = await supabase
      .from('vmp_vendor_users')
      .select('*')
      .eq('email', authData.user.email)
      .eq('vendor_id', vendorId)
      .maybeSingle();
      
    if (vendorUserError) {
      console.error('❌ Error getting vendor user:', vendorUserError);
      process.exit(1);
    }
    
    if (!vendorUser) {
      console.error('❌ Vendor user not found');
      process.exit(1);
    }
    
    console.log('✅ Vendor user found:', vendorUser.email);
    console.log('Vendor user data:', JSON.stringify(vendorUser, null, 2));
    
    console.log('\n✅ All checks passed! getVendorContext should work.');
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

testGetVendorContext();

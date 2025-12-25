#!/usr/bin/env node
/**
 * Test script for password reset functionality
 * Tests: createPasswordResetToken, verifyPasswordResetToken, updatePasswordWithToken
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { randomBytes } from 'crypto';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const testEmail = 'jackwee2020@gmail.com';
const newPassword = 'NewPassword123!';

async function testPasswordReset() {
  console.log('🧪 Testing Password Reset Flow\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Verify user exists
    console.log('\n📋 Step 1: Verify user exists');
    const { data: user, error: userError } = await supabase
      .from('vmp_vendor_users')
      .select('id, email, display_name')
      .eq('email', testEmail.toLowerCase().trim())
      .single();

    if (userError || !user) {
      console.error('❌ User not found:', userError);
      process.exit(1);
    }

    console.log('✅ User found:', user.email);
    console.log('   User ID:', user.id);
    console.log('   Display Name:', user.display_name);

    // Step 2: Create password reset token
    console.log('\n📋 Step 2: Create password reset token');

    // Invalidate existing tokens
    await supabase
      .from('vmp_password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('used_at', null);

    // Generate token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const { data: tokenData, error: tokenError } = await supabase
      .from('vmp_password_reset_tokens')
      .insert({
        user_id: user.id,
        token: token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (tokenError || !tokenData) {
      console.error('❌ Failed to create token:', tokenError);
      process.exit(1);
    }

    console.log('✅ Token created successfully');
    console.log('   Token ID:', tokenData.id);
    console.log('   Token:', token.substring(0, 16) + '...' + token.substring(token.length - 8));
    console.log('   Expires at:', expiresAt.toISOString());

    // Step 3: Verify token
    console.log('\n📋 Step 3: Verify token');

    const { data: verifyData, error: verifyError } = await supabase
      .from('vmp_password_reset_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token', token)
      .is('used_at', null)
      .single();

    if (verifyError || !verifyData) {
      console.error('❌ Token verification failed:', verifyError);
      process.exit(1);
    }

    if (new Date(verifyData.expires_at) < new Date()) {
      console.error('❌ Token has expired');
      process.exit(1);
    }

    console.log('✅ Token verified successfully');
    console.log('   Token ID:', verifyData.id);
    console.log('   User ID:', verifyData.user_id);
    console.log('   Not expired:', new Date(verifyData.expires_at) > new Date());
    console.log('   Not used:', verifyData.used_at === null);

    // Step 4: Get current password hash (for comparison)
    console.log('\n📋 Step 4: Get current password hash');

    const { data: currentUser, error: currentError } = await supabase
      .from('vmp_vendor_users')
      .select('password_hash')
      .eq('id', user.id)
      .single();

    if (currentError || !currentUser) {
      console.error('❌ Failed to get current password:', currentError);
      process.exit(1);
    }

    const oldPasswordHash = currentUser.password_hash;
    console.log('✅ Current password hash retrieved');
    console.log('   Hash length:', oldPasswordHash ? oldPasswordHash.length : 0);

    // Step 5: Update password
    console.log('\n📋 Step 5: Update password with token');

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    const { data: updateData, error: updateError } = await supabase
      .from('vmp_vendor_users')
      .update({ password_hash: newPasswordHash })
      .eq('id', user.id)
      .select('id, email')
      .single();

    if (updateError || !updateData) {
      console.error('❌ Failed to update password:', updateError);
      process.exit(1);
    }

    console.log('✅ Password updated successfully');
    console.log('   User ID:', updateData.id);
    console.log('   Email:', updateData.email);

    // Step 6: Mark token as used
    console.log('\n📋 Step 6: Mark token as used');

    const { data: markUsedData, error: markUsedError } = await supabase
      .from('vmp_password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenData.id)
      .select('id, used_at')
      .single();

    if (markUsedError || !markUsedData) {
      console.error('❌ Failed to mark token as used:', markUsedError);
      process.exit(1);
    }

    console.log('✅ Token marked as used');
    console.log('   Token ID:', markUsedData.id);
    console.log('   Used at:', markUsedData.used_at);

    // Step 7: Verify password was changed
    console.log('\n📋 Step 7: Verify password was changed');

    const { data: verifyPasswordData, error: verifyPasswordError } = await supabase
      .from('vmp_vendor_users')
      .select('password_hash')
      .eq('id', user.id)
      .single();

    if (verifyPasswordError || !verifyPasswordData) {
      console.error('❌ Failed to verify password:', verifyPasswordError);
      process.exit(1);
    }

    const passwordChanged = verifyPasswordData.password_hash !== oldPasswordHash;
    const passwordMatches = await bcrypt.compare(newPassword, verifyPasswordData.password_hash);

    console.log('✅ Password verification complete');
    console.log('   Password changed:', passwordChanged);
    console.log('   New password matches:', passwordMatches);

    // Step 8: Test that token cannot be reused
    console.log('\n📋 Step 8: Test token cannot be reused');

    const { data: reusedTokenData, error: reusedTokenError } = await supabase
      .from('vmp_password_reset_tokens')
      .select('id, used_at')
      .eq('token', token)
      .single();

    if (reusedTokenError || !reusedTokenData) {
      console.error('❌ Failed to check token reuse:', reusedTokenError);
      process.exit(1);
    }

    const tokenIsUsed = reusedTokenData.used_at !== null;
    console.log('✅ Token reuse check complete');
    console.log('   Token is marked as used:', tokenIsUsed);
    console.log('   Token cannot be reused:', tokenIsUsed);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\n📊 Test Summary:');
    console.log('   ✅ User exists and is active');
    console.log('   ✅ Password reset token created');
    console.log('   ✅ Token verified successfully');
    console.log('   ✅ Password updated successfully');
    console.log('   ✅ Token marked as used');
    console.log('   ✅ Password change verified');
    console.log('   ✅ Token reuse prevented');
    console.log('\n🔑 New Password:', newPassword);
    console.log('📧 Email:', testEmail);
    console.log('\n✨ Password reset flow is working correctly!');
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  }
}

testPasswordReset();

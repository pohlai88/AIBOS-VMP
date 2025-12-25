#!/usr/bin/env node
/**
 * Validate email configuration and check what might have changed
 */

import dotenv from 'dotenv';
dotenv.config();

console.log('📧 Email Configuration Validation\n');
console.log('='.repeat(60));

// Check EMAIL_SERVICE setting
const emailService = process.env.EMAIL_SERVICE || 'console';
console.log(`\n1. Email Service: ${emailService.toUpperCase()}`);

if (emailService === 'console') {
  console.log('   ⚠️  WARNING: Email service is set to "console" mode');
  console.log('   → Emails will NOT be sent - they will only be logged to console');
  console.log('   → This is the DEFAULT setting (development mode)');
  console.log('   → To send emails, set EMAIL_SERVICE=smtp, sendgrid, or resend');
} else {
  console.log(`   ✅ Email service is configured: ${emailService}`);
}

// Check service-specific configuration
console.log('\n2. Service-Specific Configuration:');

if (emailService === 'smtp') {
  const smtpConfig = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || '587',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD ? '***configured***' : null,
    from: process.env.SMTP_FROM_EMAIL,
    fromName: process.env.SMTP_FROM_NAME,
  };

  console.log('   SMTP Configuration:');
  console.log(`   - Host: ${smtpConfig.host || '❌ NOT SET'}`);
  console.log(`   - Port: ${smtpConfig.port}`);
  console.log(`   - User: ${smtpConfig.user || '❌ NOT SET'}`);
  console.log(`   - Password: ${smtpConfig.password || '❌ NOT SET'}`);
  console.log(`   - From Email: ${smtpConfig.from || '❌ NOT SET'}`);
  console.log(`   - From Name: ${smtpConfig.fromName || 'Using default'}`);

  if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.password) {
    console.log('\n   ❌ SMTP configuration is INCOMPLETE');
    console.log('   → Emails will fail to send');
  } else {
    console.log('\n   ✅ SMTP configuration appears complete');
  }
} else if (emailService === 'sendgrid') {
  const sendgridKey = process.env.SENDGRID_API_KEY;
  const sendgridFrom = process.env.SENDGRID_FROM_EMAIL;

  console.log('   SendGrid Configuration:');
  console.log(`   - API Key: ${sendgridKey ? '***configured***' : '❌ NOT SET'}`);
  console.log(`   - From Email: ${sendgridFrom || '❌ NOT SET'}`);

  if (!sendgridKey) {
    console.log('\n   ❌ SendGrid configuration is INCOMPLETE');
  } else {
    console.log('\n   ✅ SendGrid configuration appears complete');
  }
} else if (emailService === 'resend') {
  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM_EMAIL;

  console.log('   Resend Configuration:');
  console.log(`   - API Key: ${resendKey ? '***configured***' : '❌ NOT SET'}`);
  console.log(`   - From Email: ${resendFrom || '❌ NOT SET'}`);

  if (!resendKey) {
    console.log('\n   ❌ Resend configuration is INCOMPLETE');
  } else {
    console.log('\n   ✅ Resend configuration appears complete');
  }
}

// Check site URL
const siteUrl = process.env.SITE_URL || process.env.BASE_URL || 'http://localhost:9000';
console.log(`\n3. Site URL: ${siteUrl}`);
console.log('   → Used for generating reset password links');

// Summary
console.log('\n' + '='.repeat(60));
console.log('\n📋 Summary:');

if (emailService === 'console') {
  console.log('   ⚠️  Email service is in CONSOLE mode (development)');
  console.log('   → Emails are NOT being sent');
  console.log('   → Check server console for reset URLs');
  console.log('\n   To enable email sending:');
  console.log('   1. Set EMAIL_SERVICE=smtp (or sendgrid/resend)');
  console.log('   2. Configure SMTP credentials in .env file');
  console.log('   3. Restart your server');
} else {
  console.log(`   ✅ Email service is configured: ${emailService}`);
  console.log('   → Emails should be sent when password reset is requested');
}

console.log('\n💡 Note: This application uses CUSTOM authentication');
console.log('   → Supabase Auth email settings do NOT apply');
console.log('   → Email sending is controlled by EMAIL_SERVICE env variable');
console.log('   → You can use Supabase SMTP settings by copying them to .env\n');

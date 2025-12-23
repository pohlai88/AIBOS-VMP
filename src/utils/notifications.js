/**
 * Notification Service (Sprint 7.4)
 * Handles email, SMS, and in-app notifications for payment events
 */

import { vmpAdapter } from '../adapters/supabase.js';
import { logError } from './errors.js';

/**
 * Send payment notification to vendor users
 * @param {string} paymentId - Payment ID
 * @param {string} vendorId - Vendor ID
 * @param {Object} paymentData - Payment data
 * @returns {Promise<Object>} Notification results
 */
export async function sendPaymentNotification(paymentId, vendorId, paymentData) {
  try {
    const { paymentRef, amount, currencyCode, invoiceNum } = paymentData;

    // Get user notification preferences
    const users = await vmpAdapter.getVendorUsersWithPreferences(vendorId);

    const results = {
      email: { sent: 0, failed: 0 },
      sms: { sent: 0, failed: 0 },
      inApp: { sent: 0, failed: 0 },
      push: { sent: 0, failed: 0 }
    };

    // Send notifications to each user based on their preferences
    for (const user of users) {
      const preferences = user.notification_preferences || {};

      // In-app notification (always sent, can't be disabled)
      try {
        await vmpAdapter.createNotification(
          null, // No case_id for payment notifications
          user.id,
          'payment_received',
          `Payment Received: ${paymentRef}`,
          invoiceNum
            ? `Payment of ${currencyCode || 'USD'} ${amount.toFixed(2)} received for Invoice ${invoiceNum}`
            : `Payment of ${currencyCode || 'USD'} ${amount.toFixed(2)} received`,
          paymentId
        );
        results.inApp.sent++;
      } catch (error) {
        logError(error, { operation: 'sendPaymentNotification', type: 'inApp', userId: user.id });
        results.inApp.failed++;
      }

      // Email notification (if enabled)
      if (preferences.email !== false) {
        try {
          await sendPaymentEmail(user.email, user.display_name || user.email, {
            paymentRef,
            amount,
            currencyCode: currencyCode || 'USD',
            invoiceNum
          });
          results.email.sent++;
        } catch (error) {
          logError(error, { operation: 'sendPaymentNotification', type: 'email', userId: user.id });
          results.email.failed++;
        }
      }

      // SMS notification (if enabled and phone number exists)
      if (preferences.sms === true && user.phone) {
        try {
          await sendPaymentSMS(user.phone, {
            paymentRef,
            amount,
            currencyCode: currencyCode || 'USD',
            invoiceNum
          });
          results.sms.sent++;
        } catch (error) {
          logError(error, { operation: 'sendPaymentNotification', type: 'sms', userId: user.id });
          results.sms.failed++;
        }
      }

      // Push notification (if enabled and subscription exists)
      if (preferences.push !== false) {
        try {
          const { sendPaymentNotification: sendPush } = await import('./push-sender.js');
          await sendPush(paymentId, user.id, {
            amount,
            currency_code: currencyCode,
            payment_ref: paymentRef,
            invoice_num: invoiceNum
          });
          results.push.sent++;
        } catch (error) {
          // Push failures are non-critical
          logError(error, { operation: 'sendPaymentNotification', type: 'push', userId: user.id });
          results.push.failed++;
        }
      }
    }

    return results;
  } catch (error) {
    logError(error, { operation: 'sendPaymentNotification', paymentId, vendorId });
    throw error;
  }
}

/**
 * Send payment email notification
 * @param {string} userEmail - User email address
 * @param {string} userName - User display name
 * @param {Object} paymentData - Payment data
 * @returns {Promise<Object>} Email send result
 */
async function sendPaymentEmail(userEmail, userName, paymentData) {
  const { paymentRef, amount, currencyCode, invoiceNum } = paymentData;

  // Check if email service is configured
  const emailService = process.env.EMAIL_SERVICE; // 'sendgrid', 'resend', 'smtp', or 'console'
  
  if (!emailService || emailService === 'console') {
    // Development mode - just log
    const emailContent = {
      to: userEmail,
      subject: `Payment Received: ${paymentRef}`,
      html: generatePaymentEmailHTML(userName, paymentData),
      text: generatePaymentEmailText(userName, paymentData)
    };
    console.log('[Email] Payment notification (console mode):', emailContent);
    return { success: true, mode: 'console', emailContent };
  }

  // Production mode - send via email service
  try {
    switch (emailService.toLowerCase()) {
      case 'sendgrid':
        return await sendViaSendGrid(userEmail, userName, paymentData);
      case 'resend':
        return await sendViaResend(userEmail, userName, paymentData);
      case 'smtp':
        return await sendViaSMTP(userEmail, userName, paymentData);
      default:
        console.warn(`[Email] Unknown email service: ${emailService}, falling back to console`);
        return await sendPaymentEmail(userEmail, userName, paymentData); // Recursive with console mode
    }
  } catch (error) {
    logError(error, { operation: 'sendPaymentEmail', userEmail });
    throw error;
  }
}

/**
 * Send payment SMS notification
 * @param {string} phoneNumber - Phone number
 * @param {Object} paymentData - Payment data
 * @returns {Promise<Object>} SMS send result
 */
async function sendPaymentSMS(phoneNumber, paymentData) {
  const { paymentRef, amount, currencyCode, invoiceNum } = paymentData;

  // Check if SMS service is configured
  const smsService = process.env.SMS_SERVICE; // 'twilio', 'console', or undefined

  if (!smsService || smsService === 'console') {
    // Development mode - just log
    const message = `Payment Received: ${paymentRef} - ${currencyCode} ${amount.toFixed(2)}${invoiceNum ? ` (Invoice: ${invoiceNum})` : ''}`;
    console.log('[SMS] Payment notification (console mode):', { to: phoneNumber, message });
    return { success: true, mode: 'console', message };
  }

  // Production mode - send via SMS service
  try {
    switch (smsService.toLowerCase()) {
      case 'twilio':
        return await sendViaTwilio(phoneNumber, paymentData);
      default:
        console.warn(`[SMS] Unknown SMS service: ${smsService}, falling back to console`);
        return await sendPaymentSMS(phoneNumber, paymentData); // Recursive with console mode
    }
  } catch (error) {
    logError(error, { operation: 'sendPaymentSMS', phoneNumber });
    throw error;
  }
}

/**
 * Generate HTML email content for payment notification
 */
function generatePaymentEmailHTML(userName, paymentData) {
  const { paymentRef, amount, currencyCode, invoiceNum } = paymentData;
  const portalUrl = process.env.PORTAL_URL || 'https://vmp.nexuscanon.com';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Received</title>
</head>
<body style="font-family: 'Liter', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f5f5f5; padding: 30px; border-radius: 8px;">
    <h1 style="color: #2c3e50; margin-top: 0;">Payment Received</h1>
    <p>Hello ${userName},</p>
    <p>A payment has been received:</p>
    <div style="background: white; padding: 20px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 10px 0;"><strong>Payment Reference:</strong> ${paymentRef}</p>
      <p style="margin: 10px 0;"><strong>Amount:</strong> ${currencyCode} ${amount.toFixed(2)}</p>
      ${invoiceNum ? `<p style="margin: 10px 0;"><strong>Invoice:</strong> ${invoiceNum}</p>` : ''}
    </div>
    <p>You can view the payment details in your <a href="${portalUrl}/payments" style="color: #56ffb8; text-decoration: none;">VMP portal</a>.</p>
    <p style="margin-top: 30px; color: #666; font-size: 14px;">Best regards,<br>NexusCanon VMP</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text email content for payment notification
 */
function generatePaymentEmailText(userName, paymentData) {
  const { paymentRef, amount, currencyCode, invoiceNum } = paymentData;
  const portalUrl = process.env.PORTAL_URL || 'https://vmp.nexuscanon.com';
  
  return `
Hello ${userName},

A payment has been received:

Payment Reference: ${paymentRef}
Amount: ${currencyCode} ${amount.toFixed(2)}
${invoiceNum ? `Invoice: ${invoiceNum}` : ''}

You can view the payment details in your VMP portal: ${portalUrl}/payments

Best regards,
NexusCanon VMP
  `.trim();
}

/**
 * Send email via SendGrid
 */
async function sendViaSendGrid(userEmail, userName, paymentData) {
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  if (!sendgridApiKey) {
    throw new Error('SENDGRID_API_KEY not configured');
  }

  // Dynamic import to avoid requiring sendgrid in development
  const sgMail = (await import('@sendgrid/mail')).default;
  sgMail.setApiKey(sendgridApiKey);

  const msg = {
    to: userEmail,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@nexuscanon.com',
    subject: `Payment Received: ${paymentData.paymentRef}`,
    text: generatePaymentEmailText(userName, paymentData),
    html: generatePaymentEmailHTML(userName, paymentData)
  };

  await sgMail.send(msg);
  return { success: true, mode: 'sendgrid' };
}

/**
 * Send email via Resend
 */
async function sendViaResend(userEmail, userName, paymentData) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY not configured');
  }

  // Dynamic import to avoid requiring resend in development
  const { Resend } = await import('resend');
  const resend = new Resend(resendApiKey);

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'NexusCanon VMP <noreply@nexuscanon.com>',
    to: userEmail,
    subject: `Payment Received: ${paymentData.paymentRef}`,
    text: generatePaymentEmailText(userName, paymentData),
    html: generatePaymentEmailHTML(userName, paymentData)
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return { success: true, mode: 'resend', data };
}

/**
 * Send email via SMTP
 * Uses nodemailer with SMTP credentials from environment variables
 * Can use Supabase's SMTP settings or any SMTP provider
 */
async function sendViaSMTP(userEmail, userName, paymentData) {
  const nodemailer = await import('nodemailer');
  
  // Get SMTP configuration from environment variables
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@nexuscanon.com';
  const smtpFromName = process.env.SMTP_FROM_NAME || 'NexusCanon VMP';
  const smtpSecure = process.env.SMTP_SECURE === 'true'; // Use TLS (port 465)
  const smtpRequireTLS = process.env.SMTP_REQUIRE_TLS !== 'false'; // Default: true

  if (!smtpHost || !smtpUser || !smtpPassword) {
    throw new Error('SMTP configuration incomplete. Required: SMTP_HOST, SMTP_USER, SMTP_PASSWORD');
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
    requireTLS: smtpRequireTLS, // Force TLS for port 587
  });

  // Send email
  const mailOptions = {
    from: `"${smtpFromName}" <${smtpFrom}>`,
    to: userEmail,
    subject: `Payment Received: ${paymentData.paymentRef}`,
    text: generatePaymentEmailText(userName, paymentData),
    html: generatePaymentEmailHTML(userName, paymentData),
  };

  const info = await transporter.sendMail(mailOptions);
  
  return { 
    success: true, 
    mode: 'smtp', 
    messageId: info.messageId,
    response: info.response 
  };
}

/**
 * Send password reset email
 * Following Supabase email template patterns
 * @param {string} userEmail - User email address
 * @param {string} resetToken - Password reset token
 * @param {string} resetUrl - Full reset URL with token
 * @returns {Promise<Object>} Email send result
 */
export async function sendPasswordResetEmail(userEmail, resetToken, resetUrl) {
  const emailService = process.env.EMAIL_SERVICE || 'console';
  const siteUrl = process.env.SITE_URL || process.env.BASE_URL || 'http://localhost:9000';
  
  const emailContent = {
    to: userEmail,
    subject: 'Reset Your Password — NexusCanon VMP',
    html: generatePasswordResetEmailHTML(resetUrl),
    text: generatePasswordResetEmailText(resetUrl)
  };

  if (!emailService || emailService === 'console') {
    // Development mode - log email content
    console.log('[Email] Password reset (console mode):');
    console.log(`  To: ${userEmail}`);
    console.log(`  Subject: ${emailContent.subject}`);
    console.log(`  Reset URL: ${resetUrl}`);
    return { success: true, mode: 'console', emailContent };
  }

  // Production mode - send via email service
  try {
    switch (emailService.toLowerCase()) {
      case 'sendgrid':
        return await sendPasswordResetViaSendGrid(userEmail, emailContent);
      case 'resend':
        return await sendPasswordResetViaResend(userEmail, emailContent);
      case 'smtp':
        return await sendPasswordResetViaSMTP(userEmail, emailContent);
      default:
        console.warn(`[Email] Unknown email service: ${emailService}, falling back to console`);
        // Return console mode instead of recursive call
        return { success: true, mode: 'console', emailContent };
    }
  } catch (error) {
    logError(error, { operation: 'sendPasswordResetEmail', userEmail });
    throw error;
  }
}

/**
 * Generate password reset email HTML (following Supabase template patterns)
 */
function generatePasswordResetEmailHTML(resetUrl) {
  // Ensure resetUrl is a string (URLs are generally safe, but validate)
  const safeResetUrl = String(resetUrl || '');
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(to bottom, rgba(96, 255, 198, 0.1), transparent); border: 1px solid rgba(96, 255, 198, 0.2); border-radius: 12px; padding: 32px; margin: 20px 0;">
    <h2 style="color: #060607; margin-top: 0; font-size: 24px; font-weight: 500;">Reset Your Password</h2>
    
    <p style="color: #666; font-size: 14px; margin: 16px 0;">
      You requested to reset your password for your NexusCanon VMP account. Click the button below to reset your password:
    </p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${safeResetUrl}" style="display: inline-block; background: hsl(155, 100%, 69%); color: #050506; text-decoration: none; padding: 14px 28px; border-radius: 999px; font-weight: 600; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; box-shadow: 0 0 15px rgba(96, 255, 198, 0.2);">
        Reset Password
      </a>
    </div>
    
    <p style="color: #999; font-size: 12px; margin: 24px 0 0 0; border-top: 1px solid #eee; padding-top: 16px;">
      This link will expire in 1 hour. If you didn't request this password reset, please ignore this email or contact support if you have concerns.
    </p>
    
    <p style="color: #999; font-size: 11px; margin: 16px 0 0 0;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${safeResetUrl}" style="color: hsl(155, 100%, 69%); word-break: break-all;">${safeResetUrl}</a>
    </p>
  </div>
  
  <p style="color: #999; font-size: 11px; text-align: center; margin-top: 32px;">
    NexusCanon VMP • Enterprise Settlement Governance
  </p>
</body>
</html>
  `.trim();
}

/**
 * Generate password reset email text
 */
function generatePasswordResetEmailText(resetUrl) {
  // Ensure resetUrl is a string
  const safeResetUrl = String(resetUrl || '');
  
  return `
Reset Your Password — NexusCanon VMP

You requested to reset your password for your NexusCanon VMP account.

Click this link to reset your password:
${safeResetUrl}

This link will expire in 1 hour.

If you didn't request this password reset, please ignore this email or contact support if you have concerns.

NexusCanon VMP • Enterprise Settlement Governance
  `.trim();
}

/**
 * Send password reset email via SendGrid
 */
async function sendPasswordResetViaSendGrid(userEmail, emailContent) {
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  if (!sendgridApiKey) {
    throw new Error('SENDGRID_API_KEY not configured');
  }

  const sgMail = (await import('@sendgrid/mail')).default;
  sgMail.setApiKey(sendgridApiKey);

  const msg = {
    to: userEmail,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@nexuscanon.com',
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html
  };

  await sgMail.send(msg);
  return { success: true, mode: 'sendgrid' };
}

/**
 * Send password reset email via Resend
 */
async function sendPasswordResetViaResend(userEmail, emailContent) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY not configured');
  }

  const { Resend } = await import('resend');
  const resend = new Resend(resendApiKey);

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'NexusCanon VMP <noreply@nexuscanon.com>',
    to: userEmail,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return { success: true, mode: 'resend', data };
}

/**
 * Send password reset email via SMTP
 * Uses nodemailer with SMTP credentials from environment variables
 * Can use Supabase's SMTP settings or any SMTP provider
 */
async function sendPasswordResetViaSMTP(userEmail, emailContent) {
  const nodemailer = await import('nodemailer');
  
  // Get SMTP configuration from environment variables
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@nexuscanon.com';
  const smtpFromName = process.env.SMTP_FROM_NAME || 'NexusCanon VMP';
  const smtpSecure = process.env.SMTP_SECURE === 'true'; // Use TLS (port 465)
  const smtpRequireTLS = process.env.SMTP_REQUIRE_TLS !== 'false'; // Default: true

  if (!smtpHost || !smtpUser || !smtpPassword) {
    throw new Error('SMTP configuration incomplete. Required: SMTP_HOST, SMTP_USER, SMTP_PASSWORD');
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
    requireTLS: smtpRequireTLS, // Force TLS for port 587
  });

  // Send email
  const mailOptions = {
    from: `"${smtpFromName}" <${smtpFrom}>`,
    to: userEmail,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
  };

  const info = await transporter.sendMail(mailOptions);
  
  return { 
    success: true, 
    mode: 'smtp', 
    messageId: info.messageId,
    response: info.response 
  };
}

/**
 * Send vendor invite email
 * @param {string} userEmail - Vendor email address
 * @param {string} inviteUrl - Full invite URL with token
 * @param {string} vendorName - Vendor name
 * @param {string} tenantName - Tenant/organization name
 * @returns {Promise<Object>} Email send result
 */
export async function sendInviteEmail(userEmail, inviteUrl, vendorName, tenantName) {
  const emailService = process.env.EMAIL_SERVICE || 'console';
  
  const emailContent = {
    to: userEmail,
    subject: `You're Invited to Join ${tenantName} — NexusCanon VMP`,
    html: generateInviteEmailHTML(inviteUrl, vendorName, tenantName),
    text: generateInviteEmailText(inviteUrl, vendorName, tenantName)
  };

  if (!emailService || emailService === 'console') {
    console.log('[Email] Invite (console mode):');
    console.log(`  To: ${userEmail}`);
    console.log(`  Subject: ${emailContent.subject}`);
    console.log(`  Invite URL: ${inviteUrl}`);
    return { success: true, mode: 'console', emailContent };
  }

  // Production mode - send via email service
  try {
    switch (emailService.toLowerCase()) {
      case 'sendgrid':
        return await sendInviteViaSendGrid(userEmail, emailContent);
      case 'resend':
        return await sendInviteViaResend(userEmail, emailContent);
      case 'smtp':
        return await sendInviteViaSMTP(userEmail, emailContent);
      default:
        console.warn(`[Email] Unknown email service: ${emailService}, falling back to console`);
        // Return console mode instead of recursive call
        return { success: true, mode: 'console', emailContent };
    }
  } catch (error) {
    logError(error, { operation: 'sendInviteEmail', userEmail });
    throw error;
  }
}

/**
 * Generate invite email HTML
 */
function generateInviteEmailHTML(inviteUrl, vendorName, tenantName) {
  // Escape HTML to prevent XSS
  const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
  
  const safeVendorName = escapeHtml(vendorName);
  const safeTenantName = escapeHtml(tenantName);
  const safeInviteUrl = String(inviteUrl || ''); // URL is already safe, just ensure it's a string
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(to bottom, rgba(96, 255, 198, 0.1), transparent); border: 1px solid rgba(96, 255, 198, 0.2); border-radius: 12px; padding: 32px; margin: 20px 0;">
    <h2 style="color: #060607; margin-top: 0; font-size: 24px; font-weight: 500;">You're Invited to Join ${safeTenantName}</h2>
    
    <p style="color: #666; font-size: 14px; margin: 16px 0;">
      ${safeVendorName} has invited you to join the NexusCanon VMP platform. Click the button below to create your account:
    </p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${safeInviteUrl}" style="display: inline-block; background: hsl(155, 100%, 69%); color: #050506; text-decoration: none; padding: 14px 28px; border-radius: 999px; font-weight: 600; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; box-shadow: 0 0 15px rgba(96, 255, 198, 0.2);">
        Accept Invite
      </a>
    </div>
    
    <p style="color: #999; font-size: 12px; margin: 24px 0 0 0; border-top: 1px solid #eee; padding-top: 16px;">
      This invite will expire in 7 days. If you didn't expect this invite, you can safely ignore this email.
    </p>
    
    <p style="color: #999; font-size: 11px; margin: 16px 0 0 0;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${safeInviteUrl}" style="color: hsl(155, 100%, 69%); word-break: break-all;">${safeInviteUrl}</a>
    </p>
  </div>
  
  <p style="color: #999; font-size: 11px; text-align: center; margin-top: 32px;">
    NexusCanon VMP • Enterprise Settlement Governance
  </p>
</body>
</html>
  `.trim();
}

/**
 * Generate invite email text
 */
function generateInviteEmailText(inviteUrl, vendorName, tenantName) {
  // For text emails, ensure values are strings (no HTML escaping needed for plain text)
  const safeVendorName = String(vendorName || '');
  const safeTenantName = String(tenantName || '');
  const safeInviteUrl = String(inviteUrl || '');
  
  return `
You're Invited to Join ${safeTenantName} — NexusCanon VMP

${safeVendorName} has invited you to join the NexusCanon VMP platform.

Click this link to create your account:
${safeInviteUrl}

This invite will expire in 7 days.

If you didn't expect this invite, you can safely ignore this email.

NexusCanon VMP • Enterprise Settlement Governance
  `.trim();
}

/**
 * Send invite email via SendGrid
 */
async function sendInviteViaSendGrid(userEmail, emailContent) {
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  if (!sendgridApiKey) {
    throw new Error('SENDGRID_API_KEY not configured');
  }

  const sgMail = (await import('@sendgrid/mail')).default;
  sgMail.setApiKey(sendgridApiKey);

  const msg = {
    to: userEmail,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@nexuscanon.com',
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html
  };

  await sgMail.send(msg);
  return { success: true, mode: 'sendgrid' };
}

/**
 * Send invite email via Resend
 */
async function sendInviteViaResend(userEmail, emailContent) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY not configured');
  }

  const { Resend } = await import('resend');
  const resend = new Resend(resendApiKey);

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'NexusCanon VMP <noreply@nexuscanon.com>',
    to: userEmail,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return { success: true, mode: 'resend', data };
}

/**
 * Send invite email via SMTP
 */
async function sendInviteViaSMTP(userEmail, emailContent) {
  const nodemailer = await import('nodemailer');
  
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@nexuscanon.com';
  const smtpFromName = process.env.SMTP_FROM_NAME || 'NexusCanon VMP';
  const smtpSecure = process.env.SMTP_SECURE === 'true';
  const smtpRequireTLS = process.env.SMTP_REQUIRE_TLS !== 'false';

  if (!smtpHost || !smtpUser || !smtpPassword) {
    throw new Error('SMTP configuration incomplete. Required: SMTP_HOST, SMTP_USER, SMTP_PASSWORD');
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
    requireTLS: smtpRequireTLS,
  });

  const mailOptions = {
    from: `"${smtpFromName}" <${smtpFrom}>`,
    to: userEmail,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
  };

  const info = await transporter.sendMail(mailOptions);
  
  return { 
    success: true, 
    mode: 'smtp', 
    messageId: info.messageId,
    response: info.response 
  };
}

/**
 * Send SMS via Twilio
 */
async function sendViaTwilio(phoneNumber, paymentData) {
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
    throw new Error('Twilio credentials not configured');
  }

  // Dynamic import to avoid requiring twilio in development
  const twilio = (await import('twilio')).default;
  const client = twilio(twilioAccountSid, twilioAuthToken);

  const { paymentRef, amount, currencyCode, invoiceNum } = paymentData;
  const message = `Payment Received: ${paymentRef} - ${currencyCode} ${amount.toFixed(2)}${invoiceNum ? ` (Invoice: ${invoiceNum})` : ''}. View details: ${process.env.PORTAL_URL || 'https://vmp.nexuscanon.com'}/payments`;

  const result = await client.messages.create({
    body: message,
    from: twilioFromNumber,
    to: phoneNumber
  });

  return { success: true, mode: 'twilio', sid: result.sid };
}


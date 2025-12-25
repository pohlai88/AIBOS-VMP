/**
 * VMP Seed Data Script
 *
 * Creates realistic demo data for testing and development
 *
 * Usage: node scripts/seed-vmp-data.js
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// ============================================================================
// SEED DATA
// ============================================================================

async function seed() {
  console.log('🌱 Starting VMP seed data generation...\n');

  try {
    // 1. Create Tenant
    console.log('📦 Creating tenant...');
    const { data: tenant, error: tenantError } = await supabase
      .from('vmp_tenants')
      .insert({ name: 'ACME Corporation' })
      .select()
      .single();

    if (tenantError) {
      // Tenant might already exist, try to fetch it
      const { data: existingTenant } = await supabase
        .from('vmp_tenants')
        .select()
        .limit(1)
        .single();

      if (existingTenant) {
        console.log('✅ Using existing tenant:', existingTenant.id);
        tenant = existingTenant;
      } else {
        throw tenantError;
      }
    } else {
      console.log('✅ Created tenant:', tenant.id);
    }

    const tenantId = tenant.id;

    // 2. Create Companies
    console.log('\n🏢 Creating companies...');
    const companies = [
      { name: 'ACME Manufacturing' },
      { name: 'ACME Distribution' },
      { name: 'ACME Services' },
    ];

    const companyIds = [];
    for (const company of companies) {
      const { data, error } = await supabase
        .from('vmp_companies')
        .insert({ tenant_id: tenantId, name: company.name })
        .select()
        .single();

      if (error && error.code !== '23505') {
        // Ignore unique constraint violations
        console.error('❌ Error creating company:', error);
      } else if (data) {
        companyIds.push(data.id);
        console.log(`✅ Created company: ${company.name} (${data.id})`);
      } else {
        // Fetch existing
        const { data: existing } = await supabase
          .from('vmp_companies')
          .select()
          .eq('tenant_id', tenantId)
          .eq('name', company.name)
          .single();
        if (existing) {
          companyIds.push(existing.id);
          console.log(`✅ Using existing company: ${company.name} (${existing.id})`);
        }
      }
    }

    // 3. Create Vendors
    console.log('\n🏪 Creating vendors...');
    const vendors = [
      { name: 'TechSupply Co.', status: 'active' },
      { name: 'Global Logistics Ltd', status: 'active' },
      { name: 'Office Solutions Inc', status: 'invited' },
    ];

    const vendorIds = [];
    for (const vendor of vendors) {
      const { data, error } = await supabase
        .from('vmp_vendors')
        .insert({ tenant_id: tenantId, name: vendor.name, status: vendor.status })
        .select()
        .single();

      if (error && error.code !== '23505') {
        console.error('❌ Error creating vendor:', error);
      } else if (data) {
        vendorIds.push(data.id);
        console.log(`✅ Created vendor: ${vendor.name} (${data.id})`);
      } else {
        const { data: existing } = await supabase
          .from('vmp_vendors')
          .select()
          .eq('tenant_id', tenantId)
          .eq('name', vendor.name)
          .single();
        if (existing) {
          vendorIds.push(existing.id);
          console.log(`✅ Using existing vendor: ${vendor.name} (${existing.id})`);
        }
      }
    }

    // 4. Link Vendors to Companies
    console.log('\n🔗 Linking vendors to companies...');
    for (let i = 0; i < vendorIds.length; i++) {
      const vendorId = vendorIds[i];
      const companyId = companyIds[i % companyIds.length];

      const { error } = await supabase
        .from('vmp_vendor_company_links')
        .insert({ vendor_id: vendorId, company_id: companyId, status: 'active' });

      if (error && error.code !== '23505') {
        console.error('❌ Error linking vendor to company:', error);
      } else if (!error) {
        console.log(`✅ Linked vendor ${i + 1} to company ${(i % companyIds.length) + 1}`);
      }
    }

    // 5. Create Vendor Users
    console.log('\n👤 Creating vendor users...');
    const users = [
      { email: 'admin@acme.com', display_name: 'Admin User', vendor_id: vendorIds[0] },
      {
        email: 'vendor1@techsupply.com',
        display_name: 'TechSupply Admin',
        vendor_id: vendorIds[0],
      },
      {
        email: 'vendor2@globallog.com',
        display_name: 'Global Logistics User',
        vendor_id: vendorIds[1],
      },
    ];

    const userIds = [];
    for (const user of users) {
      // Check if user exists
      const { data: existing } = await supabase
        .from('vmp_vendor_users')
        .select()
        .eq('email', user.email)
        .single();

      if (existing) {
        userIds.push(existing.id);
        console.log(`✅ Using existing user: ${user.email} (${existing.id})`);
      } else {
        const passwordHash =
          user.email === 'admin@acme.com'
            ? await hashPassword('testpassword123')
            : await hashPassword('password123');

        const { data, error } = await supabase
          .from('vmp_vendor_users')
          .insert({
            vendor_id: user.vendor_id,
            email: user.email,
            password_hash: passwordHash,
            display_name: user.display_name,
            is_active: true,
          })
          .select()
          .single();

        if (error) {
          console.error('❌ Error creating user:', error);
        } else {
          userIds.push(data.id);
          console.log(`✅ Created user: ${user.email} (${data.id})`);
        }
      }
    }

    // 6. Create Cases
    console.log('\n📋 Creating cases...');
    const caseTypes = ['onboarding', 'invoice', 'payment', 'soa', 'general'];
    const statuses = ['open', 'waiting_supplier', 'waiting_internal', 'resolved', 'blocked'];
    const ownerTeams = ['procurement', 'ap', 'finance'];
    const subjects = [
      'Missing GRN for Invoice #9921',
      'PO-442 requires 3-way match',
      'Payment status inquiry',
      'New vendor onboarding',
      'Statement of Account reconciliation',
      'Invoice discrepancy',
      'Payment approval needed',
      'Vendor registration documents',
    ];

    const caseIds = [];
    for (let i = 0; i < 8; i++) {
      const caseType = randomElement(caseTypes);
      const status = randomElement(statuses);
      const ownerTeam = randomElement(ownerTeams);
      const subject = subjects[i] || `Case ${i + 1}`;
      const vendorId = randomElement(vendorIds);
      const companyId = randomElement(companyIds);

      const slaDueAt = randomDate(new Date(), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

      const { data, error } = await supabase
        .from('vmp_cases')
        .insert({
          tenant_id: tenantId,
          company_id: companyId,
          vendor_id: vendorId,
          case_type: caseType,
          status: status,
          subject: subject,
          owner_team: ownerTeam,
          sla_due_at: slaDueAt.toISOString(),
          escalation_level: Math.floor(Math.random() * 4),
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating case:', error);
      } else {
        caseIds.push(data.id);
        console.log(`✅ Created case: ${subject} (${data.id})`);
      }
    }

    // 7. Create Checklist Steps
    console.log('\n✅ Creating checklist steps...');
    const evidenceTypes = ['PO', 'GRN', 'Invoice', 'Contract', 'Certificate'];
    const stepStatuses = ['pending', 'submitted', 'verified', 'rejected', 'waived'];
    const stepLabels = [
      'Purchase Order',
      'Goods Receipt Note',
      'Invoice',
      '3-Way Match Verification',
      'Payment Authorization',
    ];

    for (const caseId of caseIds.slice(0, 4)) {
      // Add steps to first 4 cases
      const numSteps = Math.floor(Math.random() * 3) + 2; // 2-4 steps per case

      for (let i = 0; i < numSteps; i++) {
        const label = stepLabels[i] || `Step ${i + 1}`;
        const evidenceType = randomElement(evidenceTypes);
        const status = randomElement(stepStatuses);

        const { error } = await supabase.from('vmp_checklist_steps').insert({
          case_id: caseId,
          label: label,
          required_evidence_type: evidenceType,
          status: status,
        });

        if (error) {
          console.error('❌ Error creating checklist step:', error);
        }
      }
      console.log(`✅ Added ${numSteps} checklist steps to case ${caseId.substring(0, 8)}...`);
    }

    // 8. Create Messages
    console.log('\n💬 Creating messages...');
    const channels = ['portal', 'whatsapp', 'email', 'slack'];
    const senderTypes = ['vendor', 'internal', 'ai'];
    const messageBodies = [
      'Hello, I need to check the status of invoice #9921.',
      'We have uploaded the GRN as requested.',
      'The invoice amount matches the PO. Please proceed with payment.',
      'Can you provide more details about the discrepancy?',
      'Payment has been approved and will be processed within 3 business days.',
      'Thank you for the quick response.',
      'The evidence has been verified. Case can be closed.',
      'We need additional documentation for compliance.',
    ];

    for (const caseId of caseIds.slice(0, 5)) {
      // Add messages to first 5 cases
      const numMessages = Math.floor(Math.random() * 3) + 1; // 1-3 messages per case

      for (let i = 0; i < numMessages; i++) {
        const channel = randomElement(channels);
        const senderType = randomElement(senderTypes);
        const body = messageBodies[i] || `Message ${i + 1} for case`;
        const senderUserId = senderType === 'vendor' ? randomElement(userIds) : null;

        const { error } = await supabase.from('vmp_messages').insert({
          case_id: caseId,
          channel_source: channel,
          sender_type: senderType,
          sender_user_id: senderUserId,
          body: body,
          is_internal_note: senderType === 'internal' && Math.random() > 0.5,
        });

        if (error) {
          console.error('❌ Error creating message:', error);
        }
      }
      console.log(`✅ Added ${numMessages} messages to case ${caseId.substring(0, 8)}...`);
    }

    console.log('\n✨ Seed data generation complete!');
    console.log('\n📊 Summary:');
    console.log(`   - 1 Tenant`);
    console.log(`   - ${companyIds.length} Companies`);
    console.log(`   - ${vendorIds.length} Vendors`);
    console.log(`   - ${userIds.length} Users`);
    console.log(`   - ${caseIds.length} Cases`);
    console.log(`   - Multiple Checklist Steps`);
    console.log(`   - Multiple Messages`);
    console.log('\n🔑 Test Credentials:');
    console.log('   Email: admin@acme.com');
    console.log('   Password: testpassword123');
  } catch (error) {
    console.error('\n❌ Seed data generation failed:', error);
    process.exit(1);
  }
}

// Run seed
seed();

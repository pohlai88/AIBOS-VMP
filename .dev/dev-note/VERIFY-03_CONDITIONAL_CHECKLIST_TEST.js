/**
 * VERIFY-03: Conditional Checklist Engine Test Script
 * 
 * Tests all country/vendor type combinations to verify conditional logic
 * Run with: node .dev/dev-note/VERIFY-03_CONDITIONAL_CHECKLIST_TEST.js
 */

import { getChecklistStepsForCaseType } from '../src/utils/checklist-rules.js';

// Test matrix from sprint plan
const testCases = [
    {
        name: 'US Corporate',
        country: 'US',
        vendorType: 'corporate',
        expectedSteps: ['company_registration', 'bank_letter', 'tax_id', 'ein_certificate', 'w9_form']
    },
    {
        name: 'US Individual',
        country: 'US',
        vendorType: 'individual',
        expectedSteps: ['bank_letter', 'tax_id', 'ein_certificate', 'w9_form'] // No company_registration
    },
    {
        name: 'Malaysia Corporate',
        country: 'MY',
        vendorType: 'corporate',
        expectedSteps: ['company_registration', 'bank_letter', 'tax_id', 'tax_certificate'] // GST
    },
    {
        name: 'UK Corporate (EU)',
        country: 'GB',
        vendorType: 'corporate',
        expectedSteps: ['company_registration', 'bank_letter', 'tax_id', 'vat_certificate'] // VAT
    },
    {
        name: 'Vietnam Corporate',
        country: 'VN',
        vendorType: 'corporate',
        expectedSteps: ['company_registration', 'bank_letter', 'tax_id'] // Generic tax
    },
    {
        name: 'International Corporate',
        country: 'US',
        vendorType: 'international',
        expectedSteps: ['company_registration', 'bank_letter', 'tax_id', 'ein_certificate', 'w9_form', 'trade_license', 'import_export_permit']
    },
    {
        name: 'France Corporate (EU)',
        country: 'FR',
        vendorType: 'corporate',
        expectedSteps: ['company_registration', 'bank_letter', 'tax_id', 'vat_certificate'] // VAT
    },
    {
        name: 'Germany Corporate (EU)',
        country: 'DE',
        vendorType: 'corporate',
        expectedSteps: ['company_registration', 'bank_letter', 'tax_id', 'vat_certificate'] // VAT
    },
    {
        name: 'No Country/Vendor Type',
        country: null,
        vendorType: null,
        expectedSteps: ['company_registration', 'bank_letter', 'tax_id'] // Base steps only
    }
];

console.log('🧪 Testing Conditional Checklist Engine\n');
console.log('=' .repeat(80));

let passed = 0;
let failed = 0;
const failures = [];

for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log(`   Country: ${testCase.country || 'null'}, Vendor Type: ${testCase.vendorType || 'null'}`);
    
    try {
        const steps = getChecklistStepsForCaseType('onboarding', null, {
            countryCode: testCase.country,
            vendorType: testCase.vendorType
        });
        
        const actualEvidenceTypes = steps.map(s => s.required_evidence_type).filter(Boolean);
        const expectedEvidenceTypes = testCase.expectedSteps;
        
        // Check if all expected steps are present
        const missingSteps = expectedEvidenceTypes.filter(et => !actualEvidenceTypes.includes(et));
        const unexpectedSteps = actualEvidenceTypes.filter(et => !expectedEvidenceTypes.includes(et));
        
        if (missingSteps.length === 0 && unexpectedSteps.length === 0) {
            console.log(`   ✅ PASS - All expected steps present`);
            console.log(`   Steps: ${actualEvidenceTypes.join(', ')}`);
            passed++;
        } else {
            console.log(`   ❌ FAIL`);
            if (missingSteps.length > 0) {
                console.log(`   Missing steps: ${missingSteps.join(', ')}`);
            }
            if (unexpectedSteps.length > 0) {
                console.log(`   Unexpected steps: ${unexpectedSteps.join(', ')}`);
            }
            console.log(`   Expected: ${expectedEvidenceTypes.join(', ')}`);
            console.log(`   Actual: ${actualEvidenceTypes.join(', ')}`);
            failed++;
            failures.push({
                testCase: testCase.name,
                missing: missingSteps,
                unexpected: unexpectedSteps
            });
        }
    } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
        failed++;
        failures.push({
            testCase: testCase.name,
            error: error.message
        });
    }
}

console.log('\n' + '='.repeat(80));
console.log(`\n📊 Test Results:`);
console.log(`   ✅ Passed: ${passed}/${testCases.length}`);
console.log(`   ❌ Failed: ${failed}/${testCases.length}`);

if (failures.length > 0) {
    console.log(`\n❌ Failures:`);
    failures.forEach(f => {
        console.log(`   - ${f.testCase}`);
        if (f.missing) console.log(`     Missing: ${f.missing.join(', ')}`);
        if (f.unexpected) console.log(`     Unexpected: ${f.unexpected.join(', ')}`);
        if (f.error) console.log(`     Error: ${f.error}`);
    });
}

if (failed === 0) {
    console.log('\n🎉 All tests passed! Conditional checklist engine is working correctly.');
    process.exit(0);
} else {
    console.log('\n⚠️  Some tests failed. Please review the conditional logic.');
    process.exit(1);
}


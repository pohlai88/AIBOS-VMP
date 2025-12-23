/**
 * Checklist Rules Engine
 * 
 * Generates checklist steps based on case type.
 * Enforces "evidence-first" doctrine by defining required evidence for each case type.
 */

/**
 * Get checklist steps for exception types
 * @param {string} exceptionType - Exception type: 'missing_grn', 'amount_mismatch', 'date_mismatch', 'missing_po', 'po_status', 'grn_status'
 * @returns {Array} Array of checklist step definitions specific to the exception
 */
export function getChecklistStepsForException(exceptionType) {
    const exceptionRules = {
        missing_grn: [
            {
                label: 'Upload Signed GRN',
                required_evidence_type: 'grn',
                description: 'Goods receipt note signed by receiving party (Required for 3-way match)'
            },
            {
                label: 'Upload Invoice PDF',
                required_evidence_type: 'invoice_pdf',
                description: 'Original invoice document in PDF format'
            }
        ],
        amount_mismatch: [
            {
                label: 'Upload Corrected Invoice',
                required_evidence_type: 'invoice_pdf',
                description: 'Corrected invoice document with accurate amount'
            },
            {
                label: 'Upload PO Confirmation',
                required_evidence_type: 'po_number',
                description: 'Purchase order document confirming the correct amount'
            },
            {
                label: 'Upload GRN with Correct Amount',
                required_evidence_type: 'grn',
                description: 'Goods receipt note showing the correct received amount'
            },
            {
                label: 'Dispute Explanation',
                required_evidence_type: 'misc',
                description: 'Document explaining the amount discrepancy'
            }
        ],
        date_mismatch: [
            {
                label: 'Upload Invoice PDF',
                required_evidence_type: 'invoice_pdf',
                description: 'Original invoice document in PDF format'
            },
            {
                label: 'Date Discrepancy Explanation',
                required_evidence_type: 'misc',
                description: 'Document explaining the date difference between invoice and PO/GRN'
            }
        ],
        missing_po: [
            {
                label: 'Upload PO Document',
                required_evidence_type: 'po_number',
                description: 'Purchase order document matching the invoice'
            },
            {
                label: 'Upload Invoice PDF',
                required_evidence_type: 'invoice_pdf',
                description: 'Original invoice document in PDF format'
            }
        ],
        po_status: [
            {
                label: 'Upload Updated PO',
                required_evidence_type: 'po_number',
                description: 'Updated purchase order document with correct status'
            },
            {
                label: 'PO Status Explanation',
                required_evidence_type: 'misc',
                description: 'Document explaining why PO status needs to be updated'
            }
        ],
        grn_status: [
            {
                label: 'Upload Verified GRN',
                required_evidence_type: 'grn',
                description: 'Goods receipt note with verified status'
            },
            {
                label: 'GRN Verification Explanation',
                required_evidence_type: 'misc',
                description: 'Document explaining GRN verification requirements'
            }
        ]
    };

    return exceptionRules[exceptionType] || [];
}

/**
 * Get checklist steps for a case type
 * @param {string} caseType - Case type: 'invoice', 'payment', 'onboarding', 'soa', 'general'
 * @param {string} exceptionType - Optional exception type to add exception-specific steps
 * @param {Object} vendorAttributes - Optional vendor attributes for conditional logic
 * @param {string} vendorAttributes.vendorType - Vendor type: 'domestic', 'international', 'individual', 'corporate'
 * @param {string} vendorAttributes.countryCode - ISO country code (e.g., 'US', 'GB', 'MY')
 * @returns {Array} Array of checklist step definitions
 */
export function getChecklistStepsForCaseType(caseType, exceptionType = null, vendorAttributes = {}) {
    const { vendorType = null, countryCode = null } = vendorAttributes;
    
    const rules = {
        invoice: [
            {
                label: 'Upload Invoice PDF',
                required_evidence_type: 'invoice_pdf',
                description: 'Original invoice document in PDF format'
            },
            {
                label: 'Confirm PO Number',
                required_evidence_type: 'po_number',
                description: 'Purchase order number matching the invoice'
            },
            {
                label: 'Upload Signed GRN',
                required_evidence_type: 'grn',
                description: 'Goods receipt note signed by receiving party'
            }
        ],
        payment: [
            {
                label: 'Upload Remittance Advice',
                required_evidence_type: 'remittance',
                description: 'Bank remittance advice or payment confirmation'
            },
            {
                label: 'Upload Bank Statement',
                required_evidence_type: 'bank_statement',
                description: 'Bank statement showing payment transaction'
            }
        ],
        onboarding: [
            {
                label: 'Company Registration Certificate',
                required_evidence_type: 'company_registration',
                description: 'Official company registration document',
                // Conditional: Required for all corporate vendors
                condition: (attrs) => attrs.vendorType !== 'individual'
            },
            {
                label: 'Bank Letter / Account Details',
                required_evidence_type: 'bank_letter',
                description: 'Bank confirmation letter with account details'
            },
            {
                label: 'Tax ID / VAT Certificate',
                required_evidence_type: 'tax_id',
                description: 'Tax identification number or VAT certificate',
                // Conditional: Required for all countries
                condition: () => true
            },
            // Conditional steps based on country
            {
                label: 'GST Registration (Malaysia)',
                required_evidence_type: 'tax_certificate',
                description: 'Malaysian GST registration certificate',
                condition: (attrs) => attrs.countryCode === 'MY'
            },
            {
                label: 'VAT Certificate (EU)',
                required_evidence_type: 'vat_certificate',
                description: 'EU VAT registration certificate',
                condition: (attrs) => {
                    const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
                    return euCountries.includes(attrs.countryCode);
                }
            },
            {
                label: 'EIN Certificate (USA)',
                required_evidence_type: 'ein_certificate',
                description: 'US Employer Identification Number certificate',
                condition: (attrs) => attrs.countryCode === 'US'
            },
            {
                label: 'W-9 Form (USA)',
                required_evidence_type: 'w9_form',
                description: 'US W-9 tax form for vendor payments',
                condition: (attrs) => attrs.countryCode === 'US'
            },
            // Conditional steps based on vendor type
            {
                label: 'International Trade License',
                required_evidence_type: 'trade_license',
                description: 'International trade license for cross-border transactions',
                condition: (attrs) => attrs.vendorType === 'international'
            },
            {
                label: 'Import/Export Permit',
                required_evidence_type: 'import_export_permit',
                description: 'Import/export permit for international vendors',
                condition: (attrs) => attrs.vendorType === 'international' && attrs.countryCode !== null
            }
        ],
        soa: [
            {
                label: 'Upload SOA Document',
                required_evidence_type: 'soa_document',
                description: 'Statement of Account document'
            },
            {
                label: 'Reconciliation Report',
                required_evidence_type: 'reconciliation',
                description: 'Reconciliation report matching SOA to invoices'
            }
        ],
        general: [
            {
                label: 'Supporting Documentation',
                required_evidence_type: 'misc',
                description: 'Any relevant supporting documents'
            }
        ]
    };

    let baseSteps = rules[caseType] || rules.general;
    
    // Apply conditional logic for onboarding case type
    if (caseType === 'onboarding' && (vendorType || countryCode)) {
        baseSteps = baseSteps.filter(step => {
            // If step has a condition function, evaluate it
            if (step.condition && typeof step.condition === 'function') {
                return step.condition({ vendorType, countryCode });
            }
            // If step has no condition, include it
            return true;
        });
    }
    
    // If exception type is provided, merge exception-specific steps
    if (exceptionType) {
        const exceptionSteps = getChecklistStepsForException(exceptionType);
        // Merge steps, prioritizing exception steps (they come first)
        return [...exceptionSteps, ...baseSteps];
    }
    
    return baseSteps;
}

/**
 * Ensure checklist steps exist for a case
 * Creates missing steps if they don't exist
 * @param {string} caseId - Case ID
 * @param {string} caseType - Case type
 * @param {Function} createStepFn - Function to create a step (from adapter)
 * @returns {Promise<Array>} Array of checklist steps
 */
export async function ensureChecklistSteps(caseId, caseType, createStepFn) {
    const requiredSteps = getChecklistStepsForCaseType(caseType);
    
    // This will be called from the adapter or route handler
    // For now, just return the step definitions
    return requiredSteps;
}


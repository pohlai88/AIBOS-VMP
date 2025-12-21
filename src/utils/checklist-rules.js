/**
 * Checklist Rules Engine
 * 
 * Generates checklist steps based on case type.
 * Enforces "evidence-first" doctrine by defining required evidence for each case type.
 */

/**
 * Get checklist steps for a case type
 * @param {string} caseType - Case type: 'invoice', 'payment', 'onboarding', 'soa', 'general'
 * @returns {Array} Array of checklist step definitions
 */
export function getChecklistStepsForCaseType(caseType) {
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
                description: 'Official company registration document'
            },
            {
                label: 'Bank Letter / Account Details',
                required_evidence_type: 'bank_letter',
                description: 'Bank confirmation letter with account details'
            },
            {
                label: 'Tax ID / VAT Certificate',
                required_evidence_type: 'tax_id',
                description: 'Tax identification number or VAT certificate'
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

    return rules[caseType] || rules.general;
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


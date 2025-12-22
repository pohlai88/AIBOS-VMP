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
 * @returns {Array} Array of checklist step definitions
 */
export function getChecklistStepsForCaseType(caseType, exceptionType = null) {
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

    const baseSteps = rules[caseType] || rules.general;
    
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


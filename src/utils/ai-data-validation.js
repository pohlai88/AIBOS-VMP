/**
 * AI Data Validation (Sprint 13.2)
 * Validates case data integrity, checks required documents, generates actionable responses
 */

/**
 * Validate case data integrity
 * @param {Object} caseData - Case data from database
 * @param {Array} checklistSteps - Checklist steps for the case
 * @param {Array} evidence - Evidence files uploaded for the case
 * @returns {Promise<Object>} Validation result
 */
export async function validateCaseData(caseData, checklistSteps, evidence) {
  try {
    const validation = {
      isValid: true,
      completeness: 0,
      missingRequired: [],
      missingOptional: [],
      dataIssues: [],
      actionableRequests: [],
      escalationRequired: false,
      escalationReason: null,
      confidence: 1.0,
    };

    // 1. Check required checklist steps have evidence
    const requiredSteps = checklistSteps.filter(
      step => step.required_evidence_type && step.status !== 'waived' && step.status !== 'verified'
    );

    for (const step of requiredSteps) {
      const hasEvidence = evidence.some(
        ev =>
          ev.checklist_step_id === step.id &&
          ev.evidence_type === step.required_evidence_type &&
          ev.status === 'verified'
      );

      if (!hasEvidence) {
        validation.missingRequired.push({
          stepId: step.id,
          stepLabel: step.label,
          evidenceType: step.required_evidence_type,
          description: step.description || `Missing ${step.required_evidence_type}`,
        });
        validation.isValid = false;
      }
    }

    // 2. Check case-specific data integrity
    const caseTypeIssues = await validateCaseTypeSpecific(caseData, evidence);
    validation.dataIssues.push(...caseTypeIssues);

    // 3. Calculate completeness score
    const totalRequired = requiredSteps.length;
    const completedRequired = totalRequired - validation.missingRequired.length;
    validation.completeness = totalRequired > 0 ? completedRequired / totalRequired : 1.0;

    // 4. Generate actionable requests
    validation.actionableRequests = generateActionableRequests(
      validation.missingRequired,
      validation.dataIssues,
      caseData
    );

    // 5. Determine if escalation is required
    const escalationCheck = checkEscalationThreshold(
      validation.completeness,
      validation.missingRequired.length,
      caseData,
      validation.dataIssues
    );
    validation.escalationRequired = escalationCheck.required;
    validation.escalationReason = escalationCheck.reason;

    // 6. Update confidence based on validation results
    validation.confidence = calculateConfidence(
      validation.completeness,
      validation.dataIssues.length,
      validation.missingRequired.length
    );

    return validation;
  } catch (error) {
    console.error('[AI Validation] Error validating case data:', error);
    // Return safe fallback
    return {
      isValid: false,
      completeness: 0,
      missingRequired: [],
      missingOptional: [],
      dataIssues: [{ type: 'validation_error', message: error.message }],
      actionableRequests: [],
      escalationRequired: true,
      escalationReason: 'Validation error occurred',
      confidence: 0.0,
    };
  }
}

/**
 * Validate case-type-specific data integrity
 */
async function validateCaseTypeSpecific(caseData, evidence) {
  const issues = [];
  const caseType = caseData.case_type;

  switch (caseType) {
    case 'invoice':
      issues.push(...validateInvoiceCase(caseData, evidence));
      break;
    case 'payment':
      issues.push(...validatePaymentCase(caseData, evidence));
      break;
    case 'onboarding':
      issues.push(...validateOnboardingCase(caseData, evidence));
      break;
    case 'soa':
      issues.push(...validateSOACase(caseData, evidence));
      break;
    default:
      // General case - minimal validation
      break;
  }

  return issues;
}

/**
 * Validate invoice case specific requirements
 */
function validateInvoiceCase(caseData, evidence) {
  const issues = [];

  // Check if invoice PDF is present
  const hasInvoicePDF = evidence.some(
    ev => ev.evidence_type === 'invoice_pdf' && ev.status === 'verified'
  );

  if (!hasInvoicePDF) {
    issues.push({
      type: 'missing_critical_evidence',
      severity: 'high',
      message: 'Invoice PDF is required but not found',
      evidenceType: 'invoice_pdf',
    });
  }

  // Check if linked invoice has required data
  if (caseData.linked_invoice_id) {
    // Would need to fetch invoice data - for now, just note it's linked
    // In production, validate invoice has amount, date, invoice number
  }

  return issues;
}

/**
 * Validate payment case specific requirements
 */
function validatePaymentCase(caseData, evidence) {
  const issues = [];

  // Check if remittance advice is present
  const hasRemittance = evidence.some(
    ev => ev.evidence_type === 'remittance' && ev.status === 'verified'
  );

  if (!hasRemittance) {
    issues.push({
      type: 'missing_critical_evidence',
      severity: 'high',
      message: 'Remittance advice is required but not found',
      evidenceType: 'remittance',
    });
  }

  return issues;
}

/**
 * Validate onboarding case specific requirements
 */
function validateOnboardingCase(caseData, evidence) {
  const issues = [];

  // Check for company registration
  const hasCompanyReg = evidence.some(
    ev => ev.evidence_type === 'company_registration' && ev.status === 'verified'
  );

  if (!hasCompanyReg) {
    issues.push({
      type: 'missing_critical_evidence',
      severity: 'high',
      message: 'Company registration certificate is required',
      evidenceType: 'company_registration',
    });
  }

  // Check for bank letter
  const hasBankLetter = evidence.some(
    ev => ev.evidence_type === 'bank_letter' && ev.status === 'verified'
  );

  if (!hasBankLetter) {
    issues.push({
      type: 'missing_critical_evidence',
      severity: 'high',
      message: 'Bank letter with account details is required',
      evidenceType: 'bank_letter',
    });
  }

  return issues;
}

/**
 * Validate SOA case specific requirements
 */
function validateSOACase(caseData, evidence) {
  const issues = [];

  // Check if SOA document is present
  const hasSOADoc = evidence.some(
    ev => ev.evidence_type === 'soa_document' && ev.status === 'verified'
  );

  if (!hasSOADoc) {
    issues.push({
      type: 'missing_critical_evidence',
      severity: 'high',
      message: 'SOA document is required but not found',
      evidenceType: 'soa_document',
    });
  }

  return issues;
}

/**
 * Generate actionable requests based on validation results
 */
function generateActionableRequests(missingRequired, dataIssues, caseData) {
  const requests = [];

  // Generate requests for missing required evidence
  for (const missing of missingRequired) {
    requests.push({
      type: 'upload_evidence',
      priority: 'high',
      message: `Please upload ${missing.stepLabel}`,
      action: {
        type: 'upload',
        evidenceType: missing.evidenceType,
        stepId: missing.stepId,
        description: missing.description,
      },
      template: getTemplateForEvidenceType(missing.evidenceType),
    });
  }

  // Generate requests for data issues
  for (const issue of dataIssues) {
    if (issue.type === 'missing_critical_evidence') {
      requests.push({
        type: 'upload_evidence',
        priority: 'high',
        message: issue.message,
        action: {
          type: 'upload',
          evidenceType: issue.evidenceType,
          description: issue.message,
        },
        template: getTemplateForEvidenceType(issue.evidenceType),
      });
    } else if (issue.type === 'data_inconsistency') {
      requests.push({
        type: 'clarify_data',
        priority: 'medium',
        message: issue.message,
        action: {
          type: 'message',
          suggestedMessage: issue.suggestedMessage || `Please clarify: ${issue.message}`,
        },
      });
    }
  }

  // Sort by priority
  requests.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

  return requests;
}

/**
 * Check if escalation to human is required
 */
function checkEscalationThreshold(completeness, missingCount, caseData, dataIssues) {
  // Escalate if completeness is below 30% after 7 days
  const caseAge = Date.now() - new Date(caseData.created_at).getTime();
  const daysOld = caseAge / (1000 * 60 * 60 * 24);

  if (completeness < 0.3 && daysOld > 7) {
    return {
      required: true,
      reason: `Case is ${daysOld.toFixed(0)} days old with only ${(completeness * 100).toFixed(0)}% completeness`,
    };
  }

  // Escalate if critical data issues
  const criticalIssues = dataIssues.filter(issue => issue.severity === 'critical');
  if (criticalIssues.length > 0) {
    return {
      required: true,
      reason: `${criticalIssues.length} critical data issue(s) detected`,
    };
  }

  // Escalate if missing more than 50% of required evidence after 14 days
  if (missingCount > 0 && daysOld > 14) {
    const requiredSteps = caseData.checklist_steps?.length || 0;
    const missingPercentage = missingCount / requiredSteps;
    if (missingPercentage > 0.5) {
      return {
        required: true,
        reason: `After 14 days, ${(missingPercentage * 100).toFixed(0)}% of required evidence is still missing`,
      };
    }
  }

  // Escalate if SLA is breached
  if (caseData.sla_due_at) {
    const slaDate = new Date(caseData.sla_due_at);
    if (slaDate < new Date() && completeness < 1.0) {
      return {
        required: true,
        reason: 'SLA deadline passed with incomplete evidence',
      };
    }
  }

  return {
    required: false,
    reason: null,
  };
}

/**
 * Calculate validation confidence score
 */
function calculateConfidence(completeness, issueCount, missingCount) {
  let confidence = completeness;

  // Reduce confidence for data issues
  confidence -= issueCount * 0.1;

  // Reduce confidence for missing required items
  confidence -= missingCount * 0.05;

  // Ensure confidence is between 0 and 1
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Get template/document guidance for evidence type
 */
function getTemplateForEvidenceType(evidenceType) {
  const templates = {
    invoice_pdf: {
      name: 'Invoice Template',
      description: 'Upload original invoice in PDF format',
      requirements: ['Invoice number', 'Date', 'Amount', 'Vendor details', 'Line items'],
    },
    grn: {
      name: 'GRN Template',
      description: 'Upload signed Goods Receipt Note',
      requirements: ['GRN number', 'Date', 'Received quantity', 'Signature'],
    },
    po_number: {
      name: 'PO Template',
      description: 'Upload Purchase Order document',
      requirements: ['PO number', 'Date', 'Items', 'Amount'],
    },
    remittance: {
      name: 'Remittance Template',
      description: 'Upload bank remittance advice',
      requirements: ['Payment reference', 'Date', 'Amount', 'Bank details'],
    },
    bank_statement: {
      name: 'Bank Statement Template',
      description: 'Upload bank statement showing transaction',
      requirements: ['Transaction date', 'Amount', 'Reference number'],
    },
    company_registration: {
      name: 'Company Registration Template',
      description: 'Upload official company registration certificate',
      requirements: ['Company name', 'Registration number', 'Issue date', 'Issuing authority'],
    },
    bank_letter: {
      name: 'Bank Letter Template',
      description: 'Upload bank confirmation letter',
      requirements: ['Account number', 'Bank name', 'Account holder name', 'Bank stamp/signature'],
    },
    tax_id: {
      name: 'Tax ID Template',
      description: 'Upload Tax ID or VAT certificate',
      requirements: ['Tax ID number', 'Company name', 'Issue date'],
    },
  };

  return (
    templates[evidenceType] || {
      name: 'Document Template',
      description: 'Upload required document',
      requirements: [],
    }
  );
}

/**
 * Generate AI response message for validation results
 */
export function generateValidationResponse(validation, caseData) {
  if (validation.isValid && validation.completeness === 1.0) {
    return {
      message:
        'All required documents have been submitted and verified. Your case is ready for processing.',
      type: 'success',
      actions: [],
    };
  }

  const messages = [];
  const actions = [];

  // Add messages for missing required items
  if (validation.missingRequired.length > 0) {
    const missingList = validation.missingRequired.map(m => `- ${m.stepLabel}`).join('\n');

    messages.push(`The following required documents are still missing:\n${missingList}`);

    // Add upload actions
    validation.missingRequired.forEach(missing => {
      actions.push({
        type: 'upload',
        label: `Upload ${missing.stepLabel}`,
        evidenceType: missing.evidenceType,
        stepId: missing.stepId,
      });
    });
  }

  // Add messages for data issues
  if (validation.dataIssues.length > 0) {
    const issuesList = validation.dataIssues.map(issue => `- ${issue.message}`).join('\n');

    messages.push(`Please address the following issues:\n${issuesList}`);
  }

  // Add completeness message
  const completenessPercent = (validation.completeness * 100).toFixed(0);
  messages.push(`Case completeness: ${completenessPercent}%`);

  // Add escalation notice if required
  if (validation.escalationRequired) {
    messages.push(
      `\n⚠️ This case has been escalated to a human agent: ${validation.escalationReason}`
    );
  }

  return {
    message: messages.join('\n\n'),
    type: validation.escalationRequired ? 'warning' : 'info',
    actions,
    completeness: validation.completeness,
    missingCount: validation.missingRequired.length,
  };
}

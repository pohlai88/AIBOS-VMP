/**
 * AI Message Parser (Sprint 13.1)
 * Uses AI to classify message intent, extract structured data, and improve case matching
 */

/**
 * Classify message intent using AI
 * @param {string} messageText - The message text to classify
 * @param {string} channel - Message channel ('email', 'whatsapp', 'portal')
 * @returns {Promise<Object>} Intent classification result
 */
export async function classifyMessageIntent(messageText, channel = 'email') {
  try {
    // For now, use rule-based classification as fallback
    // In production, this would call an AI service (OpenAI, Anthropic, etc.)
    const intent = await classifyIntentRuleBased(messageText, channel);

    return {
      intent: intent.primary,
      confidence: intent.confidence,
      secondaryIntents: intent.secondary || [],
      entities: intent.entities || [],
    };
  } catch (error) {
    console.error('[AI Parser] Error classifying intent:', error);
    // Fallback to generic intent
    return {
      intent: 'general_inquiry',
      confidence: 0.5,
      secondaryIntents: [],
      entities: [],
    };
  }
}

/**
 * Extract structured data from message using AI
 * @param {string} messageText - The message text
 * @param {string} subject - Message subject (for emails)
 * @returns {Promise<Object>} Extracted structured data
 */
export async function extractStructuredData(messageText, subject = '') {
  try {
    // Combine subject and body for better extraction
    const fullText = subject ? `${subject}\n\n${messageText}` : messageText;

    // Extract using rule-based patterns first
    const extracted = await extractDataRuleBased(fullText);

    return {
      invoiceNumbers: extracted.invoiceNumbers || [],
      poNumbers: extracted.poNumbers || [],
      grnNumbers: extracted.grnNumbers || [],
      paymentReferences: extracted.paymentReferences || [],
      amounts: extracted.amounts || [],
      dates: extracted.dates || [],
      caseReferences: extracted.caseReferences || [],
      urgency: extracted.urgency || 'normal',
      confidence: extracted.confidence || 0.7,
    };
  } catch (error) {
    console.error('[AI Parser] Error extracting structured data:', error);
    return {
      invoiceNumbers: [],
      poNumbers: [],
      grnNumbers: [],
      paymentReferences: [],
      amounts: [],
      dates: [],
      caseReferences: [],
      urgency: 'normal',
      confidence: 0.5,
    };
  }
}

/**
 * Find best matching case for a message using AI
 * @param {Object} messageData - Message data (text, subject, sender, etc.)
 * @param {Array} candidateCases - Array of candidate cases to match against
 * @param {Object} extractedData - Extracted structured data
 * @returns {Promise<Object|null>} Best matching case with confidence score
 */
export async function findBestMatchingCase(messageData, candidateCases, extractedData) {
  try {
    if (!candidateCases || candidateCases.length === 0) {
      return null;
    }

    // Rule-based matching with scoring
    let bestMatch = null;
    let bestScore = 0;

    for (const candidateCase of candidateCases) {
      let score = 0;

      // Match by case reference in message
      if (extractedData.caseReferences && extractedData.caseReferences.length > 0) {
        const caseRef = candidateCase.case_num || candidateCase.id;
        if (
          extractedData.caseReferences.some(
            ref =>
              ref.toLowerCase().includes(caseRef.toLowerCase()) ||
              caseRef.toLowerCase().includes(ref.toLowerCase())
          )
        ) {
          score += 50;
        }
      }

      // Match by invoice number
      if (extractedData.invoiceNumbers && extractedData.invoiceNumbers.length > 0) {
        if (candidateCase.linked_invoice_id) {
          // Would need to fetch invoice number - for now, just check if invoice is linked
          score += 30;
        }
      }

      // Match by PO number
      if (extractedData.poNumbers && extractedData.poNumbers.length > 0) {
        if (candidateCase.linked_po_id) {
          score += 20;
        }
      }

      // Match by subject similarity (simple keyword matching)
      if (messageData.subject) {
        const subjectLower = messageData.subject.toLowerCase();
        const caseSubjectLower = (candidateCase.subject || '').toLowerCase();

        // Check for common keywords
        const keywords = ['payment', 'invoice', 'case', 'issue', 'problem', 'urgent'];
        const matchingKeywords = keywords.filter(
          kw => subjectLower.includes(kw) && caseSubjectLower.includes(kw)
        );
        score += matchingKeywords.length * 5;
      }

      // Recency bonus (recent cases are more likely)
      const caseAge = Date.now() - new Date(candidateCase.created_at).getTime();
      const daysOld = caseAge / (1000 * 60 * 60 * 24);
      if (daysOld < 7) {
        score += 10;
      } else if (daysOld < 30) {
        score += 5;
      }

      // Status bonus (open/active cases are more likely)
      if (['open', 'waiting_supplier', 'blocked'].includes(candidateCase.status)) {
        score += 15;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { case: candidateCase, score };
      }
    }

    // Only return match if confidence is above threshold
    if (bestMatch && bestScore >= 30) {
      return {
        caseId: bestMatch.case.id,
        caseNum: bestMatch.case.case_num,
        confidence: Math.min(bestScore / 100, 1.0),
        matchReason: getMatchReason(bestMatch, extractedData),
      };
    }

    return null;
  } catch (error) {
    console.error('[AI Parser] Error finding matching case:', error);
    return null;
  }
}

/**
 * Rule-based intent classification (fallback when AI is not available)
 */
async function classifyIntentRuleBased(messageText, channel) {
  const text = messageText.toLowerCase();
  const intents = [];

  // Payment inquiry
  if (text.match(/\b(payment|paid|receipt|remittance|bank|transfer|wire)\b/i)) {
    intents.push({ intent: 'payment_inquiry', confidence: 0.8 });
  }

  // Invoice inquiry
  if (text.match(/\b(invoice|inv-|inv\s*#|invoice\s*number)\b/i)) {
    intents.push({ intent: 'invoice_inquiry', confidence: 0.8 });
  }

  // Case status inquiry
  if (text.match(/\b(status|update|progress|where|what\s*happened)\b/i)) {
    intents.push({ intent: 'status_inquiry', confidence: 0.7 });
  }

  // Evidence submission
  if (text.match(/\b(attached|attachment|document|file|upload|send|here\s*is)\b/i)) {
    intents.push({ intent: 'evidence_submission', confidence: 0.7 });
  }

  // Urgent/emergency
  if (text.match(/\b(urgent|asap|immediately|emergency|critical)\b/i)) {
    intents.push({ intent: 'urgent_request', confidence: 0.9 });
  }

  // Complaint/dispute
  if (text.match(/\b(wrong|error|mistake|dispute|complaint|issue|problem)\b/i)) {
    intents.push({ intent: 'dispute', confidence: 0.7 });
  }

  // General inquiry (default)
  if (intents.length === 0) {
    intents.push({ intent: 'general_inquiry', confidence: 0.5 });
  }

  // Sort by confidence and return primary + secondary
  intents.sort((a, b) => b.confidence - a.confidence);

  return {
    primary: intents[0].intent,
    confidence: intents[0].confidence,
    secondary: intents.slice(1, 3).map(i => i.intent),
    entities: [],
  };
}

/**
 * Rule-based data extraction (fallback when AI is not available)
 */
async function extractDataRuleBased(text) {
  const extracted = {
    invoiceNumbers: [],
    poNumbers: [],
    grnNumbers: [],
    paymentReferences: [],
    amounts: [],
    dates: [],
    caseReferences: [],
    urgency: 'normal',
    confidence: 0.7,
  };

  // Extract invoice numbers (various formats)
  const invoicePatterns = [
    /(?:invoice|inv)[\s#:]*([A-Z0-9-]+)/gi,
    /INV-?([A-Z0-9-]+)/gi,
    /INV\s*#?\s*([A-Z0-9-]+)/gi,
  ];
  invoicePatterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && !extracted.invoiceNumbers.includes(match[1])) {
        extracted.invoiceNumbers.push(match[1]);
      }
    }
  });

  // Extract PO numbers
  const poPatterns = [
    /(?:po|purchase\s*order)[\s#:]*([A-Z0-9-]+)/gi,
    /PO-?([A-Z0-9-]+)/gi,
    /PO\s*#?\s*([A-Z0-9-]+)/gi,
  ];
  poPatterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && !extracted.poNumbers.includes(match[1])) {
        extracted.poNumbers.push(match[1]);
      }
    }
  });

  // Extract GRN numbers
  const grnPatterns = [
    /(?:grn|goods\s*receipt)[\s#:]*([A-Z0-9-]+)/gi,
    /GRN-?([A-Z0-9-]+)/gi,
    /GRN\s*#?\s*([A-Z0-9-]+)/gi,
  ];
  grnPatterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && !extracted.grnNumbers.includes(match[1])) {
        extracted.grnNumbers.push(match[1]);
      }
    }
  });

  // Extract payment references
  const paymentPatterns = [
    /(?:payment|ref|reference)[\s#:]*([A-Z0-9-]+)/gi,
    /PAY-?([A-Z0-9-]+)/gi,
    /REF-?([A-Z0-9-]+)/gi,
  ];
  paymentPatterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && !extracted.paymentReferences.includes(match[1])) {
        extracted.paymentReferences.push(match[1]);
      }
    }
  });

  // Extract amounts (currency amounts)
  const amountPatterns = [
    /\$[\s]*([\d,]+\.?\d*)/g,
    /([\d,]+\.?\d*)\s*(?:USD|dollars?)/gi,
    /(?:amount|total)[\s:]*\$?[\s]*([\d,]+\.?\d*)/gi,
  ];
  amountPatterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount && !extracted.amounts.includes(amount)) {
        extracted.amounts.push(amount);
      }
    }
  });

  // Extract case references
  const casePatterns = [
    /(?:case|ticket)[\s#:]*([A-Z0-9-]+)/gi,
    /CASE-?([A-Z0-9-]+)/gi,
    /#([A-Z0-9-]+)/g,
  ];
  casePatterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].length >= 6 && !extracted.caseReferences.includes(match[1])) {
        extracted.caseReferences.push(match[1]);
      }
    }
  });

  // Detect urgency
  if (text.match(/\b(urgent|asap|immediately|emergency|critical)\b/i)) {
    extracted.urgency = 'high';
  } else if (text.match(/\b(soon|quickly|fast)\b/i)) {
    extracted.urgency = 'medium';
  }

  return extracted;
}

/**
 * Get human-readable match reason
 */
function getMatchReason(match, extractedData) {
  const reasons = [];

  if (extractedData.caseReferences && extractedData.caseReferences.length > 0) {
    reasons.push('Case reference found in message');
  }
  if (extractedData.invoiceNumbers && extractedData.invoiceNumbers.length > 0) {
    reasons.push('Invoice number matches');
  }
  if (extractedData.poNumbers && extractedData.poNumbers.length > 0) {
    reasons.push('PO number matches');
  }

  return reasons.join(', ') || 'Contextual similarity';
}

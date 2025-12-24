/**
 * SOA Autonomous Matching Engine (AHA Logic)
 * 
 * Implements deterministic first, heuristic last matching strategy
 * with 5 matching passes as per SOA Reconciliation Blueprint
 */

import { vmpAdapter } from '../adapters/supabase.js';
import { logError } from './errors.js';

/**
 * Normalize document number for fuzzy matching
 * Strips spaces, dashes, punctuation, converts to uppercase
 */
function normalizeDocNumber(docNo) {
    if (!docNo) return '';
    return docNo.toString()
        .replace(/[\s\-_.,]/g, '')
        .toUpperCase()
        .trim();
}

/**
 * Determine whether partial matching is allowed for this SOA line
 * Prefer explicit opt-in to avoid false positives in negative tests
 */
function allowPartial(soaLine, opts) {
    if (opts && opts.allowPartial === true) return true;
    if (soaLine && soaLine.allow_partial === true) return true;
    if (soaLine && soaLine.match_mode === 'partial') return true;
    return false;
}

/**
 * Calculate date difference in days
 */
function dateDifferenceDays(date1, date2) {
    if (!date1 || !date2) return null;
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if amount is within tolerance
 */
function isAmountWithinTolerance(amount1, amount2, absoluteTolerance = 1.00, percentageTolerance = 0.005) {
    if (!amount1 || !amount2) return false;
    const diff = Math.abs(parseFloat(amount1) - parseFloat(amount2));
    const avg = (parseFloat(amount1) + parseFloat(amount2)) / 2;
    const percentageDiff = avg > 0 ? diff / avg : 0;
    
    return diff <= absoluteTolerance || percentageDiff <= percentageTolerance;
}

/**
 * Pass 1: Exact Match
 * vendor + doc_no + currency + amount (+ date if present) all exact
 */
async function pass1ExactMatch(soaLine, invoices) {
    for (const invoice of invoices) {
        // Strict document match (no fuzzy normalization beyond trim/upper)
        const docMatch = (
            (soaLine.invoice_number ?? '')
                .toString()
                .trim()
                .toUpperCase()
        ) === (
            (invoice.invoice_number ?? '')
                .toString()
                .trim()
                .toUpperCase()
        );
        const amountMatch = parseFloat(soaLine.amount) === parseFloat(invoice.total_amount);
        const currencyMatch = (soaLine.currency_code || soaLine.currency || 'USD') === (invoice.currency || 'USD');
        // If both dates are present, require exact date match for Pass 1
        const haveBothDates = Boolean(soaLine.invoice_date) && Boolean(invoice.invoice_date);
        const dateExactMatch = haveBothDates ? (new Date(soaLine.invoice_date).toISOString().slice(0,10) === new Date(invoice.invoice_date).toISOString().slice(0,10)) : true;
        
        if (docMatch && amountMatch && currencyMatch && dateExactMatch) {
            return {
                invoice,
                matchType: 'deterministic',
                isExactMatch: true,
                confidence: 1.0,
                matchScore: 100,
                matchCriteria: {
                    invoice_number: true,
                    amount: true,
                    currency: true,
                    date: haveBothDates ? true : false
                },
                pass: 1
            };
        }
    }
    return null;
}

/**
 * Pass 2: Date Tolerance Match
 * Same as Pass 1, but with ±7 days date tolerance
 */
async function pass2DateToleranceMatch(soaLine, invoices) {
    const dateToleranceDays = 7;
    
    for (const invoice of invoices) {
        // Strict document match for Pass 2; fuzzy handled in Pass 3
        const docMatch = (
            (soaLine.invoice_number ?? '')
                .toString()
                .trim()
                .toUpperCase()
        ) === (
            (invoice.invoice_number ?? '')
                .toString()
                .trim()
                .toUpperCase()
        );
        const amountMatch = parseFloat(soaLine.amount) === parseFloat(invoice.total_amount);
        const currencyMatch = (soaLine.currency_code || soaLine.currency || 'USD') === (invoice.currency || 'USD');
        
        if (docMatch && amountMatch && currencyMatch) {
            const dateDiff = dateDifferenceDays(soaLine.invoice_date, invoice.invoice_date);
            if (dateDiff !== null && dateDiff <= dateToleranceDays) {
                return {
                    invoice,
                    matchType: 'probabilistic',
                    isExactMatch: false,
                    confidence: 0.95,
                    matchScore: 95,
                    matchCriteria: {
                        invoice_number: true,
                        amount: true,
                        currency: true,
                        date: true,
                        dateTolerance: dateDiff
                    },
                    pass: 2
            };
            }
        }
    }
    return null;
}

/**
 * Pass 3: Fuzzy Doc Match
 * Normalizes doc_no (strip spaces, dashes, punctuation)
 */
async function pass3FuzzyDocMatch(soaLine, invoices) {
    const normalizedSOADoc = normalizeDocNumber(soaLine.invoice_number);
    
    for (const invoice of invoices) {
        const normalizedInvoiceDoc = normalizeDocNumber(invoice.invoice_number);
        
        if (normalizedSOADoc === normalizedInvoiceDoc) {
            const amountMatch = parseFloat(soaLine.amount) === parseFloat(invoice.total_amount);
            const currencyMatch = (soaLine.currency_code || soaLine.currency || 'USD') === (invoice.currency || 'USD');
            
            if (amountMatch && currencyMatch) {
                return {
                    invoice,
                    matchType: 'probabilistic',
                    isExactMatch: false,
                    confidence: 0.90,
                    matchScore: 90,
                    matchCriteria: {
                        invoice_number: true,
                        amount: true,
                        currency: true,
                        date: false,
                        fuzzyDoc: true
                    },
                    pass: 3
                };
            }
        }
    }
    return null;
}

/**
 * Pass 4: Amount Tolerance Match
 * Absolute tolerance (e.g. RM 1.00) or percentage tolerance (e.g. 0.5%)
 */
async function pass4AmountToleranceMatch(soaLine, invoices) {
    const normalizedSOADoc = normalizeDocNumber(soaLine.invoice_number);
    
    for (const invoice of invoices) {
        const normalizedInvoiceDoc = normalizeDocNumber(invoice.invoice_number);
        const docMatch = normalizedSOADoc === normalizedInvoiceDoc;
        const currencyMatch = (soaLine.currency_code || soaLine.currency || 'USD') === (invoice.currency || 'USD');
        
        if (docMatch && currencyMatch) {
            const amountMatch = isAmountWithinTolerance(
                soaLine.amount,
                invoice.total_amount,
                1.00, // RM 1.00 absolute tolerance
                0.005 // 0.5% percentage tolerance
            );
            
            if (amountMatch) {
                const amountDiff = Math.abs(parseFloat(soaLine.amount) - parseFloat(invoice.total_amount));
                return {
                    invoice,
                    matchType: 'probabilistic',
                    isExactMatch: false,
                    confidence: 0.85,
                    matchScore: 85,
                    matchCriteria: {
                        invoice_number: true,
                        amount: true,
                        currency: true,
                        date: false,
                        amountTolerance: amountDiff
                    },
                    pass: 4
                };
            }
        }
    }
    return null;
}

/**
 * Pass 5: Group / Partial Match
 * One invoice ↔ multiple payments
 * Partial settlement with residual balance
 */
async function pass5PartialMatch(soaLine, invoices, payments = []) {
    // This is a simplified version - full implementation would track partial settlements
    // For now, we'll look for invoices that could be partially matched
    
    const normalizedSOADoc = normalizeDocNumber(soaLine.invoice_number);
    
    for (const invoice of invoices) {
        const normalizedInvoiceDoc = normalizeDocNumber(invoice.invoice_number);
        const docMatch = normalizedSOADoc === normalizedInvoiceDoc;
        const currencyMatch = (soaLine.currency_code || soaLine.currency || 'USD') === (invoice.currency || 'USD');
        
        if (docMatch && currencyMatch) {
            const invoiceAmount = parseFloat(invoice.total_amount);
            const soaAmount = parseFloat(soaLine.amount);
            
            // Check if SOA amount is less than invoice (partial payment)
            if (soaAmount < invoiceAmount && soaAmount > 0) {
                // Check if there are payments that could account for the difference
                const remainingAmount = invoiceAmount - soaAmount;
                
                return {
                    invoice,
                    matchType: 'probabilistic',
                    isExactMatch: false,
                    confidence: 0.75,
                    matchScore: 75,
                    matchCriteria: {
                        invoice_number: true,
                        amount: false,
                        currency: true,
                        date: false,
                        partialMatch: true,
                        remainingAmount: remainingAmount
                    },
                    pass: 5,
                    partialAmount: soaAmount
                };
            }
        }
    }
    return null;
}

/**
 * Autonomous Matching Engine (AHA Logic)
 * Runs all 5 passes and returns best match
 */
export async function matchSOALine(soaLine, vendorId, companyId = null) {
    try {
        // Get invoices for matching
        const invoices = await vmpAdapter.getInvoices(vendorId, companyId, {
            status: ['pending', 'approved', 'paid']
        });

        // Normalize invoices to canonical shape defensively
        const normalizeInvoice = (inv) => ({
            ...inv,
            invoice_number: inv.invoice_number ?? inv.invoice_num ?? null,
            total_amount: inv.total_amount ?? inv.amount ?? null,
            currency: inv.currency ?? inv.currency_code ?? 'USD',
            invoice_date: inv.invoice_date ?? inv.date ?? null,
        });
        const invs = (invoices || []).map(normalizeInvoice);

        if (!invs || invs.length === 0) {
            return {
                match: null,
                pass: 0,
                reason: 'No invoices available for matching'
            };
        }

        // Run matching passes in order
        let match = await pass1ExactMatch(soaLine, invs);
        if (match) {
            return { match, pass: 1, reason: 'Exact match found' };
        }

        match = await pass2DateToleranceMatch(soaLine, invs);
        if (match) {
            return { match, pass: 2, reason: 'Date tolerance match found' };
        }

        match = await pass3FuzzyDocMatch(soaLine, invs);
        if (match) {
            return { match, pass: 3, reason: 'Fuzzy document match found' };
        }

        match = await pass4AmountToleranceMatch(soaLine, invs);
        if (match) {
            return { match, pass: 4, reason: 'Amount tolerance match found' };
        }

        // Run partial matching only when explicitly allowed
        if (allowPartial(soaLine, null)) {
            match = await pass5PartialMatch(soaLine, invs);
            if (match) {
                return { match, pass: 5, reason: 'Partial match found' };
            }
        }

        return {
            match: null,
            pass: 0,
            reason: 'No match found after all passes'
        };
    } catch (error) {
        logError(error, { operation: 'matchSOALine', soaLineId: soaLine.id });
        throw error;
    }
}

/**
 * Batch match multiple SOA lines
 */
export async function batchMatchSOALines(soaLines, vendorId, companyId = null) {
    const results = [];
    
    for (const soaLine of soaLines) {
        try {
            const matchResult = await matchSOALine(soaLine, vendorId, companyId);
            results.push({
                soaLineId: soaLine.id,
                soaLine: soaLine, // Include full line data for reference
                ...matchResult
            });
        } catch (error) {
            logError(error, { operation: 'batchMatchSOALines', soaLineId: soaLine.id });
            results.push({
                soaLineId: soaLine.id,
                soaLine: soaLine,
                match: null,
                pass: 0,
                reason: 'Error during matching',
                error: error.message
            });
        }
    }
    
    return results;
}


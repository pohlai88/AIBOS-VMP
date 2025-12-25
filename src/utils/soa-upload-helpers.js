/**
 * SOA Upload Helper Utilities
 * Smart period detection, error message formatting, and upload assistance
 */

/**
 * Detect period from filename or content
 * @param {string} filename - File name
 * @param {string} content - File content (first 500 chars for PDF, full for CSV)
 * @returns {Object|null} - { period_start, period_end } or null
 */
export function detectPeriodFromFilename(filename, content = '') {
  if (!filename && !content) return null;

  const text = (filename || '') + ' ' + (content || '');
  const lowerText = text.toLowerCase();

  // Pattern 1: Month Year in filename (e.g., "SOA_Jan2024.pdf", "SOA_January_2024.csv")
  const monthYearPatterns = [
    /(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december)[\s_-]?(\d{4})/i,
    /(\d{4})[\s_-]?(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december)/i,
  ];

  for (const pattern of monthYearPatterns) {
    const match = text.match(pattern);
    if (match) {
      const monthNames = {
        jan: 1,
        january: 1,
        feb: 2,
        february: 2,
        mar: 3,
        march: 3,
        apr: 4,
        april: 4,
        may: 5,
        jun: 6,
        june: 6,
        jul: 7,
        july: 7,
        aug: 8,
        august: 8,
        sep: 9,
        september: 9,
        oct: 10,
        october: 10,
        nov: 11,
        november: 11,
        dec: 12,
        december: 12,
      };

      let year, month;
      if (match[1] && isNaN(match[1])) {
        // Format: "Jan2024" or "January 2024"
        month = monthNames[match[1].toLowerCase()];
        year = parseInt(match[2] || match[1].replace(/[^0-9]/g, '').substring(0, 4));
      } else {
        // Format: "2024Jan" or "2024 January"
        year = parseInt(match[1]);
        month = monthNames[match[2].toLowerCase()];
      }

      if (month && year) {
        const periodStart = new Date(year, month - 1, 1);
        const periodEnd = new Date(year, month, 0); // Last day of month
        return {
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          confidence: 0.9,
          source: 'filename',
        };
      }
    }
  }

  // Pattern 2: Date range in filename (e.g., "SOA_2024-01-01_to_2024-01-31.pdf")
  const dateRangePattern =
    /(\d{4}[-/]\d{1,2}[-/]\d{1,2})[\s_-]?(?:to|until|till|-)[\s_-]?(\d{4}[-/]\d{1,2}[-/]\d{1,2})/i;
  const rangeMatch = text.match(dateRangePattern);
  if (rangeMatch) {
    try {
      const startDate = new Date(rangeMatch[1].replace(/\//g, '-'));
      const endDate = new Date(rangeMatch[2].replace(/\//g, '-'));
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        return {
          period_start: startDate.toISOString().split('T')[0],
          period_end: endDate.toISOString().split('T')[0],
          confidence: 0.95,
          source: 'filename',
        };
      }
    } catch (e) {
      // Invalid date, continue
    }
  }

  // Pattern 3: Look for "Statement for [Month] [Year]" in content
  const statementPattern =
    /statement\s+(?:for|of|period)\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december)[\s_-]?(\d{4})/i;
  const statementMatch = lowerText.match(statementPattern);
  if (statementMatch) {
    const monthNames = {
      jan: 1,
      january: 1,
      feb: 2,
      february: 2,
      mar: 3,
      march: 3,
      apr: 4,
      april: 4,
      may: 5,
      jun: 6,
      june: 6,
      jul: 7,
      july: 7,
      aug: 8,
      august: 8,
      sep: 9,
      september: 9,
      oct: 10,
      october: 10,
      nov: 11,
      november: 11,
      dec: 12,
      december: 12,
    };
    const month = monthNames[statementMatch[1].toLowerCase()];
    const year = parseInt(statementMatch[2]);
    if (month && year) {
      const periodStart = new Date(year, month - 1, 1);
      const periodEnd = new Date(year, month, 0);
      return {
        period_start: periodStart.toISOString().split('T')[0],
        period_end: periodEnd.toISOString().split('T')[0],
        confidence: 0.85,
        source: 'content',
      };
    }
  }

  return null;
}

/**
 * Format user-friendly error messages
 * @param {string} error - Technical error message
 * @param {Object} context - Error context (row, field, value, etc.)
 * @returns {string} - User-friendly error message
 */
export function formatUserFriendlyError(error, context = {}) {
  const { row, field, value, expectedFormat } = context;

  // Date format errors
  if (error.includes('date') || error.includes('Date')) {
    const friendlyValue = value ? `"${value}"` : 'the date field';
    const formatHint = expectedFormat || 'DD/MM/YYYY or YYYY-MM-DD';
    return `Line ${row || '?'}: Date looks wrong. Found ${friendlyValue}, but expected format: ${formatHint}. Please check and correct the date.`;
  }

  // Amount errors
  if (error.includes('amount') || error.includes('Amount') || error.includes('Invalid amount')) {
    const friendlyValue = value ? `"${value}"` : 'the amount field';
    return `Line ${row || '?'}: Amount looks wrong. Found ${friendlyValue}, but expected a number (e.g., 1000.00). Please check and correct the amount.`;
  }

  // Missing field errors
  if (error.includes('Missing') || error.includes('missing') || error.includes('required')) {
    const fieldName = field
      ? field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      : 'a required field';
    return `Line ${row || '?'}: Missing ${fieldName}. Please add this information to the file.`;
  }

  // Document number errors
  if (
    error.includes('Document Number') ||
    error.includes('doc_no') ||
    error.includes('invoice_number')
  ) {
    return `Line ${row || '?'}: Document number is missing or invalid. Please ensure each line has a valid invoice/document number.`;
  }

  // Generic errors - make them more friendly
  let friendlyError = error
    .replace(/Row (\d+)/gi, 'Line $1')
    .replace(/Invalid date format/gi, 'Date format is incorrect')
    .replace(/Invalid amount/gi, 'Amount is incorrect')
    .replace(/Missing required fields/gi, 'Some required information is missing')
    .replace(/CSV must have/gi, 'The file must have')
    .replace(/Failed to parse/gi, 'Could not read');

  // Add helpful suggestions
  if (friendlyError.includes('parse') || friendlyError.includes('read')) {
    friendlyError +=
      ' Please check that the file format is correct. You can download a template to see the expected format.';
  }

  return friendlyError;
}

/**
 * Get common period suggestions (last month, current month, etc.)
 * @returns {Array} - Array of period suggestions
 */
export function getPeriodSuggestions() {
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

  const formatPeriod = startDate => {
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    return {
      label: startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      period_start: startDate.toISOString().split('T')[0],
      period_end: endDate.toISOString().split('T')[0],
    };
  };

  return [formatPeriod(currentMonth), formatPeriod(lastMonth), formatPeriod(twoMonthsAgo)];
}

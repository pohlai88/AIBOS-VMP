/**
 * AI Search Utility (Sprint 13.3)
 * Natural language search with context-aware results and AI-powered suggestions
 */

/**
 * Parse natural language query to extract search intent
 * @param {string} query - Natural language search query
 * @returns {Promise<Object>} Parsed search intent
 */
export async function parseSearchIntent(query) {
  try {
    const queryLower = query.toLowerCase().trim();

    // Rule-based intent classification (can be enhanced with AI service)
    const intent = {
      type: 'general', // 'case', 'invoice', 'payment', 'action', 'general'
      entities: [],
      filters: {},
      keywords: [],
      confidence: 0.7,
    };

    // Extract entity types
    if (queryLower.match(/\b(case|ticket|issue|problem)\b/)) {
      intent.type = 'case';
      intent.confidence = 0.9;
    } else if (queryLower.match(/\b(invoice|inv|bill)\b/)) {
      intent.type = 'invoice';
      intent.confidence = 0.9;
    } else if (queryLower.match(/\b(payment|paid|remittance|receipt)\b/)) {
      intent.type = 'payment';
      intent.confidence = 0.9;
    }

    // Extract status filters
    if (queryLower.match(/\b(open|pending|waiting)\b/)) {
      intent.filters.status = 'open';
    } else if (queryLower.match(/\b(closed|resolved|completed|done)\b/)) {
      intent.filters.status = 'resolved';
    } else if (queryLower.match(/\b(blocked|stuck|escalated)\b/)) {
      intent.filters.status = 'blocked';
    }

    // Extract date filters
    const todayMatch = queryLower.match(/\b(today|todays)\b/);
    const weekMatch = queryLower.match(/\b(this week|last week|week)\b/);
    const monthMatch = queryLower.match(/\b(this month|last month|month)\b/);

    if (todayMatch) {
      intent.filters.dateRange = 'today';
    } else if (weekMatch) {
      intent.filters.dateRange = 'week';
    } else if (monthMatch) {
      intent.filters.dateRange = 'month';
    }

    // Extract amount filters
    const amountMatch = queryLower.match(/\$?([\d,]+(?:\.\d{2})?)\s*(?:thousand|k|million|m)?/i);
    if (amountMatch) {
      intent.filters.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }

    // Extract IDs (case numbers, invoice numbers, etc.)
    const caseIdMatch = queryLower.match(/\b(case|case-|#)([a-z0-9-]+)\b/i);
    if (caseIdMatch) {
      intent.entities.push({ type: 'case_id', value: caseIdMatch[2] });
    }

    const invoiceNumMatch = queryLower.match(/\b(inv|invoice|inv-)([a-z0-9-]+)\b/i);
    if (invoiceNumMatch) {
      intent.entities.push({ type: 'invoice_num', value: invoiceNumMatch[2] });
    }

    const poMatch = queryLower.match(/\b(po|po-|purchase order)([a-z0-9-]+)\b/i);
    if (poMatch) {
      intent.entities.push({ type: 'po_number', value: poMatch[2] });
    }

    // Extract keywords (remaining words after removing filters)
    const stopWords = [
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
    ];
    const words = queryLower
      .split(/\s+/)
      .filter(
        word =>
          word.length > 2 &&
          !stopWords.includes(word) &&
          !word.match(/^(case|invoice|payment|inv|po)$/i)
      );
    intent.keywords = words;

    return intent;
  } catch (error) {
    console.error('[AI Search] Error parsing search intent:', error);
    // Fallback to simple keyword search
    return {
      type: 'general',
      entities: [],
      filters: {},
      keywords: query
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2),
      confidence: 0.5,
    };
  }
}

/**
 * Score search results based on relevance
 * @param {Object} item - Search result item
 * @param {Object} intent - Parsed search intent
 * @returns {number} Relevance score (0-1)
 */
export function scoreSearchResult(item, intent) {
  let score = 0.5; // Base score

  const itemText = `${item.label || ''} ${item.hint || ''} ${item.metadata || ''}`.toLowerCase();

  // Exact match bonus
  if (itemText.includes(intent.keywords.join(' '))) {
    score += 0.3;
  }

  // Keyword matches
  const matchedKeywords = intent.keywords.filter(kw => itemText.includes(kw));
  score += (matchedKeywords.length / intent.keywords.length) * 0.2;

  // Entity matches
  for (const entity of intent.entities) {
    if (item.metadata && item.metadata.toLowerCase().includes(entity.value.toLowerCase())) {
      score += 0.2;
    }
  }

  // Type match bonus
  if (intent.type !== 'general') {
    if (intent.type === 'case' && item.category === 'Cases') {
      score += 0.1;
    } else if (intent.type === 'invoice' && item.category === 'Invoices') {
      score += 0.1;
    } else if (intent.type === 'payment' && item.category === 'Payments') {
      score += 0.1;
    }
  }

  // Recency bonus (if item has timestamp)
  if (item.timestamp) {
    const itemAge = Date.now() - new Date(item.timestamp).getTime();
    const daysOld = itemAge / (1000 * 60 * 60 * 24);
    if (daysOld < 7) {
      score += 0.1;
    } else if (daysOld < 30) {
      score += 0.05;
    }
  }

  return Math.min(1, score);
}

/**
 * Generate AI-powered search suggestions
 * @param {string} query - Current search query
 * @param {Array} recentSearches - Recent search history
 * @param {Object} userContext - User context (vendor, role, etc.)
 * @returns {Promise<Array>} Search suggestions
 */
export async function generateSearchSuggestions(query, recentSearches = [], userContext = {}) {
  try {
    const suggestions = [];

    // If query is empty, suggest common searches
    if (!query || query.length === 0) {
      return [
        { text: 'Show me open cases', category: 'suggestion' },
        { text: 'Find invoice INV-12345', category: 'suggestion' },
        { text: 'Payments this month', category: 'suggestion' },
        { text: 'Blocked cases', category: 'suggestion' },
        { text: 'Recent payments', category: 'suggestion' },
      ];
    }

    const queryLower = query.toLowerCase();

    // Suggest completions based on query
    if (queryLower.startsWith('case')) {
      suggestions.push(
        { text: `${query} - open`, category: 'completion' },
        { text: `${query} - blocked`, category: 'completion' },
        { text: `${query} - this week`, category: 'completion' }
      );
    } else if (queryLower.startsWith('invoice') || queryLower.startsWith('inv')) {
      suggestions.push(
        { text: `${query} - pending`, category: 'completion' },
        { text: `${query} - paid`, category: 'completion' },
        { text: `${query} - this month`, category: 'completion' }
      );
    } else if (queryLower.startsWith('payment')) {
      suggestions.push(
        { text: `${query} - this month`, category: 'completion' },
        { text: `${query} - last week`, category: 'completion' },
        { text: `${query} - over $1000`, category: 'completion' }
      );
    }

    // Suggest based on recent searches
    if (recentSearches.length > 0) {
      const recent = recentSearches.slice(0, 3);
      recent.forEach(search => {
        if (
          search.toLowerCase().includes(queryLower) ||
          queryLower.includes(search.toLowerCase().split(' ')[0])
        ) {
          suggestions.push({ text: search, category: 'recent' });
        }
      });
    }

    // Context-aware suggestions based on user role
    if (userContext.vendorId) {
      if (queryLower.length < 3) {
        suggestions.push(
          { text: 'My open cases', category: 'context' },
          { text: 'Pending invoices', category: 'context' },
          { text: 'Recent payments', category: 'context' }
        );
      }
    }

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  } catch (error) {
    console.error('[AI Search] Error generating suggestions:', error);
    return [];
  }
}

/**
 * Enhance search results with context and AI insights
 * @param {Array} results - Raw search results
 * @param {Object} intent - Parsed search intent
 * @param {Object} userContext - User context
 * @returns {Promise<Array>} Enhanced search results
 */
export async function enhanceSearchResults(results, intent, userContext = {}) {
  try {
    // Score and sort results
    const scoredResults = results.map(item => ({
      ...item,
      relevanceScore: scoreSearchResult(item, intent),
    }));

    // Sort by relevance score
    scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Add AI insights to top results
    const enhancedResults = scoredResults.map((item, index) => {
      const enhanced = { ...item };

      // Add relevance indicator for top results
      if (index < 3 && item.relevanceScore > 0.7) {
        enhanced.insight = getRelevanceInsight(item, intent);
      }

      // Add quick actions based on result type
      enhanced.quickActions = getQuickActions(item);

      return enhanced;
    });

    return enhancedResults;
  } catch (error) {
    console.error('[AI Search] Error enhancing results:', error);
    return results;
  }
}

/**
 * Get relevance insight for a search result
 */
function getRelevanceInsight(item, intent) {
  if (item.relevanceScore > 0.9) {
    return 'Highly relevant match';
  } else if (item.relevanceScore > 0.7) {
    return 'Relevant match';
  }
  return null;
}

/**
 * Get quick actions for a search result
 */
function getQuickActions(item) {
  const actions = [];

  if (item.category === 'Cases') {
    actions.push({ label: 'View Case', url: item.url });
    actions.push({ label: 'Open Chat', url: `${item.url}#chat` });
  } else if (item.category === 'Invoices') {
    actions.push({ label: 'View Invoice', url: item.url });
    actions.push({ label: 'Check Matching', url: `${item.url}#matching` });
  } else if (item.category === 'Payments') {
    actions.push({ label: 'View Payment', url: item.url });
    actions.push({ label: 'Download Receipt', url: `${item.url}/receipt` });
  }

  return actions;
}

/**
 * Perform context-aware search across all entities
 * @param {string} query - Search query
 * @param {string} vendorId - Vendor ID
 * @param {Object} userContext - User context
 * @returns {Promise<Object>} Search results with AI enhancements
 */
export async function performAISearch(query, vendorId, userContext = {}) {
  try {
    // 1. Parse search intent
    const intent = await parseSearchIntent(query);

    // 2. Perform searches based on intent
    const searchPromises = [];

    // Always search all types, but prioritize based on intent
    if (intent.type === 'case' || intent.type === 'general') {
      searchPromises.push(
        searchCases(query, vendorId, intent).then(results => ({
          category: 'Cases',
          items: results,
          priority: intent.type === 'case' ? 1 : 2,
        }))
      );
    }

    if (intent.type === 'invoice' || intent.type === 'general') {
      searchPromises.push(
        searchInvoices(query, vendorId, intent).then(results => ({
          category: 'Invoices',
          items: results,
          priority: intent.type === 'invoice' ? 1 : 2,
        }))
      );
    }

    if (intent.type === 'payment' || intent.type === 'general') {
      searchPromises.push(
        searchPayments(query, vendorId, intent).then(results => ({
          category: 'Payments',
          items: results,
          priority: intent.type === 'payment' ? 1 : 2,
        }))
      );
    }

    // Wait for all searches
    const searchResults = await Promise.allSettled(searchPromises);

    // Combine results
    const allResults = [];
    searchResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        allResults.push(
          ...result.value.items.map(item => ({
            ...item,
            category: result.value.category,
            priority: result.value.priority,
          }))
        );
      }
    });

    // 3. Enhance results with AI
    const enhancedResults = await enhanceSearchResults(allResults, intent, userContext);

    // 4. Generate suggestions
    const suggestions = await generateSearchSuggestions(query, [], userContext);

    return {
      results: enhancedResults,
      intent,
      suggestions,
      totalResults: enhancedResults.length,
    };
  } catch (error) {
    console.error('[AI Search] Error performing AI search:', error);
    throw error;
  }
}

/**
 * Search cases with intent-based filtering
 */
async function searchCases(query, vendorId, intent) {
  // This will be called from the adapter
  // For now, return empty array - actual implementation in server.js
  return [];
}

/**
 * Search invoices with intent-based filtering
 */
async function searchInvoices(query, vendorId, intent) {
  // This will be called from the adapter
  // For now, return empty array - actual implementation in server.js
  return [];
}

/**
 * Search payments with intent-based filtering
 */
async function searchPayments(query, vendorId, intent) {
  // This will be called from the adapter
  // For now, return empty array - actual implementation in server.js
  return [];
}

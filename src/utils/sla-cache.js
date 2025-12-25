/**
 * SLA Metrics Cache
 * In-memory cache for SLA analytics to improve performance
 */

// Simple in-memory cache with TTL
const cache = new Map();

// Cache TTL: 5 minutes for real-time data, 1 hour for aggregated data
const CACHE_TTL = {
  REAL_TIME: 5 * 60 * 1000, // 5 minutes
  AGGREGATED: 60 * 60 * 1000, // 1 hour
};

/**
 * Generate cache key from parameters
 */
function getCacheKey(tenantId, userScope, dateRange, scopeType) {
  const scope = userScope || 'tenant';
  const start = dateRange?.startDate || 'default';
  const end = dateRange?.endDate || 'default';
  return `sla:${tenantId}:${scope}:${scopeType || 'tenant'}:${start}:${end}`;
}

/**
 * Get cached metrics
 */
export function getCachedMetrics(tenantId, userScope, dateRange, scopeType) {
  const key = getCacheKey(tenantId, userScope, dateRange, scopeType);
  const cached = cache.get(key);

  if (!cached) {
    return null;
  }

  // Check if cache is expired
  const now = Date.now();
  const isAggregated = dateRange?.startDate && dateRange?.endDate;
  const ttl = isAggregated ? CACHE_TTL.AGGREGATED : CACHE_TTL.REAL_TIME;

  if (now - cached.timestamp > ttl) {
    cache.delete(key);
    return null;
  }

  return cached.data;
}

/**
 * Set cached metrics
 */
export function setCachedMetrics(tenantId, userScope, dateRange, scopeType, data) {
  const key = getCacheKey(tenantId, userScope, dateRange, scopeType);
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Invalidate cache for a tenant
 */
export function invalidateCache(tenantId, caseId = null) {
  if (caseId) {
    // Invalidate specific case-related caches
    for (const [key] of cache.entries()) {
      if (key.includes(`sla:${tenantId}:`)) {
        cache.delete(key);
      }
    }
  } else {
    // Invalidate all caches for tenant
    for (const [key] of cache.entries()) {
      if (key.startsWith(`sla:${tenantId}:`)) {
        cache.delete(key);
      }
    }
  }
}

/**
 * Clear all cache
 */
export function clearCache() {
  cache.clear();
}

/**
 * Get cache stats (for monitoring)
 */
export function getCacheStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}

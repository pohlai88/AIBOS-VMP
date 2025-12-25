/**
 * Health Check Utilities
 *
 * Provides health endpoints for:
 * - Kubernetes liveness/readiness probes
 * - Load balancer health checks
 * - Monitoring systems
 * - Circuit breaker status dashboard
 *
 * Features:
 * - Customizable per-dependency timeouts
 * - Critical vs optional dependency severity
 * - Parallel health check execution
 * - Hostname/container ID for multi-node debugging
 */

import { hostname } from 'os';
import { getAllCircuitStatuses } from './nexus-circuit-breaker.js';
import logger, { ErrorCodes, ErrorCategories } from './nexus-logger.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const HOSTNAME = hostname();
const DEFAULT_TIMEOUT_MS = 5000;

// ============================================================================
// HEALTH STATUS
// ============================================================================

const HealthStatus = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy'
};

/**
 * Dependency severity levels
 * - CRITICAL: Service cannot function without this dependency
 * - OPTIONAL: Service can function in degraded mode without this
 */
const DependencySeverity = {
  CRITICAL: 'critical',
  OPTIONAL: 'optional'
};

// ============================================================================
// DEPENDENCY CHECKS
// ============================================================================

const dependencyChecks = new Map();

/**
 * Register a dependency health check
 * @param {string} name - Dependency name
 * @param {Function} checkFn - Async function returning { healthy: boolean, message?: string }
 * @param {Object} [options] - Configuration options
 * @param {number} [options.timeoutMs=5000] - Timeout for this check in milliseconds
 * @param {string} [options.severity='critical'] - 'critical' or 'optional'
 */
export function registerHealthCheck(name, checkFn, options = {}) {
  dependencyChecks.set(name, {
    checkFn,
    timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
    severity: options.severity || DependencySeverity.CRITICAL
  });
}

/**
 * Run all registered health checks in parallel
 */
async function runHealthChecks() {
  const checkEntries = Array.from(dependencyChecks.entries());

  // Run all checks in parallel for faster response
  const checkPromises = checkEntries.map(async ([name, config]) => {
    const { checkFn, timeoutMs, severity } = config;
    const startTime = Date.now();

    try {
      const result = await Promise.race([
        checkFn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Health check timeout (${timeoutMs}ms)`)), timeoutMs)
        )
      ]);

      return {
        name,
        result: {
          healthy: result.healthy,
          message: result.message,
          severity,
          latencyMs: Date.now() - startTime
        }
      };
    } catch (error) {
      return {
        name,
        result: {
          healthy: false,
          message: error.message,
          severity,
          latencyMs: Date.now() - startTime
        }
      };
    }
  });

  const results = await Promise.all(checkPromises);

  // Convert to object format
  const checksMap = {};
  for (const { name, result } of results) {
    checksMap[name] = result;
  }

  return checksMap;
}

// ============================================================================
// HEALTH RESPONSE BUILDER
// ============================================================================

/**
 * Build complete health response
 */
async function buildHealthResponse(includeDetails = false) {
  const startTime = Date.now();

  // Basic info
  const response = {
    status: HealthStatus.HEALTHY,
    timestamp: new Date().toISOString(),
    service: 'nexus-portal',
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.round(process.uptime())
  };

  // Add hostname for multi-node debugging
  if (includeDetails || process.env.NODE_ENV === 'production') {
    response.hostname = HOSTNAME;
  }

  // Run dependency checks if any registered
  if (dependencyChecks.size > 0) {
    const checks = await runHealthChecks();

    // Separate critical vs optional unhealthy checks
    const criticalUnhealthy = Object.values(checks).filter(
      c => !c.healthy && c.severity === DependencySeverity.CRITICAL
    );
    const optionalUnhealthy = Object.values(checks).filter(
      c => !c.healthy && c.severity === DependencySeverity.OPTIONAL
    );

    // Determine status based on severity
    if (criticalUnhealthy.length > 0) {
      // Any critical dependency down = UNHEALTHY
      response.status = HealthStatus.UNHEALTHY;
    } else if (optionalUnhealthy.length > 0) {
      // Only optional dependencies down = DEGRADED
      response.status = HealthStatus.DEGRADED;
    }

    if (includeDetails) {
      response.dependencies = checks;
    }
  }

  // Include circuit breaker status if requested
  if (includeDetails) {
    const circuits = getAllCircuitStatuses();
    if (Object.keys(circuits).length > 0) {
      response.circuits = circuits;

      // Degrade status if any circuit is open (unless already unhealthy)
      const openCircuits = Object.values(circuits).filter(c => c.state === 'OPEN');
      if (openCircuits.length > 0 && response.status === HealthStatus.HEALTHY) {
        response.status = HealthStatus.DEGRADED;
      }
    }
  }

  // Memory usage
  if (includeDetails) {
    const mem = process.memoryUsage();
    response.memory = {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024)
    };
  }

  response.responseTimeMs = Date.now() - startTime;

  return response;
}

// ============================================================================
// EXPRESS MIDDLEWARE
// ============================================================================

/**
 * Health check endpoint handler
 * GET /health - Basic health (for load balancers)
 * GET /health?details=true - Full health with dependency status
 */
export function healthEndpoint() {
  return async (req, res) => {
    try {
      const includeDetails = req.query.details === 'true';
      const health = await buildHealthResponse(includeDetails);

      const statusCode = health.status === HealthStatus.UNHEALTHY ? 503 : 200;

      res.status(statusCode).json(health);
    } catch (error) {
      logger.error('Health check failed', {
        error,
        code: ErrorCodes.INTERNAL_ERROR,
        category: ErrorCategories.SERVER
      });

      res.status(503).json({
        status: HealthStatus.UNHEALTHY,
        timestamp: new Date().toISOString(),
        service: 'nexus-portal',
        error: 'Health check failed'
      });
    }
  };
}

/**
 * Liveness probe endpoint (is the process running?)
 * GET /health/live
 */
export function livenessEndpoint() {
  return (req, res) => {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString()
    });
  };
}

/**
 * Readiness probe endpoint (can we accept traffic?)
 * GET /health/ready
 */
export function readinessEndpoint() {
  return async (req, res) => {
    try {
      const health = await buildHealthResponse(true);

      if (health.status === HealthStatus.UNHEALTHY) {
        res.status(503).json({
          ready: false,
          status: health.status,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(200).json({
          ready: true,
          status: health.status,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      res.status(503).json({
        ready: false,
        status: HealthStatus.UNHEALTHY,
        timestamp: new Date().toISOString()
      });
    }
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { HealthStatus, DependencySeverity };
export default {
  healthEndpoint,
  livenessEndpoint,
  readinessEndpoint,
  registerHealthCheck,
  HealthStatus,
  DependencySeverity
};

/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures when external dependencies fail.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                     CIRCUIT BREAKER STATE DIAGRAM                       │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │                                                                         │
 * │                         ┌──────────────┐                                │
 * │                         │              │                                │
 * │      ┌─────────────────▶│    CLOSED    │◀─────────────────┐             │
 * │      │                  │  (Normal)    │                  │             │
 * │      │                  └──────┬───────┘                  │             │
 * │      │                         │                          │             │
 * │      │            Failures >= failureThreshold            │             │
 * │      │                         │                          │             │
 * │      │                         ▼                          │             │
 * │      │                  ┌──────────────┐                  │             │
 * │      │                  │              │                  │             │
 * │      │                  │     OPEN     │                  │             │
 * │      │                  │  (Failing    │                  │             │
 * │      │                  │   Fast)      │                  │             │
 * │      │                  └──────┬───────┘                  │             │
 * │      │                         │                          │             │
 * │      │              Timeout expired                       │             │
 * │      │                         │                          │             │
 * │      │                         ▼                          │             │
 * │      │                  ┌──────────────┐                  │             │
 * │  Successes >=           │              │        Failure   │             │
 * │  successThreshold       │  HALF_OPEN   │──────────────────┘             │
 * │      │                  │  (Testing)   │     (Back to OPEN)             │
 * │      │                  └──────────────┘                                │
 * │      │                         │                                        │
 * │      └─────────────────────────┘                                        │
 * │                                                                         │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * States:
 * - CLOSED: Normal operation, requests pass through, failures counted
 * - OPEN: Failing fast, all requests rejected immediately
 * - HALF_OPEN: Testing recovery, limited requests allowed
 *
 * Usage:
 *   const breaker = getCircuit('supabase', { failureThreshold: 5 });
 *   try {
 *     const result = await breaker.execute(() => supabase.from('table').select());
 *   } catch (err) {
 *     if (err instanceof CircuitOpenError) {
 *       // Handle circuit open - retry later
 *     }
 *   }
 */

import logger, { ErrorCodes, ErrorCategories } from './nexus-logger.js';

// ============================================================================
// CIRCUIT STATES
// ============================================================================

export const CircuitState = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

// ============================================================================
// CIRCUIT BREAKER ERROR
// ============================================================================

export class CircuitOpenError extends Error {
  constructor(name, nextRetry) {
    super(`Circuit breaker '${name}' is OPEN. Retry after ${nextRetry}ms`);
    this.name = 'CircuitOpenError';
    this.circuitName = name;
    this.nextRetry = nextRetry;
    this.code = ErrorCodes.CIRCUIT_OPEN;
    this.category = ErrorCategories.DEPENDENCY;
  }
}

// ============================================================================
// CIRCUIT BREAKER CLASS
// ============================================================================

export class CircuitBreaker {
  /**
   * Create a new circuit breaker
   * @param {string} name - Name for logging/identification
   * @param {Object} options - Configuration options
   * @param {number} [options.failureThreshold=5] - Failures before opening
   * @param {number} [options.successThreshold=2] - Successes in half-open before closing
   * @param {number} [options.timeout=30000] - Time in ms before attempting half-open
   * @param {number} [options.requestTimeout=10000] - Timeout for individual requests
   */
  constructor(name, options = {}) {
    this.name = name;
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;

    // Configuration with defaults
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 30000; // 30 seconds
    this.requestTimeout = options.requestTimeout || 10000; // 10 seconds

    // Metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
      lastSuccess: null,
      lastFailure: null
    };

    // Logger with circuit context
    this.log = logger.child({ circuit: name });
  }

  /**
   * Execute a function through the circuit breaker
   * @param {Function} fn - Async function to execute
   * @returns {Promise<*>} Result of the function
   * @throws {CircuitOpenError} If circuit is open
   */
  async execute(fn) {
    this.metrics.totalRequests++;

    // Check if circuit should attempt to close
    if (this.state === CircuitState.OPEN) {
      if (Date.now() >= this.nextAttempt) {
        this.toHalfOpen();
      } else {
        this.metrics.rejectedRequests++;
        const waitTime = this.nextAttempt - Date.now();
        this.log.warn('Circuit open, rejecting request', {
          state: this.state,
          nextAttempt: new Date(this.nextAttempt).toISOString(),
          waitTimeMs: waitTime
        });
        throw new CircuitOpenError(this.name, waitTime);
      }
    }

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn, this.requestTimeout);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  async executeWithTimeout(fn, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      Promise.resolve(fn())
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(err => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * Handle successful execution
   */
  onSuccess() {
    this.metrics.successfulRequests++;
    this.metrics.lastSuccess = new Date().toISOString();

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      this.log.debug('Half-open success', {
        successCount: this.successCount,
        threshold: this.successThreshold
      });

      if (this.successCount >= this.successThreshold) {
        this.toClosed();
      }
    } else {
      // Reset failure count on success in closed state
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed execution
   */
  onFailure(error) {
    this.metrics.failedRequests++;
    this.metrics.lastFailure = new Date().toISOString();
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during recovery attempt, go back to open
      this.log.warn('Half-open failure, reopening circuit', {
        error: error.message
      });
      this.toOpen();
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount++;
      this.log.warn('Circuit failure recorded', {
        failureCount: this.failureCount,
        threshold: this.failureThreshold,
        error: error.message
      });

      if (this.failureCount >= this.failureThreshold) {
        this.toOpen();
      }
    }
  }

  /**
   * Transition to CLOSED state
   */
  toClosed() {
    const previousState = this.state;
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;

    this.log.info('Circuit closed', {
      previousState,
      state: this.state
    });
  }

  /**
   * Transition to OPEN state
   */
  toOpen() {
    const previousState = this.state;
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.timeout;

    this.log.error('Circuit opened', {
      previousState,
      state: this.state,
      nextAttempt: new Date(this.nextAttempt).toISOString(),
      failureCount: this.failureCount,
      code: ErrorCodes.CIRCUIT_OPEN,
      category: ErrorCategories.DEPENDENCY
    });
  }

  /**
   * Transition to HALF_OPEN state
   */
  toHalfOpen() {
    const previousState = this.state;
    this.state = CircuitState.HALF_OPEN;
    this.successCount = 0;

    this.log.info('Circuit half-open, testing recovery', {
      previousState,
      state: this.state
    });
  }

  /**
   * Get current circuit status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt ? new Date(this.nextAttempt).toISOString() : null,
      metrics: this.metrics,
      config: {
        failureThreshold: this.failureThreshold,
        successThreshold: this.successThreshold,
        timeout: this.timeout,
        requestTimeout: this.requestTimeout
      }
    };
  }

  /**
   * Manually reset the circuit to closed
   */
  reset() {
    this.log.info('Circuit manually reset');
    this.toClosed();
  }
}

// ============================================================================
// CIRCUIT REGISTRY
// ============================================================================

const circuits = new Map();

/**
 * Get or create a circuit breaker by name
 * @param {string} name - Circuit name
 * @param {Object} options - Options for new circuit
 * @returns {CircuitBreaker}
 */
export function getCircuit(name, options = {}) {
  if (!circuits.has(name)) {
    circuits.set(name, new CircuitBreaker(name, options));
  }
  return circuits.get(name);
}

/**
 * Get all circuit statuses
 * @returns {Object} Map of circuit name to status
 */
export function getAllCircuitStatuses() {
  const statuses = {};
  for (const [name, circuit] of circuits) {
    statuses[name] = circuit.getStatus();
  }
  return statuses;
}

/**
 * Reset all circuits
 */
export function resetAllCircuits() {
  for (const circuit of circuits.values()) {
    circuit.reset();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default CircuitBreaker;

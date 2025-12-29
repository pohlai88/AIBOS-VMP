/**
 * ============================================================================
 * TEMPLATE CONTRACT
 * ============================================================================
 * Type: Application
 * Category: Utility Service (Not CRUD)
 * Domain: finance
 * Enforces: State Transitions, Approval Rules, Dual Control
 * 
 * NOTE: This is a utility service, not a CRUD service. It does not extend
 * BaseRepository because it operates on existing payment entities via the
 * adapter layer, not directly on a database table.
 * 
 * DO NOT MODIFY WITHOUT UPDATING:
 * - docs/architecture/APPLICATION_TEMPLATE_SYSTEM.md
 * - docs/architecture/TEMPLATE_CONSTITUTION.md
 * - Version below
 * 
 * Version: 1.0.0
 * Last Updated: 2025-01-22
 * ============================================================================
 * 
 * Payment Workflow Service
 * 
 * Handles payment approval workflow state machine, approval thresholds, and dual control enforcement.
 * Uses JSONB metadata in nexus_payments table for workflow state.
 * 
 * State Machine:
 *   draft → pending_approval → approved → scheduled → released → completed
 *                              ↘ rejected
 * 
 * This is a utility service that provides workflow logic functions. It does not
 * extend BaseRepository because it doesn't perform CRUD operations directly.
 * Instead, it validates state transitions and manages workflow metadata that is
 * stored in the payment's JSONB metadata column.
 */

/**
 * Valid payment states
 */
const VALID_STATES = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SCHEDULED: 'scheduled',
  RELEASED: 'released',
  COMPLETED: 'completed',
};

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS = {
  [VALID_STATES.DRAFT]: [VALID_STATES.PENDING_APPROVAL],
  [VALID_STATES.PENDING_APPROVAL]: [VALID_STATES.APPROVED, VALID_STATES.REJECTED],
  [VALID_STATES.APPROVED]: [VALID_STATES.SCHEDULED],
  [VALID_STATES.REJECTED]: [VALID_STATES.DRAFT], // Can resubmit
  [VALID_STATES.SCHEDULED]: [VALID_STATES.RELEASED],
  [VALID_STATES.RELEASED]: [VALID_STATES.COMPLETED],
  [VALID_STATES.COMPLETED]: [], // Terminal state
};

/**
 * Validate state transition
 * @param {string} currentState - Current payment state
 * @param {string} newState - Desired new state
 * @returns {boolean} True if transition is valid
 */
export function validateStateTransition(currentState, newState) {
  if (!currentState || !newState) {
    return false;
  }

  const allowedStates = VALID_TRANSITIONS[currentState] || [];
  return allowedStates.includes(newState);
}

/**
 * Get approval workflow metadata from payment
 * @param {object} payment - Payment object
 * @returns {object} Workflow metadata
 */
export function getWorkflowMetadata(payment) {
  const metadata = payment.metadata || {};
  return metadata.approval_workflow || {
    current_state: payment.status || VALID_STATES.DRAFT,
    state_history: [],
    approval_rules: {
      threshold_amount: 10000, // Default threshold
      requires_dual_control: false,
      approvers: [],
    },
    approvals: [],
  };
}

/**
 * Check if payment requires approval based on threshold
 * @param {object} payment - Payment object
 * @param {object} workflowMetadata - Workflow metadata
 * @returns {boolean} True if approval required
 */
export function requiresApproval(payment, workflowMetadata) {
  const amount = parseFloat(payment.amount || 0);
  const threshold = workflowMetadata.approval_rules?.threshold_amount || 0;
  return amount >= threshold;
}

/**
 * Check if dual control is required and enforced
 * @param {object} workflowMetadata - Workflow metadata
 * @param {string} actorUserId - User attempting approval
 * @returns {object} { requires: boolean, satisfied: boolean, message: string }
 */
export function checkDualControl(workflowMetadata, actorUserId) {
  const rules = workflowMetadata.approval_rules || {};
  const requiresDualControl = rules.requires_dual_control || false;

  if (!requiresDualControl) {
    return { requires: false, satisfied: true, message: 'Dual control not required' };
  }

  const approvals = workflowMetadata.approvals || [];
  const uniqueApprovers = new Set(approvals.map(a => a.approver_id).filter(Boolean));

  // Need at least 2 different approvers
  if (uniqueApprovers.size >= 2) {
    return { requires: true, satisfied: true, message: 'Dual control satisfied' };
  }

  // Check if current user already approved
  const userAlreadyApproved = approvals.some(a => a.approver_id === actorUserId && a.status === 'approved');

  if (userAlreadyApproved) {
    return {
      requires: true,
      satisfied: false,
      message: 'Dual control required: You have already approved. Another user must approve.',
    };
  }

  return {
    requires: true,
    satisfied: uniqueApprovers.size >= 1, // One approval done, need one more
    message: uniqueApprovers.size === 0
      ? 'Dual control required: First approval needed'
      : 'Dual control required: Second approval needed',
  };
}

/**
 * Add approval to workflow history
 * @param {object} workflowMetadata - Current workflow metadata
 * @param {string} action - Action taken ('approved', 'rejected', 'released')
 * @param {string} actorUserId - User who performed action
 * @param {string} newState - New state after action
 * @returns {object} Updated workflow metadata
 */
export function addApprovalHistory(workflowMetadata, action, actorUserId, newState) {
  const history = workflowMetadata.state_history || [];
  const approvals = workflowMetadata.approvals || [];

  // Add to state history
  history.push({
    state: newState,
    timestamp: new Date().toISOString(),
    user_id: actorUserId,
    action,
  });

  // Add to approvals if it's an approval action
  if (action === 'approved') {
    approvals.push({
      approver_id: actorUserId,
      timestamp: new Date().toISOString(),
      status: 'approved',
    });
  }

  return {
    ...workflowMetadata,
    current_state: newState,
    state_history: history,
    approvals,
  };
}

/**
 * Create initial workflow metadata for new payment
 * @param {object} payment - Payment object
 * @param {object} rules - Approval rules (optional)
 * @returns {object} Initial workflow metadata
 */
export function createInitialWorkflowMetadata(payment, rules = {}) {
  const amount = parseFloat(payment.amount || 0);
  const threshold = rules.threshold_amount || 10000;
  const requiresApproval = amount >= threshold;

  return {
    current_state: requiresApproval ? VALID_STATES.PENDING_APPROVAL : VALID_STATES.DRAFT,
    state_history: [
      {
        state: requiresApproval ? VALID_STATES.PENDING_APPROVAL : VALID_STATES.DRAFT,
        timestamp: new Date().toISOString(),
        user_id: payment.created_by || null,
        action: 'created',
      },
    ],
    approval_rules: {
      threshold_amount: threshold,
      requires_dual_control: rules.requires_dual_control || false,
      approvers: rules.approvers || [],
    },
    approvals: [],
  };
}

/**
 * Check if payment can be approved
 * @param {object} payment - Payment object
 * @param {string} actorUserId - User attempting approval
 * @returns {object} { canApprove: boolean, reason: string }
 */
export function canApprovePayment(payment, actorUserId) {
  const workflowMetadata = getWorkflowMetadata(payment);
  const currentState = workflowMetadata.current_state || payment.status;

  // Check state transition
  if (!validateStateTransition(currentState, VALID_STATES.APPROVED)) {
    return {
      canApprove: false,
      reason: `Cannot approve payment in '${currentState}' state. Only '${VALID_STATES.PENDING_APPROVAL}' payments can be approved.`,
    };
  }

  // Check dual control
  const dualControl = checkDualControl(workflowMetadata, actorUserId);
  if (dualControl.requires && !dualControl.satisfied) {
    return {
      canApprove: false,
      reason: dualControl.message,
    };
  }

  return {
    canApprove: true,
    reason: 'Payment can be approved',
  };
}

/**
 * Check if payment can be released
 * @param {object} payment - Payment object
 * @returns {object} { canRelease: boolean, reason: string }
 */
export function canReleasePayment(payment) {
  const workflowMetadata = getWorkflowMetadata(payment);
  const currentState = workflowMetadata.current_state || payment.status;

  // Must be in approved or scheduled state
  if (currentState !== VALID_STATES.APPROVED && currentState !== VALID_STATES.SCHEDULED) {
    return {
      canRelease: false,
      reason: `Cannot release payment in '${currentState}' state. Payment must be '${VALID_STATES.APPROVED}' or '${VALID_STATES.SCHEDULED}'.`,
    };
  }

  return {
    canRelease: true,
    reason: 'Payment can be released',
  };
}

export {
  VALID_STATES,
  VALID_TRANSITIONS,
};


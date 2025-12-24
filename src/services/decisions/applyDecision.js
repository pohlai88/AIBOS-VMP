import { DatabaseError, ValidationError } from '../../utils/errors.js';
import { vmpAdapter } from '../../adapters/supabase.js';

// Central decision handler scaffold. Currently routes case updates through existing adapter
// while preserving event-first expansion capability. Controlled by caller.
export async function applyDecision({
  entity,
  id,
  action,
  channel = 'resolution',
  actorId,
  tenantId,
  vendorId,
  note = null,
  reason = null
}) {
  if (!entity || !id || !action) {
    throw new ValidationError('entity, id, and action are required for applyDecision');
  }

  // Temporary: only supports case resolution actions; extend with enums + event writes later.
  if (entity !== 'case') {
    throw new ValidationError(`applyDecision currently supports entity=case only (got ${entity})`);
  }

  // Map resolution actions to legacy statuses (to be replaced with proper state machine/enum)
  const actionToStatus = {
    APPROVE: 'resolved',
    REJECT: 'blocked',
    WITHDRAW: 'waiting_supplier',
    CANCEL: 'blocked'
  };

  const nextStatus = actionToStatus[action];
  if (!nextStatus) {
    throw new ValidationError(`Unsupported action ${action} for case resolution`);
  }

  try {
    await vmpAdapter.updateCaseStatus(id, nextStatus, actorId, { note, reason, channel });
    return { status: nextStatus };
  } catch (err) {
    throw new DatabaseError('Failed to apply decision', err, { entity, id, action, channel });
  }
}

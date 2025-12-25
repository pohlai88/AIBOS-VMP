/**
 * SLA Reminders System
 *
 * Monitors cases approaching or past SLA deadlines and sends reminders.
 * Can be run as a scheduled job (cron) or manually triggered.
 */

import { vmpAdapter } from '../adapters/supabase.js';
import { logError } from './errors.js';

/**
 * Check for cases with approaching or overdue SLAs and send reminders
 * @param {Object} options - Configuration options
 * @param {number} options.warningThresholdHours - Hours before SLA to send warning (default: 24)
 * @param {number} options.overdueCheckHours - Check cases overdue by this many hours (default: 0)
 * @param {boolean} options.sendToVendors - Send reminders to vendors (default: true)
 * @param {boolean} options.sendToInternal - Send reminders to internal users (default: true)
 * @returns {Promise<Object>} Summary of reminders sent
 */
export async function checkAndSendSLAReminders(options = {}) {
  const {
    warningThresholdHours = 24,
    overdueCheckHours = 0,
    sendToVendors = true,
    sendToInternal = true,
  } = options;

  const summary = {
    checked: 0,
    warningsSent: 0,
    overdueSent: 0,
    errors: [],
    timestamp: new Date().toISOString(),
  };

  try {
    // 1. Get cases with approaching SLA (within warning threshold)
    const thresholdHours = warningThresholdHours;
    const approachingCases = await vmpAdapter.getCasesWithSLAApproaching(thresholdHours);

    summary.checked = approachingCases.length;

    // 2. Process each case
    for (const caseItem of approachingCases) {
      try {
        const isOverdue = caseItem.is_overdue || caseItem.hours_remaining < 0;
        const hoursRemaining = caseItem.hours_remaining;

        // Determine reminder type
        let reminderType = 'warning';
        let reminderMessage = '';
        let priority = 'medium';

        if (isOverdue) {
          reminderType = 'overdue';
          reminderMessage = `Case "${caseItem.subject}" is overdue. SLA deadline was ${formatDate(caseItem.sla_due_at)}.`;
          priority = 'high';
        } else if (hoursRemaining <= 24) {
          reminderMessage = `Case "${caseItem.subject}" SLA deadline is approaching. Due in ${formatHours(hoursRemaining)}.`;
          priority = 'high';
        } else if (hoursRemaining <= 48) {
          reminderMessage = `Case "${caseItem.subject}" SLA deadline is in ${formatHours(hoursRemaining)}.`;
          priority = 'medium';
        } else {
          // Skip if too far away
          continue;
        }

        // 3. Send reminders to vendors
        if (sendToVendors) {
          await sendVendorSLAReminder(caseItem, reminderType, reminderMessage);
        }

        // 4. Send reminders to internal users
        if (sendToInternal) {
          await sendInternalSLAReminder(caseItem, reminderType, reminderMessage);
        }

        // 5. Update summary
        if (isOverdue) {
          summary.overdueSent++;
        } else {
          summary.warningsSent++;
        }
      } catch (caseError) {
        logError(caseError, {
          operation: 'checkAndSendSLAReminders',
          caseId: caseItem.id,
        });
        summary.errors.push({
          caseId: caseItem.id,
          error: caseError.message,
        });
      }
    }

    return summary;
  } catch (error) {
    logError(error, { operation: 'checkAndSendSLAReminders' });
    throw error;
  }
}

/**
 * Send SLA reminder to vendor users
 * Enhanced with better error handling and future email notification support
 */
async function sendVendorSLAReminder(caseItem, reminderType, message) {
  try {
    // Get vendor users for this case
    const vendorData = await vmpAdapter.getVendorUsers(caseItem.vendor_id);

    if (!vendorData || !vendorData.users || vendorData.users.length === 0) {
      // No users to notify - this is not an error, just log for debugging
      console.log(`[SLA Reminders] No active vendor users found for case ${caseItem.id}`);
      return;
    }

    const notificationTitle =
      reminderType === 'overdue' ? '⚠️ Case SLA Overdue' : '⏰ Case SLA Approaching';

    const notificationType = reminderType === 'overdue' ? 'sla_breach' : 'sla_warning';

    // Create notification for each vendor user
    let notificationsSent = 0;
    let notificationsFailed = 0;

    for (const user of vendorData.users) {
      if (!user.is_active) {
        console.log(`[SLA Reminders] Skipping inactive user ${user.id} for case ${caseItem.id}`);
        continue;
      }

      try {
        // In-app notification (always sent)
        await vmpAdapter.createNotification(
          caseItem.id,
          user.id,
          notificationType,
          notificationTitle,
          message
        );
        notificationsSent++;

        // TODO: Future enhancement - Send email notification if user preferences allow
        // This would require extending the notification utility to support SLA reminders
        // Example:
        // if (user.notification_preferences?.email !== false) {
        //   await sendSLAEmailNotification(user.email, user.display_name, {
        //     caseId: caseItem.id,
        //     caseSubject: caseItem.subject,
        //     reminderType,
        //     message
        //   });
        // }
      } catch (userError) {
        notificationsFailed++;
        logError(userError, {
          operation: 'sendVendorSLAReminder',
          caseId: caseItem.id,
          userId: user.id,
          step: 'createNotification',
        });
        // Continue with other users even if one fails
      }
    }

    if (notificationsSent > 0) {
      console.log(
        `[SLA Reminders] Sent ${notificationsSent} in-app notifications for case ${caseItem.id}`
      );
    }
    if (notificationsFailed > 0) {
      console.warn(
        `[SLA Reminders] Failed to send ${notificationsFailed} notifications for case ${caseItem.id}`
      );
    }
  } catch (error) {
    logError(error, {
      operation: 'sendVendorSLAReminder',
      caseId: caseItem.id,
      vendorId: caseItem.vendor_id,
    });
    // Don't throw - allow other cases to be processed
    throw error;
  }
}

/**
 * Send SLA reminder to internal users (assigned user or team)
 * Enhanced with better error handling and future email notification support
 */
async function sendInternalSLAReminder(caseItem, reminderType, message) {
  try {
    // Query case directly to get assigned_to_user_id
    // Import supabase client from adapter module
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('[SLA Reminders] Supabase config missing, skipping internal reminder');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: caseData, error: caseError } = await supabase
      .from('vmp_cases')
      .select('assigned_to_user_id')
      .eq('id', caseItem.id)
      .single();

    if (caseError) {
      logError(caseError, {
        operation: 'sendInternalSLAReminder',
        caseId: caseItem.id,
        step: 'queryCase',
      });
      return;
    }

    if (!caseData || !caseData.assigned_to_user_id) {
      // If not assigned, skip internal reminder (this is expected for unassigned cases)
      console.log(
        `[SLA Reminders] Case ${caseItem.id} has no assigned user, skipping internal reminder`
      );
      return;
    }

    const assignedUserId = caseData.assigned_to_user_id;

    // If case is assigned, send to assigned user
    if (assignedUserId) {
      const notificationTitle =
        reminderType === 'overdue'
          ? '🚨 Case SLA Overdue - Action Required'
          : '⏰ Case SLA Approaching';

      const notificationType = reminderType === 'overdue' ? 'sla_breach' : 'sla_warning';

      try {
        await vmpAdapter.createNotification(
          caseItem.id,
          assignedUserId,
          notificationType,
          notificationTitle,
          message
        );
        console.log(
          `[SLA Reminders] Sent internal reminder to user ${assignedUserId} for case ${caseItem.id}`
        );

        // TODO: Future enhancement - Send email notification if user preferences allow
        // This would require extending the notification utility to support SLA reminders
        // Example:
        // const user = await vmpAdapter.getUserById(assignedUserId);
        // if (user?.notification_preferences?.email !== false) {
        //   await sendSLAEmailNotification(user.email, user.display_name, {
        //     caseId: caseItem.id,
        //     caseSubject: caseItem.subject,
        //     reminderType,
        //     message
        //   });
        // }
      } catch (notificationError) {
        logError(notificationError, {
          operation: 'sendInternalSLAReminder',
          caseId: caseItem.id,
          userId: assignedUserId,
          step: 'createNotification',
        });
        // Don't throw - allow other cases to be processed
      }
    }
  } catch (error) {
    logError(error, {
      operation: 'sendInternalSLAReminder',
      caseId: caseItem.id,
    });
    // Don't throw - allow other cases to be processed
    throw error;
  }
}

/**
 * Format hours remaining in human-readable format
 */
function formatHours(hours) {
  if (hours < 0) {
    return `${Math.abs(hours)} hours ago`;
  }
  if (hours < 24) {
    return `${Math.round(hours)} hours`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  if (remainingHours === 0) {
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
  return `${days} day${days !== 1 ? 's' : ''} ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
}

/**
 * Format date in readable format
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get SLA reminder statistics
 * @param {string} vendorId - Optional vendor ID to filter
 * @returns {Promise<Object>} Statistics about SLA cases
 */
export async function getSLAReminderStats(vendorId = null) {
  try {
    const now = new Date();
    const thresholdTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    // Get approaching cases
    const approachingCases = await vmpAdapter.getCasesWithSLAApproaching(24);

    // Filter by vendor if provided
    const filteredCases = vendorId
      ? approachingCases.filter(c => c.vendor_id === vendorId)
      : approachingCases;

    // Categorize cases
    const overdue = filteredCases.filter(c => c.is_overdue);
    const dueToday = filteredCases.filter(c => !c.is_overdue && c.hours_remaining < 24);
    const dueTomorrow = filteredCases.filter(
      c => !c.is_overdue && c.hours_remaining >= 24 && c.hours_remaining < 48
    );

    return {
      total: filteredCases.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      dueTomorrow: dueTomorrow.length,
      cases: {
        overdue,
        dueToday,
        dueTomorrow,
      },
    };
  } catch (error) {
    logError(error, { operation: 'getSLAReminderStats', vendorId });
    throw error;
  }
}

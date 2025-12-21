import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

// Validate required environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error(
        'Missing required Supabase configuration. ' +
        'Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.'
    );
}

// Create Supabase client with timeout configuration
const supabase = createClient(supabaseUrl, supabaseKey, {
    db: {
        schema: 'public',
    },
    global: {
        headers: {
            'x-client-info': 'vmp-adapter',
        },
    },
    // Note: Supabase JS client doesn't directly support timeout,
    // so we'll wrap queries with Promise.race for timeout handling
});

// Timeout wrapper for async operations
const withTimeout = async (promise, timeoutMs = 10000, operationName = 'operation') => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });

    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutId); // Clear timeout if promise resolves first
        return result;
    } catch (error) {
        clearTimeout(timeoutId); // Clear timeout on error
        console.error(`Timeout error in ${operationName}:`, error);
        throw error;
    }
};

export const vmpAdapter = {
    // Auth: Get user by email
    async getUserByEmail(email) {
        const queryPromise = supabase
            .from('vmp_vendor_users')
            .select('id, email, password_hash, vendor_id, display_name, is_active')
            .eq('email', email.toLowerCase().trim())
            .single();

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `getUserByEmail(${email})`
        );

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows returned
                return null;
            }
            throw error;
        }
        return data;
    },

    // Auth: Verify password
    async verifyPassword(userId, password) {
        const queryPromise = supabase
            .from('vmp_vendor_users')
            .select('password_hash')
            .eq('id', userId)
            .single();

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `verifyPassword(${userId})`
        );

        if (error || !data) {
            return false;
        }

        if (!data.password_hash) {
            // User has no password set (should set one via invite flow)
            return false;
        }

        return await bcrypt.compare(password, data.password_hash);
    },

    // Auth: Create session
    async createSession(userId, sessionData = {}) {
        const sessionId = randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

        const queryPromise = supabase
            .from('vmp_sessions')
            .insert({
                id: sessionId,
                user_id: userId,
                expires_at: expiresAt.toISOString(),
                data: sessionData
            })
            .select()
            .single();

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `createSession(${userId})`
        );

        if (error) throw error;
        return { sessionId, expiresAt, data };
    },

    // Auth: Get session
    async getSession(sessionId) {
        if (!sessionId) return null;

        const queryPromise = supabase
            .from('vmp_sessions')
            .select('id, user_id, expires_at, data')
            .eq('id', sessionId)
            .single();

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `getSession(${sessionId})`
        );

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Session not found
            }
            throw error;
        }

        // Check if session is expired
        if (new Date(data.expires_at) < new Date()) {
            // Auto-delete expired session
            await this.deleteSession(sessionId);
            return null;
        }

        return data;
    },

    // Auth: Delete session
    async deleteSession(sessionId) {
        if (!sessionId) return;

        const queryPromise = supabase
            .from('vmp_sessions')
            .delete()
            .eq('id', sessionId);

        const { error } = await withTimeout(
            queryPromise,
            10000,
            `deleteSession(${sessionId})`
        );

        if (error) {
            console.error('Error deleting session:', error);
            // Don't throw - session might already be deleted
        }
    },

    // Auth: Clean expired sessions
    async cleanExpiredSessions() {
        const queryPromise = supabase
            .from('vmp_sessions')
            .delete()
            .lt('expires_at', new Date().toISOString());

        const { error } = await withTimeout(
            queryPromise,
            10000,
            'cleanExpiredSessions()'
        );

        if (error) {
            console.error('Error cleaning expired sessions:', error);
        }
    },

    // Phase 1: Context Loading
    async getVendorContext(userId) {
        const queryPromise = supabase
            .from('vmp_vendor_users')
            .select(`
                id, display_name, vendor_id, email, is_active, is_internal,
                vmp_vendors ( id, name, tenant_id )
            `)
            .eq('id', userId)
            .single();

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `getVendorContext(${userId})`
        );

        if (error) throw error;
        return data;
    },

    // Phase 2: Inbox Cell Data
    async getInbox(vendorId) {
        if (!vendorId) {
            throw new Error('getInbox requires a vendorId parameter');
        }

        const queryPromise = supabase
            .from('vmp_cases')
            .select(`
                id, subject, status, sla_due_at, updated_at, case_type,
                vmp_companies ( name )
            `)
            .eq('vendor_id', vendorId)
            .order('updated_at', { ascending: false }); // WhatsApp sorting

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `getInbox(${vendorId})`
        );

        if (error) {
            console.error('Inbox Error:', error);
            throw new Error(`Failed to fetch inbox: ${error.message}`);
        }
        return data || [];
    },

    // Phase 2: Case Detail Cell Data
    async getCaseDetail(caseId, vendorId) {
        if (!caseId || !vendorId) {
            throw new Error('getCaseDetail requires both caseId and vendorId parameters');
        }

        // Security check: ensure case belongs to vendor
        const queryPromise = supabase
            .from('vmp_cases')
            .select('*')
            .eq('id', caseId)
            .eq('vendor_id', vendorId)
            .single();

        const { data: caseData, error } = await withTimeout(
            queryPromise,
            10000,
            `getCaseDetail(${caseId}, ${vendorId})`
        );

        if (error) {
            console.error('Case Detail Error:', error);
            throw new Error(`Failed to fetch case detail: ${error.message}`);
        }

        if (!caseData) {
            return null;
        }

        return caseData;
    },

    // Phase 3: Thread Cell - Get Messages
    async getMessages(caseId) {
        if (!caseId) {
            throw new Error('getMessages requires a caseId parameter');
        }

        const queryPromise = supabase
            .from('vmp_messages')
            .select(`
                id,
                case_id,
                channel_source,
                sender_type,
                sender_user_id,
                body,
                is_internal_note,
                created_at,
                vmp_vendor_users ( display_name, email )
            `)
            .eq('case_id', caseId)
            .order('created_at', { ascending: true }); // Chronological order

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `getMessages(${caseId})`
        );

        if (error) {
            console.error('Messages Error:', error);
            throw new Error(`Failed to fetch messages: ${error.message}`);
        }

        // Transform data to match template expectations
        // Template expects: sender_party, channel_source, body, created_at
        return (data || []).map(msg => ({
            id: msg.id,
            case_id: msg.case_id,
            sender_party: msg.sender_type === 'vendor'
                ? (msg.vmp_vendor_users?.display_name || msg.vmp_vendor_users?.email || 'Vendor')
                : msg.sender_type === 'internal'
                    ? 'Internal'
                    : 'AI Assistant',
            channel_source: msg.channel_source,
            body: msg.body,
            created_at: msg.created_at,
            is_internal_note: msg.is_internal_note
        }));
    },

    // Phase 3: Thread Cell - Create Message
    async createMessage(caseId, body, senderType = 'vendor', channelSource = 'portal', senderUserId = null, isInternalNote = false) {
        if (!caseId || !body) {
            throw new Error('createMessage requires caseId and body parameters');
        }

        // Validate sender_type
        const validSenderTypes = ['vendor', 'internal', 'ai'];
        if (!validSenderTypes.includes(senderType)) {
            throw new Error(`Invalid sender_type. Must be one of: ${validSenderTypes.join(', ')}`);
        }

        // Validate channel_source
        const validChannels = ['portal', 'whatsapp', 'email', 'slack'];
        if (!validChannels.includes(channelSource)) {
            throw new Error(`Invalid channel_source. Must be one of: ${validChannels.join(', ')}`);
        }

        const queryPromise = supabase
            .from('vmp_messages')
            .insert({
                case_id: caseId,
                channel_source: channelSource,
                sender_type: senderType,
                sender_user_id: senderUserId,
                body: body.trim(),
                is_internal_note: isInternalNote
            })
            .select()
            .single();

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `createMessage(${caseId})`
        );

        if (error) {
            console.error('Create Message Error:', error);
            throw new Error(`Failed to create message: ${error.message}`);
        }

        return data;
    },

    // Phase 4: Checklist Cell - Get Checklist Steps
    async getChecklistSteps(caseId) {
        if (!caseId) {
            throw new Error('getChecklistSteps requires a caseId parameter');
        }

        const queryPromise = supabase
            .from('vmp_checklist_steps')
            .select('*')
            .eq('case_id', caseId)
            .order('created_at', { ascending: true });

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `getChecklistSteps(${caseId})`
        );

        if (error) {
            console.error('Checklist Steps Error:', error);
            throw new Error(`Failed to fetch checklist steps: ${error.message}`);
        }

        return data || [];
    },

    // Phase 4: Checklist Cell - Create Checklist Step
    async createChecklistStep(caseId, label, requiredEvidenceType = null) {
        if (!caseId || !label) {
            throw new Error('createChecklistStep requires caseId and label parameters');
        }

        const queryPromise = supabase
            .from('vmp_checklist_steps')
            .insert({
                case_id: caseId,
                label: label.trim(),
                required_evidence_type: requiredEvidenceType,
                status: 'pending'
            })
            .select()
            .single();

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `createChecklistStep(${caseId})`
        );

        if (error) {
            console.error('Create Checklist Step Error:', error);
            throw new Error(`Failed to create checklist step: ${error.message}`);
        }

        return data;
    },

    // Phase 4: Checklist Cell - Ensure Checklist Steps Exist
    async ensureChecklistSteps(caseId, caseType) {
        if (!caseId || !caseType) {
            throw new Error('ensureChecklistSteps requires caseId and caseType parameters');
        }

        // Import rules engine dynamically to avoid circular dependencies
        const { getChecklistStepsForCaseType } = await import('../utils/checklist-rules.js');
        const requiredSteps = getChecklistStepsForCaseType(caseType);

        // Get existing steps
        const existingSteps = await this.getChecklistSteps(caseId);

        // Create missing steps
        const stepsToCreate = requiredSteps.filter(required => {
            return !existingSteps.some(existing =>
                existing.label === required.label ||
                existing.required_evidence_type === required.required_evidence_type
            );
        });

        const createdSteps = [];
        for (const step of stepsToCreate) {
            try {
                const created = await this.createChecklistStep(
                    caseId,
                    step.label,
                    step.required_evidence_type
                );
                createdSteps.push(created);
            } catch (error) {
                console.error(`Error creating checklist step "${step.label}":`, error);
                // Continue with other steps
            }
        }

        // Return all steps (existing + newly created)
        return await this.getChecklistSteps(caseId);
    },

    // Phase 5: Evidence Cell - Get Evidence
    async getEvidence(caseId) {
        if (!caseId) {
            throw new Error('getEvidence requires a caseId parameter');
        }

        const queryPromise = supabase
            .from('vmp_evidence')
            .select('*')
            .eq('case_id', caseId)
            .order('created_at', { ascending: false }); // Newest first

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `getEvidence(${caseId})`
        );

        if (error) {
            console.error('Evidence Error:', error);
            throw new Error(`Failed to fetch evidence: ${error.message}`);
        }

        return data || [];
    },

    // Phase 5: Evidence Cell - Compute SHA-256 Checksum
    async computeChecksum(fileBuffer) {
        const crypto = await import('crypto');
        return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    },

    // Phase 5: Evidence Cell - Get Next Version for Evidence Type
    async getNextEvidenceVersion(caseId, evidenceType) {
        if (!caseId || !evidenceType) {
            throw new Error('getNextEvidenceVersion requires caseId and evidenceType parameters');
        }

        const queryPromise = supabase
            .from('vmp_evidence')
            .select('version')
            .eq('case_id', caseId)
            .eq('evidence_type', evidenceType)
            .order('version', { ascending: false })
            .limit(1);

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `getNextEvidenceVersion(${caseId}, ${evidenceType})`
        );

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
            console.error('Get Next Version Error:', error);
            throw new Error(`Failed to get next version: ${error.message}`);
        }

        // If no existing evidence, start at version 1
        if (!data || data.length === 0) {
            return 1;
        }

        // Return next version (current max + 1)
        return (data[0].version || 0) + 1;
    },

    // Phase 5: Evidence Cell - Generate Storage Path
    generateEvidenceStoragePath(caseId, evidenceType, version, filename) {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        return `${caseId}/${evidenceType}/${today}/v${version}_${sanitizedFilename}`;
    },

    // Phase 5: Evidence Cell - Upload Evidence to Storage
    async uploadEvidenceToStorage(storagePath, fileBuffer, mimeType) {
        const { data, error } = await supabase.storage
            .from('vmp-evidence')
            .upload(storagePath, fileBuffer, {
                contentType: mimeType,
                upsert: false // Prevent overwriting
            });

        if (error) {
            console.error('Storage Upload Error:', error);
            throw new Error(`Failed to upload to storage: ${error.message}`);
        }

        return data;
    },

    // Phase 5: Evidence Cell - Create Signed URL for Evidence
    async getEvidenceSignedUrl(storagePath, expiresIn = 3600) {
        const { data, error } = await supabase.storage
            .from('vmp-evidence')
            .createSignedUrl(storagePath, expiresIn);

        if (error) {
            console.error('Signed URL Error:', error);
            throw new Error(`Failed to create signed URL: ${error.message}`);
        }

        return data.signedUrl;
    },

    // Phase 5: Evidence Cell - Upload Evidence (Complete Flow)
    async uploadEvidence(caseId, file, evidenceType, checklistStepId = null, uploaderType = 'vendor', uploaderUserId = null) {
        if (!caseId || !file || !evidenceType) {
            throw new Error('uploadEvidence requires caseId, file, and evidenceType parameters');
        }

        // Get next version for this evidence type
        const version = await this.getNextEvidenceVersion(caseId, evidenceType);

        // Generate storage path
        const storagePath = this.generateEvidenceStoragePath(
            caseId,
            evidenceType,
            version,
            file.originalname || 'evidence'
        );

        // Compute checksum
        const checksum = await this.computeChecksum(file.buffer);

        // Upload to Supabase Storage
        await this.uploadEvidenceToStorage(storagePath, file.buffer, file.mimetype);

        // Create evidence record in database
        const queryPromise = supabase
            .from('vmp_evidence')
            .insert({
                case_id: caseId,
                checklist_step_id: checklistStepId,
                uploader_type: uploaderType,
                evidence_type: evidenceType,
                version: version,
                original_filename: file.originalname || 'evidence',
                storage_path: storagePath,
                mime_type: file.mimetype || 'application/octet-stream',
                size_bytes: file.size || file.buffer.length,
                checksum_sha256: checksum,
                status: 'submitted'
            })
            .select()
            .single();

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `uploadEvidence(${caseId})`
        );

        if (error) {
            console.error('Create Evidence Record Error:', error);
            // Try to clean up uploaded file
            try {
                await supabase.storage.from('vmp-evidence').remove([storagePath]);
            } catch (cleanupError) {
                console.error('Failed to cleanup uploaded file:', cleanupError);
            }
            throw new Error(`Failed to create evidence record: ${error.message}`);
        }

        // Update checklist step status to 'submitted' if linked
        if (checklistStepId) {
            try {
                await supabase
                    .from('vmp_checklist_steps')
                    .update({ status: 'submitted' })
                    .eq('id', checklistStepId)
                    .eq('case_id', caseId);
            } catch (updateError) {
                console.error('Failed to update checklist step status:', updateError);
                // Don't fail the upload if step update fails
            }
        }

        // Day 11: Update case status based on evidence (waiting_internal when evidence submitted)
        try {
            await this.updateCaseStatusFromEvidence(caseId);
        } catch (statusError) {
            console.error('Failed to update case status from evidence:', statusError);
            // Don't fail the upload if status update fails
        }

        return data;
    },

    // Day 9: Internal Ops - Verify Evidence
    async verifyEvidence(checklistStepId, verifiedByUserId, reason = null) {
        if (!checklistStepId || !verifiedByUserId) {
            throw new Error('verifyEvidence requires checklistStepId and verifiedByUserId');
        }

        // Get checklist step to find case_id
        const stepQuery = await supabase
            .from('vmp_checklist_steps')
            .select('case_id')
            .eq('id', checklistStepId)
            .single();

        if (stepQuery.error) throw stepQuery.error;
        const caseId = stepQuery.data.case_id;

        const queryPromise = supabase
            .from('vmp_checklist_steps')
            .update({
                status: 'verified',
                updated_at: new Date().toISOString()
            })
            .eq('id', checklistStepId)
            .select()
            .single();

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `verifyEvidence(${checklistStepId})`
        );

        if (error) throw error;

        // Day 11: Update case status based on evidence (may resolve if all verified)
        try {
            await this.updateCaseStatusFromEvidence(caseId);
        } catch (statusError) {
            console.error('Failed to update case status after verify:', statusError);
            // Don't fail verification if status update fails
        }

        return data;
    },

    // Day 9: Internal Ops - Reject Evidence
    async rejectEvidence(checklistStepId, rejectedByUserId, reason) {
        if (!checklistStepId || !rejectedByUserId || !reason) {
            throw new Error('rejectEvidence requires checklistStepId, rejectedByUserId, and reason');
        }

        const queryPromise = supabase
            .from('vmp_checklist_steps')
            .update({
                status: 'rejected',
                waived_reason: reason, // Store rejection reason
                updated_at: new Date().toISOString()
            })
            .eq('id', checklistStepId)
            .select()
            .single();

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `rejectEvidence(${checklistStepId})`
        );

        if (error) throw error;
        return data;
    },

    // Day 9: Internal Ops - Reassign Case
    async reassignCase(caseId, ownerTeam, assignedToUserId = null) {
        if (!caseId || !ownerTeam) {
            throw new Error('reassignCase requires caseId and ownerTeam');
        }

        if (!['procurement', 'ap', 'finance'].includes(ownerTeam)) {
            throw new Error('ownerTeam must be one of: procurement, ap, finance');
        }

        const updateData = {
            owner_team: ownerTeam,
            updated_at: new Date().toISOString()
        };

        // If assigned to specific user, we'd need an assigned_to field (future enhancement)
        // For now, just update owner_team

        const queryPromise = supabase
            .from('vmp_cases')
            .update(updateData)
            .eq('id', caseId)
            .select()
            .single();

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `reassignCase(${caseId})`
        );

        if (error) throw error;
        return data;
    },

    // Day 9: Internal Ops - Update Case Status
    async updateCaseStatus(caseId, status, updatedByUserId) {
        if (!caseId || !status || !updatedByUserId) {
            throw new Error('updateCaseStatus requires caseId, status, and updatedByUserId');
        }

        if (!['open', 'waiting_supplier', 'waiting_internal', 'resolved', 'blocked'].includes(status)) {
            throw new Error('status must be one of: open, waiting_supplier, waiting_internal, resolved, blocked');
        }

        const queryPromise = supabase
            .from('vmp_cases')
            .update({
                status: status,
                updated_at: new Date().toISOString()
            })
            .eq('id', caseId)
            .select()
            .single();

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `updateCaseStatus(${caseId})`
        );

        if (error) throw error;
        return data;
    },

    // Day 10: Escalation - Escalate Case
    async escalateCase(caseId, escalationLevel, escalatedByUserId, reason = null) {
        if (!caseId || !escalationLevel || !escalatedByUserId) {
            throw new Error('escalateCase requires caseId, escalationLevel, and escalatedByUserId');
        }

        if (escalationLevel < 1 || escalationLevel > 3) {
            throw new Error('escalationLevel must be between 1 and 3');
        }

        // Update case: set escalation_level, assign to AP team, update status
        const updateData = {
            escalation_level: escalationLevel,
            owner_team: 'ap', // Escalated cases go to AP
            status: escalationLevel >= 3 ? 'blocked' : 'waiting_internal', // Level 3 = blocked
            updated_at: new Date().toISOString()
        };

        const queryPromise = supabase
            .from('vmp_cases')
            .update(updateData)
            .eq('id', caseId)
            .select()
            .single();

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `escalateCase(${caseId})`
        );

        if (error) throw error;

        // Create escalation message/audit log (store in messages table as internal note)
        if (reason) {
            try {
                await supabase
                    .from('vmp_messages')
                    .insert({
                        case_id: caseId,
                        sender_type: 'internal',
                        channel_source: 'portal',
                        body: `Escalated to Level ${escalationLevel}: ${reason}`,
                        is_internal_note: true,
                        sender_user_id: escalatedByUserId
                    });
            } catch (messageError) {
                console.error('Failed to create escalation message:', messageError);
                // Don't fail escalation if message creation fails
            }
        }

        return data;
    },

    // Day 11: Notifications - Create Notification
    async createNotification(caseId, userId, notificationType, title, body = null) {
        if (!caseId || !userId || !notificationType || !title) {
            throw new Error('createNotification requires caseId, userId, notificationType, and title');
        }

        const queryPromise = supabase
            .from('vmp_notifications')
            .insert({
                case_id: caseId,
                user_id: userId,
                notification_type: notificationType,
                title: title,
                body: body
            })
            .select()
            .single();

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `createNotification(${caseId}, ${userId})`
        );

        if (error) {
            console.error('Error creating notification:', error);
            // Don't throw - notifications are non-critical
            return null;
        }

        return data;
    },

    // Day 11: Notifications - Notify All Vendor Users for Case
    async notifyVendorUsersForCase(caseId, notificationType, title, body = null) {
        if (!caseId || !notificationType || !title) {
            throw new Error('notifyVendorUsersForCase requires caseId, notificationType, and title');
        }

        try {
            // Get case to find vendor_id
            const caseQuery = await supabase
                .from('vmp_cases')
                .select('vendor_id')
                .eq('id', caseId)
                .single();

            if (caseQuery.error || !caseQuery.data) {
                console.error('Case not found for notification:', caseQuery.error);
                return [];
            }

            const vendorId = caseQuery.data.vendor_id;

            // Get all active vendor users for this vendor
            const usersQuery = await supabase
                .from('vmp_vendor_users')
                .select('id')
                .eq('vendor_id', vendorId)
                .eq('is_active', true);

            if (usersQuery.error || !usersQuery.data) {
                console.error('Error fetching vendor users:', usersQuery.error);
                return [];
            }

            // Create notifications for all vendor users
            const notifications = [];
            for (const user of usersQuery.data) {
                try {
                    const notif = await this.createNotification(caseId, user.id, notificationType, title, body);
                    if (notif) notifications.push(notif);
                } catch (notifError) {
                    console.error(`Failed to create notification for user ${user.id}:`, notifError);
                }
            }

            return notifications;
        } catch (error) {
            console.error('Error in notifyVendorUsersForCase:', error);
            return [];
        }
    },

    // Day 11: Notifications - Get User Notifications
    async getUserNotifications(userId, limit = 50, unreadOnly = false) {
        if (!userId) {
            throw new Error('getUserNotifications requires userId');
        }

        let query = supabase
            .from('vmp_notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (unreadOnly) {
            query = query.eq('is_read', false);
        }

        const { data, error } = await withTimeout(
            query,
            10000,
            `getUserNotifications(${userId})`
        );

        if (error) throw error;
        return data || [];
    },

    // Day 11: Status Transition Logic - Update Case Status Based on Evidence
    async updateCaseStatusFromEvidence(caseId) {
        if (!caseId) {
            throw new Error('updateCaseStatusFromEvidence requires caseId');
        }

        // Get all checklist steps for this case
        const steps = await this.getChecklistSteps(caseId);

        if (!steps || steps.length === 0) {
            // No checklist steps, keep current status
            return null;
        }

        // Check status of all steps
        const allVerified = steps.every(s => s.status === 'verified' || s.status === 'waived');
        const hasSubmitted = steps.some(s => s.status === 'submitted');
        const hasRejected = steps.some(s => s.status === 'rejected');

        // Get current case status
        const caseDetail = await this.getCaseDetail(caseId, null); // Get case without vendor filter for internal ops

        if (!caseDetail) {
            return null;
        }

        let newStatus = caseDetail.status;

        // Status transition rules:
        // - If all verified/waived → resolved
        // - If any submitted → waiting_internal (waiting for internal to verify)
        // - If any rejected → waiting_supplier (supplier needs to resubmit)
        // - Otherwise keep current status

        if (allVerified && steps.length > 0) {
            newStatus = 'resolved';
        } else if (hasRejected) {
            newStatus = 'waiting_supplier';
        } else if (hasSubmitted) {
            newStatus = 'waiting_internal';
        }

        // Only update if status changed
        if (newStatus !== caseDetail.status) {
            return await this.updateCaseStatus(caseId, newStatus, null); // System update
        }

        return caseDetail;
    }
};


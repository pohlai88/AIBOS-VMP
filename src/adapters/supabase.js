import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import dotenv from 'dotenv';
import {
    DatabaseError,
    TimeoutError,
    StorageError,
    NotFoundError,
    ValidationError,
    UnauthorizedError,
    handleSupabaseError,
    logError
} from '../utils/errors.js';
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
// Uses structured error handling per Supabase best practices
const withTimeout = async (promise, timeoutMs = 10000, operationName = 'operation') => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new TimeoutError(operationName, timeoutMs));
        }, timeoutMs);
    });

    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutId); // Clear timeout if promise resolves first
        return result;
    } catch (error) {
        clearTimeout(timeoutId); // Clear timeout on error
        logError(error, { operation: operationName, timeoutMs });
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
            const handledError = handleSupabaseError(error, 'getUserByEmail');
            if (handledError === null) {
                // PGRST116 - No rows returned (not an error)
                return null;
            }
            throw handledError;
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

        if (error) {
            const handledError = handleSupabaseError(error, 'createSession');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to create session', error);
        }
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
            const handledError = handleSupabaseError(error, 'getSession');
            if (handledError === null) {
                // PGRST116 - Session not found (not an error)
                return null;
            }
            throw handledError;
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
            const handledError = handleSupabaseError(error, 'deleteSession');
            // Log but don't throw - session might already be deleted
            if (handledError && handledError.code !== 'NOT_FOUND') {
                logError(handledError, { operation: 'deleteSession', sessionId });
            }
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
            const handledError = handleSupabaseError(error, 'cleanExpiredSessions');
            if (handledError) {
                logError(handledError, { operation: 'cleanExpiredSessions' });
            }
        }
    },

    // Phase 1: Context Loading
    async getVendorContext(userId) {
        // Try with is_internal first (if migration 012 has been applied)
        let queryPromise = supabase
            .from('vmp_vendor_users')
            .select(`
                id, display_name, vendor_id, email, is_active, is_internal,
                vmp_vendors ( id, name, tenant_id )
            `)
            .eq('id', userId)
            .single();

        let { data, error } = await withTimeout(
            queryPromise,
            10000,
            `getVendorContext(${userId})`
        );

        // If is_internal column doesn't exist, fall back to query without it
        if (error && error.message && error.message.includes('is_internal')) {
            queryPromise = supabase
                .from('vmp_vendor_users')
                .select(`
                    id, display_name, vendor_id, email, is_active,
                    vmp_vendors ( id, name, tenant_id )
                `)
                .eq('id', userId)
                .single();

            const result = await withTimeout(
                queryPromise,
                10000,
                `getVendorContext(${userId})`
            );
            data = result.data;
            error = result.error;
            // Set default is_internal to false if column doesn't exist
            if (data) {
                data.is_internal = false;
            }
        }

        if (error) {
            const handledError = handleSupabaseError(error, 'getVendorContext');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to get vendor context', error, { userId });
        }
        return data;
    },

    // Phase 2: Inbox Cell Data
    async getInbox(vendorId) {
        if (!vendorId) {
            throw new ValidationError('getInbox requires a vendorId parameter', 'vendorId');
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
            const handledError = handleSupabaseError(error, 'getInbox');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to fetch inbox', error, { vendorId });
        }
        return data || [];
    },

    // Phase 2: Case Detail Cell Data
    async getCaseDetail(caseId, vendorId) {
        if (!caseId || !vendorId) {
            throw new ValidationError('getCaseDetail requires both caseId and vendorId parameters', null, { caseId, vendorId });
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
            const handledError = handleSupabaseError(error, 'getCaseDetail');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to fetch case detail', error, { caseId, vendorId });
        }

        if (!caseData) {
            return null;
        }

        return caseData;
    },

    // Phase 3: Thread Cell - Get Messages
    async getMessages(caseId) {
        if (!caseId) {
            throw new ValidationError('getMessages requires a caseId parameter', 'caseId');
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
            const handledError = handleSupabaseError(error, 'getMessages');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to fetch messages', error, { caseId });
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
    async createMessage(caseId, body, senderType = 'vendor', channelSource = 'portal', senderUserId = null, isInternalNote = false, metadata = null) {
        if (!caseId || !body) {
            throw new ValidationError('createMessage requires caseId and body parameters', null, { caseId, hasBody: !!body });
        }

        // Validate sender_type
        const validSenderTypes = ['vendor', 'internal', 'ai'];
        if (!validSenderTypes.includes(senderType)) {
            throw new ValidationError(
                `Invalid sender_type. Must be one of: ${validSenderTypes.join(', ')}`,
                'senderType',
                { value: senderType, validValues: validSenderTypes }
            );
        }

        // Validate channel_source
        const validChannels = ['portal', 'whatsapp', 'email', 'slack'];
        if (!validChannels.includes(channelSource)) {
            throw new ValidationError(
                `Invalid channel_source. Must be one of: ${validChannels.join(', ')}`,
                'channelSource',
                { value: channelSource, validValues: validChannels }
            );
        }

        const queryPromise = supabase
            .from('vmp_messages')
            .insert({
                case_id: caseId,
                channel_source: channelSource,
                sender_type: senderType,
                sender_user_id: senderUserId,
                body: body.trim(),
                is_internal_note: isInternalNote,
                metadata: metadata || {}
            })
            .select()
            .single();

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `createMessage(${caseId})`
        );

        if (error) {
            const handledError = handleSupabaseError(error, 'createMessage');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to create message', error);
        }

        return data;
    },

    // Phase 4: Checklist Cell - Get Checklist Steps
    async getChecklistSteps(caseId) {
        if (!caseId) {
            throw new ValidationError('getChecklistSteps requires a caseId parameter', 'caseId');
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
            const handledError = handleSupabaseError(error, 'getChecklistSteps');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to fetch checklist steps', error);
        }

        return data || [];
    },

    // Phase 4: Checklist Cell - Create Checklist Step
    async createChecklistStep(caseId, label, requiredEvidenceType = null) {
        if (!caseId || !label) {
            throw new ValidationError('createChecklistStep requires caseId and label parameters', null, { caseId, hasLabel: !!label });
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
            const handledError = handleSupabaseError(error, 'createChecklistStep');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to create checklist step', error, { caseId, label });
        }

        return data;
    },

    // Phase 4: Checklist Cell - Ensure Checklist Steps Exist
    async ensureChecklistSteps(caseId, caseType) {
        if (!caseId || !caseType) {
            throw new ValidationError('ensureChecklistSteps requires caseId and caseType parameters', null, { caseId, caseType });
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
                const handledError = handleSupabaseError(error, `createChecklistStep(${step.label})`);
                if (handledError) {
                    logError(handledError, { operation: 'ensureChecklistSteps', stepLabel: step.label, caseId });
                }
                // Continue with other steps
            }
        }

        // Return all steps (existing + newly created)
        return await this.getChecklistSteps(caseId);
    },

    // Phase 5: Evidence Cell - Get Evidence
    async getEvidence(caseId) {
        if (!caseId) {
            throw new ValidationError('getEvidence requires a caseId parameter', 'caseId');
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
            const handledError = handleSupabaseError(error, 'getEvidence');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to fetch evidence', error, { caseId });
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
            throw new ValidationError('getNextEvidenceVersion requires caseId and evidenceType parameters', null, { caseId, evidenceType });
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

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows (not an error)
            const handledError = handleSupabaseError(error, 'getNextEvidenceVersion');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to get next version', error, { caseId, evidenceType });
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
            throw new StorageError('Failed to upload to storage', error, {
                storagePath,
                mimeType
            });
        }

        return data;
    },

    // Phase 5: Evidence Cell - Create Signed URL for Evidence
    async getEvidenceSignedUrl(storagePath, expiresIn = 3600) {
        const { data, error } = await supabase.storage
            .from('vmp-evidence')
            .createSignedUrl(storagePath, expiresIn);

        if (error) {
            throw new StorageError('Failed to create signed URL', error, {
                storagePath,
                expiresIn
            });
        }

        return data.signedUrl;
    },

    // Phase 5: Evidence Cell - Upload Evidence (Complete Flow)
    async uploadEvidence(caseId, file, evidenceType, checklistStepId = null, uploaderType = 'vendor', uploaderUserId = null) {
        if (!caseId || !file || !evidenceType) {
            throw new ValidationError('uploadEvidence requires caseId, file, and evidenceType parameters', null, {
                caseId,
                hasFile: !!file,
                evidenceType
            });
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
            const handledError = handleSupabaseError(error, 'uploadEvidence');
            // Try to clean up uploaded file
            try {
                await supabase.storage.from('vmp-evidence').remove([storagePath]);
            } catch (cleanupError) {
                logError(cleanupError, {
                    operation: 'uploadEvidence.cleanup',
                    storagePath,
                    originalError: handledError?.message
                });
            }
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to create evidence record', error, { caseId, evidenceType, storagePath });
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
                const handledError = handleSupabaseError(updateError, 'uploadEvidence.updateStepStatus');
                if (handledError) {
                    logError(handledError, { operation: 'uploadEvidence.updateStepStatus', checklistStepId, caseId });
                }
                // Don't fail the upload if step update fails
            }
        }

        // Day 11: Update case status based on evidence (waiting_internal when evidence submitted)
        try {
            await this.updateCaseStatusFromEvidence(caseId);
        } catch (statusError) {
            const handledError = handleSupabaseError(statusError, 'uploadEvidence.updateCaseStatus');
            if (handledError) {
                logError(handledError, { operation: 'uploadEvidence.updateCaseStatus', caseId });
            }
            // Don't fail the upload if status update fails
        }

        return data;
    },

    // Day 9: Internal Ops - Verify Evidence
    async verifyEvidence(checklistStepId, verifiedByUserId, reason = null) {
        if (!checklistStepId || !verifiedByUserId) {
            throw new ValidationError('verifyEvidence requires checklistStepId and verifiedByUserId', null, {
                checklistStepId,
                verifiedByUserId
            });
        }

        // Get checklist step to find case_id
        const stepQuery = await supabase
            .from('vmp_checklist_steps')
            .select('case_id')
            .eq('id', checklistStepId)
            .single();

        if (stepQuery.error) {
            const handledError = handleSupabaseError(stepQuery.error, 'verifyEvidence.getStep');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to fetch checklist step', stepQuery.error, { checklistStepId });
        }
        const caseId = stepQuery.data.case_id;

        const queryPromise = supabase
            .from('vmp_checklist_steps')
            .update({
                status: 'verified'
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
            const handledError = handleSupabaseError(statusError, 'verifyEvidence.updateCaseStatus');
            if (handledError) {
                logError(handledError, { operation: 'verifyEvidence.updateCaseStatus', caseId });
            }
            // Don't fail verification if status update fails
        }

        // Sprint 7.2: Log decision
        try {
            const stepLabel = data?.label || 'Evidence';
            await this.logDecision(
                caseId,
                'verify',
                `User ${verifiedByUserId}`,
                `Verified evidence: ${stepLabel}`,
                reason || 'Evidence meets requirements'
            );
        } catch (logError) {
            console.error('Failed to log decision:', logError);
            // Don't fail verification if decision logging fails
        }

        return data;
    },

    // Day 9: Internal Ops - Reject Evidence
    async rejectEvidence(checklistStepId, rejectedByUserId, reason) {
        if (!checklistStepId || !rejectedByUserId || !reason) {
            throw new ValidationError('rejectEvidence requires checklistStepId, rejectedByUserId, and reason', null, {
                checklistStepId,
                rejectedByUserId,
                hasReason: !!reason
            });
        }

        const queryPromise = supabase
            .from('vmp_checklist_steps')
            .update({
                status: 'rejected',
                waived_reason: reason // Store rejection reason
            })
            .eq('id', checklistStepId)
            .select()
            .single();

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `rejectEvidence(${checklistStepId})`
        );

        if (error) {
            const handledError = handleSupabaseError(error, 'rejectEvidence');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to reject evidence', error, { checklistStepId, rejectedByUserId });
        }

        // Get case_id for decision log
        const stepQuery = await supabase
            .from('vmp_checklist_steps')
            .select('case_id, label')
            .eq('id', checklistStepId)
            .single();

        const caseId = stepQuery.data?.case_id;
        const stepLabel = stepQuery.data?.label || 'Evidence';

        // Sprint 7.2: Log decision
        if (caseId) {
            try {
                await this.logDecision(
                    caseId,
                    'reject',
                    `User ${rejectedByUserId}`,
                    `Rejected evidence: ${stepLabel}`,
                    reason
                );
            } catch (logError) {
                console.error('Failed to log decision:', logError);
                // Don't fail rejection if decision logging fails
            }
        }

        return data;
    },

    // Day 9: Internal Ops - Reassign Case
    async reassignCase(caseId, ownerTeam, assignedToUserId = null) {
        if (!caseId || !ownerTeam) {
            throw new ValidationError('reassignCase requires caseId and ownerTeam', null, { caseId, ownerTeam });
        }

        if (!['procurement', 'ap', 'finance'].includes(ownerTeam)) {
            throw new ValidationError(
                'ownerTeam must be one of: procurement, ap, finance',
                'ownerTeam',
                { value: ownerTeam, validValues: ['procurement', 'ap', 'finance'] }
            );
        }

        const updateData = {
            owner_team: ownerTeam,
            updated_at: new Date().toISOString()
        };

        // Sprint 8.2: If assigned to specific user, update assigned_to_user_id
        if (assignedToUserId) {
            updateData.assigned_to_user_id = assignedToUserId;
        }

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

        if (error) {
            const handledError = handleSupabaseError(error, 'reassignCase');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to reassign case', error, { caseId, ownerTeam });
        }
        return data;
    },

    // Day 9: Internal Ops - Update Case Status
    async updateCaseStatus(caseId, status, updatedByUserId) {
        if (!caseId || !status) {
            throw new ValidationError('updateCaseStatus requires caseId and status', null, { caseId, status });
        }
        // updatedByUserId can be null for system updates (e.g., from evidence status changes)

        const validStatuses = ['open', 'waiting_supplier', 'waiting_internal', 'resolved', 'blocked'];
        if (!validStatuses.includes(status)) {
            throw new ValidationError(
                'status must be one of: open, waiting_supplier, waiting_internal, resolved, blocked',
                'status',
                { value: status, validValues: validStatuses }
            );
        }

        const queryPromise = supabase
            .from('vmp_cases')
            .update({
                status: status
            })
            .eq('id', caseId)
            .select()
            .single();

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `updateCaseStatus(${caseId})`
        );

        if (error) {
            const handledError = handleSupabaseError(error, 'updateCaseStatus');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to update case status', error, { caseId, status });
        }

        // Sprint 7.2: Log decision (only if updatedByUserId is provided, not for system updates)
        if (updatedByUserId) {
            try {
                await this.logDecision(
                    caseId,
                    'status_update',
                    `User ${updatedByUserId}`,
                    `Updated case status to ${status}`,
                    null
                );
            } catch (logError) {
                console.error('Failed to log decision:', logError);
                // Don't fail status update if decision logging fails
            }
        }

        return data;
    },

    // Day 10: Escalation - Escalate Case
    async escalateCase(caseId, escalationLevel, escalatedByUserId, reason = null) {
        if (!caseId || !escalationLevel || !escalatedByUserId) {
            throw new ValidationError('escalateCase requires caseId, escalationLevel, and escalatedByUserId', null, {
                caseId,
                escalationLevel,
                escalatedByUserId
            });
        }

        if (escalationLevel < 1 || escalationLevel > 3) {
            throw new ValidationError(
                'escalationLevel must be between 1 and 3',
                'escalationLevel',
                { value: escalationLevel, min: 1, max: 3 }
            );
        }

        // Update case: set escalation_level, assign to AP team, update status
        const updateData = {
            escalation_level: escalationLevel,
            owner_team: 'ap', // Escalated cases go to AP
            status: escalationLevel >= 3 ? 'blocked' : 'waiting_internal' // Level 3 = blocked
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

        if (error) {
            const handledError = handleSupabaseError(error, 'escalateCase');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to escalate case', error, { caseId, escalationLevel });
        }

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
            throw new ValidationError('createNotification requires caseId, userId, notificationType, and title', null, {
                caseId,
                userId,
                notificationType,
                hasTitle: !!title
            });
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
            throw new ValidationError('notifyVendorUsersForCase requires caseId, notificationType, and title', null, {
                caseId,
                notificationType,
                hasTitle: !!title
            });
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
            throw new ValidationError('getUserNotifications requires userId', 'userId');
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

        if (error) {
            const handledError = handleSupabaseError(error, 'getUserNotifications');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to fetch user notifications', error, { userId });
        }
        return data || [];
    },

    // Day 11: Status Transition Logic - Update Case Status Based on Evidence
    async updateCaseStatusFromEvidence(caseId) {
        if (!caseId) {
            throw new ValidationError('updateCaseStatusFromEvidence requires caseId', 'caseId');
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
        // For internal ops, we need to get the case without vendor filter
        // Use a direct query instead of getCaseDetail which requires vendorId
        const caseQuery = await supabase
            .from('vmp_cases')
            .select('*')
            .eq('id', caseId)
            .single();

        if (caseQuery.error || !caseQuery.data) {
            return null;
        }

        const caseDetail = caseQuery.data;

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
    },

    // Sprint 1.2: Break Glass Protocol - Get Group Director Info
    // NOTE: For Sprint 1, this uses mock data. Real DB fetch will be in Sprint 2.
    async getGroupDirectorInfo(groupId) {
        // Sprint 1: Return mock Director data
        // Sprint 2: Will query vmp_groups table for real director_user_id, director_name, director_phone, director_email
        return {
            director_name: 'John Director',
            director_phone: '+1 (555) 123-4567',
            director_email: 'director@example.com',
            group_name: 'Retail Division',
            group_id: groupId
        };
    },

    // Sprint 1.2: Break Glass Protocol - Log Break Glass Event
    async logBreakGlass(caseId, userId, groupId, directorInfo) {
        if (!caseId || !userId) {
            throw new ValidationError('logBreakGlass requires caseId and userId', null, {
                caseId,
                userId
            });
        }

        // Sprint 1: Log to console and messages table (audit trail)
        // Sprint 2: Will insert into vmp_break_glass_events table
        const breakGlassMessage = `BREAK GLASS PROTOCOL ACTIVATED: Case escalated to Level 3. Director Contact: ${directorInfo?.director_name || 'N/A'} (${directorInfo?.director_email || 'N/A'})`;

        try {
            await supabase
                .from('vmp_messages')
                .insert({
                    case_id: caseId,
                    sender_type: 'system',
                    channel_source: 'portal',
                    body: breakGlassMessage,
                    is_internal_note: true,
                    sender_user_id: userId
                });
        } catch (messageError) {
            console.error('Failed to log break glass message:', messageError);
            // Don't fail if message logging fails
        }

        // Sprint 2: Will also insert into vmp_break_glass_events table
        console.log('Break Glass Event:', {
            caseId,
            userId,
            groupId,
            directorInfo,
            timestamp: new Date().toISOString()
        });

        // Sprint 7.2: Log decision (if escalateCase was called, it will log separately)
        // This is just for break glass logging, decision log is handled in escalateCase

        return { logged: true };
    },

    // Sprint 2.3: CSV Ingest - Parse and Upsert Invoices
    async ingestInvoicesFromCSV(csvBuffer, vendorId, companyId) {
        if (!csvBuffer || !vendorId || !companyId) {
            throw new ValidationError('ingestInvoicesFromCSV requires csvBuffer, vendorId, and companyId', null, {
                hasBuffer: !!csvBuffer,
                vendorId,
                companyId
            });
        }

        // Parse CSV (simple but robust parser)
        const csvText = csvBuffer.toString('utf-8');
        const lines = csvText.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
            throw new ValidationError('CSV must have at least a header row and one data row', null, {
                lineCount: lines.length
            });
        }

        // Parse header row
        const headers = this._parseCSVLine(lines[0]);
        const requiredColumns = ['Invoice #', 'Date', 'Amount'];
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));

        if (missingColumns.length > 0) {
            throw new ValidationError(`CSV missing required columns: ${missingColumns.join(', ')}`, null, {
                foundColumns: headers,
                missingColumns
            });
        }

        // Map column indices
        const invoiceNumIdx = headers.indexOf('Invoice #');
        const dateIdx = headers.indexOf('Date');
        const amountIdx = headers.indexOf('Amount');
        const poRefIdx = headers.indexOf('PO #') >= 0 ? headers.indexOf('PO #') : -1;
        const companyCodeIdx = headers.indexOf('Company Code') >= 0 ? headers.indexOf('Company Code') : -1;
        const descriptionIdx = headers.indexOf('Description') >= 0 ? headers.indexOf('Description') : -1;

        // Parse data rows
        const invoices = [];
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
            try {
                const values = this._parseCSVLine(lines[i]);

                if (values.length < headers.length) {
                    errors.push(`Row ${i + 1}: Insufficient columns (expected ${headers.length}, got ${values.length})`);
                    continue;
                }

                const invoiceNum = values[invoiceNumIdx]?.trim();
                const dateStr = values[dateIdx]?.trim();
                const amountStr = values[amountIdx]?.trim();

                if (!invoiceNum || !dateStr || !amountStr) {
                    errors.push(`Row ${i + 1}: Missing required fields (Invoice #, Date, or Amount)`);
                    continue;
                }

                // Parse date (support multiple formats)
                const invoiceDate = this._parseDate(dateStr);
                if (!invoiceDate) {
                    errors.push(`Row ${i + 1}: Invalid date format: ${dateStr}`);
                    continue;
                }

                // Parse amount (remove currency symbols, commas)
                const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ''));
                if (isNaN(amount) || amount <= 0) {
                    errors.push(`Row ${i + 1}: Invalid amount: ${amountStr}`);
                    continue;
                }

                // Get company_id (use provided companyId, or lookup by company code)
                let finalCompanyId = companyId;
                if (companyCodeIdx >= 0 && values[companyCodeIdx]) {
                    const companyCode = values[companyCodeIdx].trim();
                    // Try to find company by code (name or code field)
                    const companyQuery = supabase
                        .from('vmp_companies')
                        .select('id')
                        .or(`name.ilike.%${companyCode}%,code.ilike.%${companyCode}%`)
                        .limit(1)
                        .single();

                    const { data: companyData } = await withTimeout(companyQuery, 5000, 'findCompanyByCode');
                    if (companyData) {
                        finalCompanyId = companyData.id;
                    }
                }

                invoices.push({
                    vendor_id: vendorId,
                    company_id: finalCompanyId,
                    invoice_num: invoiceNum,
                    invoice_date: invoiceDate.toISOString().split('T')[0],
                    amount: amount,
                    po_ref: poRefIdx >= 0 ? values[poRefIdx]?.trim() || null : null,
                    description: descriptionIdx >= 0 ? values[descriptionIdx]?.trim() || null : null,
                    source_system: 'manual'
                });
            } catch (rowError) {
                errors.push(`Row ${i + 1}: ${rowError.message}`);
            }
        }

        if (invoices.length === 0) {
            throw new ValidationError('No valid invoices found in CSV', null, { errors });
        }

        // Upsert invoices (handle duplicates by invoice_num + vendor_id + company_id)
        const upserted = [];
        const failed = [];

        for (const invoice of invoices) {
            try {
                // Check if invoice exists
                const existingQuery = supabase
                    .from('vmp_invoices')
                    .select('id')
                    .eq('vendor_id', invoice.vendor_id)
                    .eq('company_id', invoice.company_id)
                    .eq('invoice_num', invoice.invoice_num)
                    .single();

                const { data: existing } = await withTimeout(existingQuery, 5000, 'checkExistingInvoice');

                if (existing) {
                    // Update existing
                    const updateQuery = supabase
                        .from('vmp_invoices')
                        .update({
                            invoice_date: invoice.invoice_date,
                            amount: invoice.amount,
                            po_ref: invoice.po_ref,
                            description: invoice.description,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existing.id)
                        .select()
                        .single();

                    const { data: updated, error: updateError } = await withTimeout(updateQuery, 5000, 'updateInvoice');

                    if (updateError) throw updateError;
                    upserted.push(updated);
                } else {
                    // Insert new
                    const insertQuery = supabase
                        .from('vmp_invoices')
                        .insert(invoice)
                        .select()
                        .single();

                    const { data: inserted, error: insertError } = await withTimeout(insertQuery, 5000, 'insertInvoice');

                    if (insertError) throw insertError;
                    upserted.push(inserted);
                }
            } catch (upsertError) {
                failed.push({
                    invoice_num: invoice.invoice_num,
                    error: upsertError.message
                });
            }
        }

        return {
            total: invoices.length,
            upserted: upserted.length,
            failed: failed.length,
            invoices: upserted,
            errors: errors.length > 0 ? errors : null,
            failures: failed.length > 0 ? failed : null
        };
    },

    // Sprint 4.2: CSV Ingest - Parse and Upsert Payments
    async ingestPaymentsFromCSV(csvBuffer, vendorId, companyId) {
        if (!csvBuffer || !vendorId || !companyId) {
            throw new ValidationError('ingestPaymentsFromCSV requires csvBuffer, vendorId, and companyId', null, {
                hasBuffer: !!csvBuffer,
                vendorId,
                companyId
            });
        }

        // Parse CSV (simple but robust parser)
        const csvText = csvBuffer.toString('utf-8');
        const lines = csvText.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
            throw new ValidationError('CSV must have at least a header row and one data row', null, {
                lineCount: lines.length
            });
        }

        // Parse header row
        const headers = this._parseCSVLine(lines[0]);
        const requiredColumns = ['Payment Ref', 'Date', 'Amount'];
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));

        if (missingColumns.length > 0) {
            throw new ValidationError(`CSV missing required columns: ${missingColumns.join(', ')}`, null, {
                foundColumns: headers,
                missingColumns
            });
        }

        // Map column indices
        const paymentRefIdx = headers.indexOf('Payment Ref');
        const dateIdx = headers.indexOf('Date');
        const amountIdx = headers.indexOf('Amount');
        const invoiceNumIdx = headers.indexOf('Invoice #') >= 0 ? headers.indexOf('Invoice #') : -1;
        const descriptionIdx = headers.indexOf('Description') >= 0 ? headers.indexOf('Description') : -1;

        // Parse data rows
        const payments = [];
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
            try {
                const values = this._parseCSVLine(lines[i]);

                if (values.length < headers.length) {
                    errors.push(`Row ${i + 1}: Insufficient columns (expected ${headers.length}, got ${values.length})`);
                    continue;
                }

                const paymentRef = values[paymentRefIdx]?.trim();
                const dateStr = values[dateIdx]?.trim();
                const amountStr = values[amountIdx]?.trim();

                if (!paymentRef || !dateStr || !amountStr) {
                    errors.push(`Row ${i + 1}: Missing required fields (Payment Ref, Date, or Amount)`);
                    continue;
                }

                // Parse date (support multiple formats)
                const paymentDate = this._parseDate(dateStr);
                if (!paymentDate) {
                    errors.push(`Row ${i + 1}: Invalid date format: ${dateStr}`);
                    continue;
                }

                // Parse amount (remove currency symbols, commas)
                const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ''));
                if (isNaN(amount) || amount <= 0) {
                    errors.push(`Row ${i + 1}: Invalid amount: ${amountStr}`);
                    continue;
                }

                const invoiceNum = invoiceNumIdx >= 0 ? values[invoiceNumIdx]?.trim() || null : null;

                payments.push({
                    vendor_id: vendorId,
                    company_id: companyId,
                    payment_ref: paymentRef,
                    payment_date: paymentDate.toISOString().split('T')[0],
                    amount: amount,
                    invoice_num: invoiceNum,
                    description: descriptionIdx >= 0 ? values[descriptionIdx]?.trim() || null : null,
                    source_system: 'manual'
                });
            } catch (rowError) {
                errors.push(`Row ${i + 1}: ${rowError.message}`);
            }
        }

        if (payments.length === 0) {
            throw new ValidationError('No valid payments found in CSV', null, { errors });
        }

        // Upsert payments and update invoice status
        const upserted = [];
        const failed = [];
        const invoicesUpdated = [];

        for (const payment of payments) {
            try {
                // Check if payment exists
                const existingQuery = supabase
                    .from('vmp_payments')
                    .select('id')
                    .eq('vendor_id', payment.vendor_id)
                    .eq('company_id', payment.company_id)
                    .eq('payment_ref', payment.payment_ref)
                    .single();

                const { data: existing } = await withTimeout(existingQuery, 5000, 'checkExistingPayment');

                // Try to find linked invoice if invoice_num provided
                let invoiceId = null;
                if (payment.invoice_num) {
                    const invoiceQuery = supabase
                        .from('vmp_invoices')
                        .select('id')
                        .eq('vendor_id', payment.vendor_id)
                        .eq('company_id', payment.company_id)
                        .eq('invoice_num', payment.invoice_num)
                        .single();

                    const { data: invoiceData } = await withTimeout(invoiceQuery, 5000, 'findInvoiceByNumber');
                    if (invoiceData) {
                        invoiceId = invoiceData.id;
                    }
                }

                if (existing) {
                    // Update existing payment
                    const updateQuery = supabase
                        .from('vmp_payments')
                        .update({
                            payment_date: payment.payment_date,
                            amount: payment.amount,
                            invoice_num: payment.invoice_num,
                            invoice_id: invoiceId,
                            description: payment.description,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existing.id)
                        .select()
                        .single();

                    const { data: updated, error: updateError } = await withTimeout(updateQuery, 5000, 'updatePayment');

                    if (updateError) throw updateError;
                    upserted.push(updated);
                } else {
                    // Insert new payment
                    const insertQuery = supabase
                        .from('vmp_payments')
                        .insert({
                            ...payment,
                            invoice_id: invoiceId
                        })
                        .select()
                        .single();

                    const { data: inserted, error: insertError } = await withTimeout(insertQuery, 5000, 'insertPayment');

                    if (insertError) throw insertError;
                    upserted.push(inserted);
                }

                // Update invoice status to 'paid' if invoice linked
                if (invoiceId) {
                    const updateInvoiceQuery = supabase
                        .from('vmp_invoices')
                        .update({
                            status: 'paid',
                            paid_date: payment.payment_date,
                            paid_amount: payment.amount,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', invoiceId);

                    const { error: invoiceUpdateError } = await withTimeout(updateInvoiceQuery, 5000, 'updateInvoiceStatus');
                    if (!invoiceUpdateError) {
                        invoicesUpdated.push(invoiceId);
                    }
                }
            } catch (upsertError) {
                failed.push({
                    payment_ref: payment.payment_ref,
                    error: upsertError.message
                });
            }
        }

        return {
            total: payments.length,
            upserted: upserted.length,
            failed: failed.length,
            payments: upserted,
            invoicesUpdated: invoicesUpdated.length,
            errors: errors.length > 0 ? errors : null,
            failures: failed.length > 0 ? failed : null
        };
    },

    // Sprint 4.3: Ingest Remittances (Bulk PDF Upload)
    async ingestRemittances(files, vendorId, companyId) {
        if (!files || !Array.isArray(files) || files.length === 0) {
            throw new ValidationError('ingestRemittances requires files array', null, {
                hasFiles: !!files,
                fileCount: files?.length || 0
            });
        }

        if (!vendorId || !companyId) {
            throw new ValidationError('ingestRemittances requires vendorId and companyId', null, {
                vendorId,
                companyId
            });
        }

        const results = [];
        const errors = [];

        for (const file of files) {
            try {
                // Extract invoice/payment reference from filename
                // Expected formats: "INV-123.pdf", "PAY-456.pdf", "INV-2024-001.pdf", etc.
                const filename = file.originalname || file.name || '';
                const filenameWithoutExt = filename.replace(/\.(pdf|PDF)$/, '');

                // Try to match to invoice first (by invoice_num)
                let matchedPayment = null;
                let matchedInvoice = null;

                // Search for invoice by invoice number
                const invoiceQuery = supabase
                    .from('vmp_invoices')
                    .select('id, invoice_num')
                    .eq('vendor_id', vendorId)
                    .eq('company_id', companyId)
                    .ilike('invoice_num', filenameWithoutExt)
                    .limit(1)
                    .single();

                const { data: invoiceData } = await withTimeout(invoiceQuery, 5000, 'findInvoiceByFilename');

                if (invoiceData) {
                    matchedInvoice = invoiceData;

                    // Find payment linked to this invoice
                    const paymentQuery = supabase
                        .from('vmp_payments')
                        .select('id')
                        .eq('vendor_id', vendorId)
                        .eq('company_id', companyId)
                        .eq('invoice_id', invoiceData.id)
                        .limit(1)
                        .single();

                    const { data: paymentData } = await withTimeout(paymentQuery, 5000, 'findPaymentByInvoice');
                    if (paymentData) {
                        matchedPayment = paymentData;
                    }
                } else {
                    // Try to match by payment_ref
                    const paymentRefQuery = supabase
                        .from('vmp_payments')
                        .select('id, payment_ref')
                        .eq('vendor_id', vendorId)
                        .eq('company_id', companyId)
                        .ilike('payment_ref', filenameWithoutExt)
                        .limit(1)
                        .single();

                    const { data: paymentData } = await withTimeout(paymentRefQuery, 5000, 'findPaymentByRef');
                    if (paymentData) {
                        matchedPayment = paymentData;
                    }
                }

                if (!matchedPayment) {
                    errors.push({
                        filename: filename,
                        error: `No matching payment or invoice found for filename: ${filenameWithoutExt}`
                    });
                    continue;
                }

                // Generate storage path for remittance
                const storagePath = `remittances/${vendorId}/${companyId}/${matchedPayment.id}/${filename}`;

                // Upload to Supabase Storage (use vmp-evidence bucket or create vmp-remittances)
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('vmp-evidence') // Using existing bucket (can create separate bucket later)
                    .upload(storagePath, file.buffer, {
                        contentType: file.mimetype || 'application/pdf',
                        upsert: true
                    });

                if (uploadError) {
                    errors.push({
                        filename: filename,
                        error: `Storage upload failed: ${uploadError.message}`
                    });
                    continue;
                }

                // Generate public URL (or signed URL)
                const { data: urlData } = supabase.storage
                    .from('vmp-evidence')
                    .getPublicUrl(storagePath);

                const remittanceUrl = urlData?.publicUrl || `${supabaseUrl}/storage/v1/object/public/vmp-evidence/${storagePath}`;

                // Update payment record with remittance URL
                const updateQuery = supabase
                    .from('vmp_payments')
                    .update({
                        remittance_url: remittanceUrl,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', matchedPayment.id)
                    .select()
                    .single();

                const { data: updatedPayment, error: updateError } = await withTimeout(updateQuery, 5000, 'updatePaymentRemittance');

                if (updateError) {
                    errors.push({
                        filename: filename,
                        error: `Failed to update payment record: ${updateError.message}`
                    });
                    continue;
                }

                results.push({
                    filename: filename,
                    paymentId: matchedPayment.id,
                    remittanceUrl: remittanceUrl,
                    matchedInvoice: matchedInvoice?.invoice_num || null
                });
            } catch (fileError) {
                errors.push({
                    filename: file.originalname || file.name || 'unknown',
                    error: fileError.message
                });
            }
        }

        return {
            total: files.length,
            processed: results.length,
            failed: errors.length,
            results: results,
            errors: errors.length > 0 ? errors : null
        };
    },

    // Helper: Parse CSV line (handles quoted fields with commas)
    _parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote
                    current += '"';
                    i++; // Skip next quote
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // Field separator
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        // Add last field
        result.push(current.trim());
        return result;
    },

    // Helper: Parse date (supports multiple formats)
    _parseDate(dateStr) {
        // Try ISO format first (YYYY-MM-DD)
        let date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date;
        }

        // Try common formats: MM/DD/YYYY, DD/MM/YYYY, DD-MM-YYYY
        const formats = [
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
            /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/
        ];

        for (const format of formats) {
            const match = dateStr.match(format);
            if (match) {
                if (format === formats[2]) {
                    // YYYY-MM-DD
                    date = new Date(`${match[1]}-${match[2]}-${match[3]}`);
                } else {
                    // MM/DD/YYYY or DD/MM/YYYY (assume MM/DD/YYYY)
                    date = new Date(`${match[3]}-${match[1]}-${match[2]}`);
                }
                if (!isNaN(date.getTime())) {
                    return date;
                }
            }
        }

        return null;
    },

    // Sprint 2.4: Get Invoices for Vendor
    async getInvoices(vendorId, companyId = null, filters = {}) {
        if (!vendorId) {
            throw new ValidationError('getInvoices requires vendorId', null, { vendorId });
        }

        let query = supabase
            .from('vmp_invoices')
            .select(`
                *,
                vmp_companies (id, name, legal_name, currency_code)
            `)
            .eq('vendor_id', vendorId)
            .order('invoice_date', { ascending: false });

        if (companyId) {
            query = query.eq('company_id', companyId);
        }

        if (filters.status) {
            query = query.eq('status', filters.status);
        }

        if (filters.search) {
            query = query.ilike('invoice_num', `%${filters.search}%`);
        }

        const { data, error } = await withTimeout(query, 10000, `getInvoices(${vendorId})`);

        if (error) {
            const handledError = handleSupabaseError(error, 'getInvoices');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to fetch invoices', error, { vendorId, companyId });
        }

        return data || [];
    },

    // Sprint 4.4: Get Payments for Vendor
    async getPayments(vendorId, companyId = null, filters = {}) {
        if (!vendorId) {
            throw new ValidationError('getPayments requires vendorId', null, { vendorId });
        }

        let query = supabase
            .from('vmp_payments')
            .select(`
                *,
                vmp_companies (id, name, legal_name, currency_code),
                vmp_invoices (id, invoice_num, invoice_date, amount)
            `)
            .eq('vendor_id', vendorId)
            .order('payment_date', { ascending: false });

        if (companyId) {
            query = query.eq('company_id', companyId);
        }

        // Apply filters
        if (filters.payment_ref) {
            query = query.ilike('payment_ref', `%${filters.payment_ref}%`);
        }

        if (filters.invoice_num) {
            query = query.ilike('invoice_num', `%${filters.invoice_num}%`);
        }

        if (filters.date_from) {
            query = query.gte('payment_date', filters.date_from);
        }

        if (filters.date_to) {
            query = query.lte('payment_date', filters.date_to);
        }

        const { data, error } = await withTimeout(query, 10000, `getPayments(${vendorId})`);

        if (error) {
            const handledError = handleSupabaseError(error, 'getPayments');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to fetch payments', error, { vendorId });
        }

        return data || [];
    },

    // Sprint 4.4: Get Payment Detail
    async getPaymentDetail(paymentId, vendorId) {
        if (!paymentId || !vendorId) {
            throw new ValidationError('getPaymentDetail requires both paymentId and vendorId', null, {
                paymentId,
                vendorId
            });
        }

        const queryPromise = supabase
            .from('vmp_payments')
            .select(`
                *,
                vmp_companies (id, name, legal_name, currency_code),
                vmp_invoices (id, invoice_num, invoice_date, amount, status)
            `)
            .eq('id', paymentId)
            .eq('vendor_id', vendorId)
            .single();

        const { data, error } = await withTimeout(queryPromise, 10000, `getPaymentDetail(${paymentId})`);

        if (error) {
            const handledError = handleSupabaseError(error, 'getPaymentDetail');
            if (handledError === null) {
                return null; // Not found
            }
            throw handledError;
        }

        return data;
    },

    // Sprint 2.5: Get Invoice Detail
    async getInvoiceDetail(invoiceId, vendorId) {
        if (!invoiceId || !vendorId) {
            throw new ValidationError('getInvoiceDetail requires both invoiceId and vendorId', null, {
                invoiceId,
                vendorId
            });
        }

        const queryPromise = supabase
            .from('vmp_invoices')
            .select(`
                *,
                vmp_companies (id, name, legal_name, currency_code, country_code),
                vmp_vendors (id, name)
            `)
            .eq('id', invoiceId)
            .eq('vendor_id', vendorId)
            .single();

        const { data, error } = await withTimeout(queryPromise, 10000, `getInvoiceDetail(${invoiceId})`);

        if (error) {
            const handledError = handleSupabaseError(error, 'getInvoiceDetail');
            if (handledError === null) {
                return null; // Not found
            }
            throw handledError;
        }

        return data;
    },

    // Sprint 2.6: Get Matching Status
    async getMatchingStatus(invoiceId) {
        if (!invoiceId) {
            throw new ValidationError('getMatchingStatus requires invoiceId', null, { invoiceId });
        }

        // Get invoice
        const invoiceQuery = supabase
            .from('vmp_invoices')
            .select('po_ref, grn_ref, status, company_id')
            .eq('id', invoiceId)
            .single();

        const { data: invoice, error: invoiceError } = await withTimeout(invoiceQuery, 5000, 'getInvoiceForMatching');

        if (invoiceError || !invoice) {
            throw new NotFoundError('Invoice not found', { invoiceId });
        }

        // Check PO match
        let poMatch = null;
        if (invoice.po_ref) {
            const poQuery = supabase
                .from('vmp_po_refs')
                .select('*')
                .eq('company_id', invoice.company_id)
                .eq('po_number', invoice.po_ref)
                .single();

            const { data: poData } = await withTimeout(poQuery, 5000, 'getPO');
            poMatch = poData;
        }

        // Check GRN match
        let grnMatch = null;
        if (invoice.grn_ref) {
            const grnQuery = supabase
                .from('vmp_grn_refs')
                .select('*')
                .eq('company_id', invoice.company_id)
                .eq('grn_number', invoice.grn_ref)
                .single();

            const { data: grnData } = await withTimeout(grnQuery, 5000, 'getGRN');
            grnMatch = grnData;
        }

        // Determine matching state
        let matchState = 'READY';
        const exceptions = [];

        if (!invoice.po_ref) {
            matchState = 'WARN';
            exceptions.push('No PO reference');
        } else if (!poMatch) {
            matchState = 'BLOCK';
            exceptions.push(`PO ${invoice.po_ref} not found`);
        } else if (poMatch.status !== 'open') {
            matchState = 'WARN';
            exceptions.push(`PO ${invoice.po_ref} is ${poMatch.status}`);
        }

        if (!invoice.grn_ref) {
            if (matchState === 'READY') matchState = 'WARN';
            exceptions.push('No GRN reference');
        } else if (!grnMatch) {
            matchState = 'BLOCK';
            exceptions.push(`GRN ${invoice.grn_ref} not found`);
        } else if (grnMatch.status !== 'verified') {
            matchState = 'BLOCK';
            exceptions.push(`GRN ${invoice.grn_ref} is ${grnMatch.status}`);
        }

        return {
            invoice_id: invoiceId,
            match_state: matchState,
            exceptions,
            po_match: poMatch,
            grn_match: grnMatch,
            invoice_po_ref: invoice.po_ref,
            invoice_grn_ref: invoice.grn_ref
        };
    },

    // Sprint 2.7: Create Case from Invoice
    async createCaseFromInvoice(invoiceId, vendorId, userId, subject = null) {
        if (!invoiceId || !vendorId || !userId) {
            throw new ValidationError('createCaseFromInvoice requires invoiceId, vendorId, and userId', null, {
                invoiceId,
                vendorId,
                userId
            });
        }

        // Get invoice detail
        const invoice = await this.getInvoiceDetail(invoiceId, vendorId);
        if (!invoice) {
            throw new NotFoundError('Invoice not found', { invoiceId });
        }

        // Create case
        const caseData = {
            tenant_id: invoice.vmp_companies?.tenant_id || null, // Will need to get from company
            company_id: invoice.company_id,
            vendor_id: vendorId,
            case_type: 'invoice',
            status: 'open',
            subject: subject || `Invoice ${invoice.invoice_num} Exception`,
            owner_team: 'ap',
            linked_invoice_id: invoiceId,
            group_id: null // Will be set from company relationship
        };

        // Get company to set group_id
        const companyQuery = supabase
            .from('vmp_companies')
            .select('group_id, tenant_id')
            .eq('id', invoice.company_id)
            .single();

        const { data: company } = await withTimeout(companyQuery, 5000, 'getCompanyForCase');
        if (company) {
            caseData.tenant_id = company.tenant_id;
            caseData.group_id = company.group_id;
        }

        const insertQuery = supabase
            .from('vmp_cases')
            .insert(caseData)
            .select()
            .single();

        const { data: newCase, error } = await withTimeout(insertQuery, 10000, 'createCaseFromInvoice');

        if (error) {
            const handledError = handleSupabaseError(error, 'createCaseFromInvoice');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to create case from invoice', error, { invoiceId });
        }

        return newCase;
    },

    // Sprint 3.1: Create Invite
    async createInvite(vendorId, email, companyIds = [], createdByUserId = null) {
        if (!vendorId || !email) {
            throw new ValidationError('createInvite requires vendorId and email', null, {
                vendorId,
                email
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new ValidationError('Invalid email format', 'email', { email });
        }

        // Generate secure token
        const token = randomBytes(32).toString('hex');

        // Set expiry (7 days from now)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Create invite record
        const inviteQuery = supabase
            .from('vmp_invites')
            .insert({
                token,
                vendor_id: vendorId,
                email: email.toLowerCase().trim(),
                expires_at: expiresAt.toISOString()
            })
            .select()
            .single();

        const { data: invite, error: inviteError } = await withTimeout(
            inviteQuery,
            10000,
            'createInvite'
        );

        if (inviteError) {
            const handledError = handleSupabaseError(inviteError, 'createInvite');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to create invite', inviteError, { vendorId, email });
        }

        // Create vendor-company links if companyIds provided
        if (companyIds && companyIds.length > 0) {
            const linksToCreate = companyIds.map(companyId => ({
                vendor_id: vendorId,
                company_id: companyId
            }));

            // Use upsert to avoid duplicates
            const linksQuery = supabase
                .from('vmp_vendor_company_links')
                .upsert(linksToCreate, {
                    onConflict: 'vendor_id,company_id',
                    ignoreDuplicates: false
                });

            const { error: linksError } = await withTimeout(
                linksQuery,
                10000,
                'createVendorCompanyLinks'
            );

            if (linksError) {
                console.error('Error creating vendor-company links:', linksError);
                // Don't fail invite creation if links fail (can be created later)
            }
        }

        return {
            ...invite,
            invite_url: `/accept?token=${token}` // Full URL will be constructed in route
        };
    },

    // Sprint 3.2: Get Invite by Token
    async getInviteByToken(token) {
        if (!token) {
            throw new ValidationError('getInviteByToken requires token', null, { token });
        }

        // First get invite
        const inviteQuery = supabase
            .from('vmp_invites')
            .select(`
                *,
                vmp_vendors (id, name)
            `)
            .eq('token', token)
            .single();

        const { data: inviteData, error: inviteError } = await withTimeout(
            inviteQuery,
            10000,
            `getInviteByToken(${token.substring(0, 8)}...)`
        );

        if (inviteError) {
            const handledError = handleSupabaseError(inviteError, 'getInviteByToken');
            if (handledError === null) {
                return null; // Not found
            }
            throw handledError;
        }

        // Get vendor-company links separately
        const linksQuery = supabase
            .from('vmp_vendor_company_links')
            .select(`
                *,
                vmp_companies (id, name, legal_name)
            `)
            .eq('vendor_id', inviteData.vendor_id);

        const { data: linksData, error: linksError } = await withTimeout(
            linksQuery,
            10000,
            'getVendorCompanyLinks'
        );

        // Combine data
        const data = {
            ...inviteData,
            vmp_vendor_company_links: linksData || []
        };

        // Check if invite is expired
        if (new Date(data.expires_at) < new Date()) {
            return { ...data, expired: true };
        }

        // Check if invite is already used
        if (data.used_at) {
            return { ...data, used: true };
        }

        return data;
    },

    // Sprint 3.2: Create Vendor User
    async createVendorUser(vendorId, email, passwordHash, displayName = null) {
        if (!vendorId || !email || !passwordHash) {
            throw new ValidationError('createVendorUser requires vendorId, email, and passwordHash', null, {
                vendorId,
                email,
                hasPasswordHash: !!passwordHash
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new ValidationError('Invalid email format', 'email', { email });
        }

        // Check if user already exists
        const existingUser = await this.getUserByEmail(email);
        if (existingUser) {
            throw new ValidationError('User with this email already exists', 'email', { email });
        }

        const insertQuery = supabase
            .from('vmp_vendor_users')
            .insert({
                vendor_id: vendorId,
                email: email.toLowerCase().trim(),
                password_hash: passwordHash,
                display_name: displayName || email.split('@')[0],
                is_active: true
            })
            .select()
            .single();

        const { data, error } = await withTimeout(
            insertQuery,
            10000,
            'createVendorUser'
        );

        if (error) {
            const handledError = handleSupabaseError(error, 'createVendorUser');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to create vendor user', error, { vendorId, email });
        }

        return data;
    },

    // Sprint 3.2: Mark Invite as Used
    async markInviteAsUsed(inviteId, userId = null) {
        if (!inviteId) {
            throw new ValidationError('markInviteAsUsed requires inviteId', null, { inviteId });
        }

        const updateQuery = supabase
            .from('vmp_invites')
            .update({
                used_at: new Date().toISOString()
            })
            .eq('id', inviteId)
            .select()
            .single();

        const { data, error } = await withTimeout(
            updateQuery,
            10000,
            'markInviteAsUsed'
        );

        if (error) {
            const handledError = handleSupabaseError(error, 'markInviteAsUsed');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to mark invite as used', error, { inviteId });
        }

        return data;
    },

    // Sprint 3.3: Create Onboarding Case
    async createOnboardingCase(vendorId, companyId = null) {
        if (!vendorId) {
            throw new ValidationError('createOnboardingCase requires vendorId', null, { vendorId });
        }

        // Get vendor to determine tenant_id
        const vendorQuery = supabase
            .from('vmp_vendors')
            .select('tenant_id')
            .eq('id', vendorId)
            .single();

        const { data: vendor, error: vendorError } = await withTimeout(
            vendorQuery,
            5000,
            'getVendorForOnboarding'
        );

        if (vendorError || !vendor) {
            throw new NotFoundError('Vendor not found', { vendorId });
        }

        // If companyId not provided, get first company linked to vendor
        let finalCompanyId = companyId;
        let groupId = null;

        if (!finalCompanyId) {
            const linksQuery = supabase
                .from('vmp_vendor_company_links')
                .select('company_id')
                .eq('vendor_id', vendorId)
                .limit(1)
                .single();

            const { data: link } = await withTimeout(linksQuery, 5000, 'getVendorCompanyLink');
            if (link) {
                finalCompanyId = link.company_id;
            }
        }

        // Get company to determine group_id (whether provided or fetched)
        if (finalCompanyId) {
            // Get company to determine group_id
            const companyQuery = supabase
                .from('vmp_companies')
                .select('group_id')
                .eq('id', finalCompanyId)
                .single();

            const { data: company } = await withTimeout(companyQuery, 5000, 'getCompanyForOnboarding');
            if (company) {
                groupId = company.group_id;
            }
        }

        if (!finalCompanyId) {
            throw new ValidationError('No company linked to vendor. Please link a company first.', null, { vendorId });
        }

        // Create onboarding case
        const caseData = {
            tenant_id: vendor.tenant_id,
            company_id: finalCompanyId,
            vendor_id: vendorId,
            case_type: 'onboarding',
            status: 'open',
            subject: 'Supplier Onboarding',
            owner_team: 'procurement',
            group_id: groupId
        };

        const insertQuery = supabase
            .from('vmp_cases')
            .insert(caseData)
            .select()
            .single();

        const { data: newCase, error } = await withTimeout(
            insertQuery,
            10000,
            'createOnboardingCase'
        );

        if (error) {
            const handledError = handleSupabaseError(error, 'createOnboardingCase');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to create onboarding case', error, { vendorId });
        }

        // Ensure checklist steps exist (will use checklist-rules.js)
        try {
            await this.ensureChecklistSteps(newCase.id, 'onboarding');
        } catch (checklistError) {
            console.error('Error creating checklist steps for onboarding case:', checklistError);
            // Don't fail case creation if checklist creation fails
        }

        return newCase;
    },

    // Sprint 3.4: Approve Onboarding
    async approveOnboarding(caseId, userId) {
        if (!caseId || !userId) {
            throw new ValidationError('approveOnboarding requires caseId and userId', null, {
                caseId,
                userId
            });
        }

        // Get case to verify it's an onboarding case
        const caseQuery = supabase
            .from('vmp_cases')
            .select('vendor_id, case_type, status')
            .eq('id', caseId)
            .single();

        const { data: caseData, error: caseError } = await withTimeout(
            caseQuery,
            5000,
            'getCaseForApproval'
        );

        if (caseError || !caseData) {
            throw new NotFoundError('Case not found', { caseId });
        }

        if (caseData.case_type !== 'onboarding') {
            throw new ValidationError('Case is not an onboarding case', null, {
                caseId,
                caseType: caseData.case_type
            });
        }

        // Update case status to resolved
        const updateCaseQuery = supabase
            .from('vmp_cases')
            .update({
                status: 'resolved',
                updated_at: new Date().toISOString()
            })
            .eq('id', caseId)
            .select()
            .single();

        const { data: updatedCase, error: updateError } = await withTimeout(
            updateCaseQuery,
            10000,
            'updateOnboardingCase'
        );

        if (updateError) {
            const handledError = handleSupabaseError(updateError, 'approveOnboarding');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to update onboarding case', updateError, { caseId });
        }

        // Activate vendor account (set status='active' in vmp_vendors)
        // Note: Assuming vmp_vendors has a status field. If not, we'll need to add it.
        // For now, we'll just ensure vendor is active via vmp_vendor_users.is_active
        const activateVendorQuery = supabase
            .from('vmp_vendor_users')
            .update({
                is_active: true
            })
            .eq('vendor_id', caseData.vendor_id);

        const { error: activateError } = await withTimeout(
            activateVendorQuery,
            10000,
            'activateVendorUsers'
        );

        if (activateError) {
            console.error('Error activating vendor users:', activateError);
            // Don't fail approval if activation fails (users might already be active)
        }

        // Create notification message
        try {
            await supabase
                .from('vmp_messages')
                .insert({
                    case_id: caseId,
                    sender_type: 'internal',
                    channel_source: 'portal',
                    body: 'Onboarding approved. Vendor account activated.',
                    is_internal_note: false,
                    sender_user_id: userId
                });
        } catch (messageError) {
            console.error('Error creating approval notification:', messageError);
            // Don't fail approval if notification creation fails
        }

        // Sprint 7.2: Log decision
        try {
            await this.logDecision(
                caseId,
                'approve',
                `User ${userId}`,
                'Approved onboarding case and activated vendor account',
                'All onboarding requirements met'
            );
        } catch (logError) {
            console.error('Failed to log decision:', logError);
            // Don't fail approval if decision logging fails
        }

        return updatedCase;
    },

    // Sprint 5.1: Get Vendor Profile
    async getVendorProfile(vendorId) {
        if (!vendorId) {
            throw new ValidationError('getVendorProfile requires vendorId', null, { vendorId });
        }

        // Fetch vendor master data
        const vendorQuery = supabase
            .from('vmp_vendors')
            .select(`
                *,
                vmp_tenants (id, name)
            `)
            .eq('id', vendorId)
            .single();

        const { data: vendor, error: vendorError } = await withTimeout(
            vendorQuery,
            10000,
            `getVendorProfile(${vendorId})`
        );

        if (vendorError) {
            const handledError = handleSupabaseError(vendorError, 'getVendorProfile');
            if (handledError === null) {
                return null; // Not found
            }
            throw handledError;
        }

        // Fetch vendor-company links
        const linksQuery = supabase
            .from('vmp_vendor_company_links')
            .select(`
                *,
                vmp_companies (id, name, legal_name, country_code, currency_code)
            `)
            .eq('vendor_id', vendorId)
            .eq('status', 'active');

        const { data: companyLinks, error: linksError } = await withTimeout(
            linksQuery,
            10000,
            `getVendorCompanyLinks(${vendorId})`
        );

        if (linksError) {
            console.error('Error fetching company links:', linksError);
            // Don't fail if links query fails, just return vendor without links
        }

        // Fetch vendor users (for display)
        const usersQuery = supabase
            .from('vmp_vendor_users')
            .select('id, email, display_name, is_active, created_at')
            .eq('vendor_id', vendorId)
            .order('created_at', { ascending: false });

        const { data: users, error: usersError } = await withTimeout(
            usersQuery,
            10000,
            `getVendorUsers(${vendorId})`
        );

        if (usersError) {
            console.error('Error fetching vendor users:', usersError);
            // Don't fail if users query fails
        }

        return {
            vendor,
            companyLinks: companyLinks || [],
            users: users || []
        };
    },

    // Sprint 5.3: Request Bank Details Change (Creates Payment Case)
    async requestBankDetailsChange(vendorId, newBankDetails, userId) {
        if (!vendorId || !newBankDetails || !userId) {
            throw new ValidationError('requestBankDetailsChange requires vendorId, newBankDetails, and userId', null, {
                vendorId,
                hasBankDetails: !!newBankDetails,
                userId
            });
        }

        // Validate required bank details fields
        const requiredFields = ['account_name', 'account_number', 'bank_name', 'swift_code'];
        const missingFields = requiredFields.filter(field => !newBankDetails[field]);

        if (missingFields.length > 0) {
            throw new ValidationError(`Missing required bank details fields: ${missingFields.join(', ')}`, null, {
                missingFields
            });
        }

        // Get vendor context
        const vendorContext = await this.getVendorContext(userId);
        if (vendorContext.vendor_id !== vendorId) {
            throw new UnauthorizedError('Access denied to this vendor', { vendorId, userId });
        }

        // Get first active company link for the case
        const companyLinksQuery = supabase
            .from('vmp_vendor_company_links')
            .select('company_id')
            .eq('vendor_id', vendorId)
            .eq('status', 'active')
            .limit(1)
            .single();

        const { data: companyLink, error: linkError } = await withTimeout(
            companyLinksQuery,
            5000,
            'getCompanyLinkForBankChange'
        );

        if (linkError || !companyLink) {
            throw new ValidationError('Vendor must be linked to at least one company', null, { vendorId });
        }

        // Create payment case for bank details change
        const caseTitle = `Bank Details Change Request - ${newBankDetails.bank_name}`;
        const caseDescription = `Request to update bank details:\n\n` +
            `Account Name: ${newBankDetails.account_name}\n` +
            `Account Number: ${newBankDetails.account_number}\n` +
            `Bank Name: ${newBankDetails.bank_name}\n` +
            `SWIFT Code: ${newBankDetails.swift_code}\n` +
            (newBankDetails.branch_address ? `Branch Address: ${newBankDetails.branch_address}\n` : '') +
            (newBankDetails.currency ? `Currency: ${newBankDetails.currency}\n` : '');

        // Get tenant_id and group_id from vendor
        const vendorQuery = supabase
            .from('vmp_vendors')
            .select('tenant_id')
            .eq('id', vendorId)
            .single();

        const { data: vendorData, error: vendorError } = await withTimeout(
            vendorQuery,
            5000,
            'getVendorForBankChange'
        );

        if (vendorError || !vendorData) {
            throw new NotFoundError('Vendor not found', { vendorId });
        }

        // Get group_id from company (if available)
        const companyQuery = supabase
            .from('vmp_companies')
            .select('group_id')
            .eq('id', companyLink.company_id)
            .single();

        const { data: companyData } = await withTimeout(companyQuery, 5000, 'getCompanyGroupId');
        const groupId = companyData?.group_id || null;

        // Create case
        const caseInsertQuery = supabase
            .from('vmp_cases')
            .insert({
                tenant_id: vendorData.tenant_id,
                group_id: groupId,
                company_id: companyLink.company_id,
                vendor_id: vendorId,
                case_type: 'payment',
                status: 'open',
                subject: caseTitle,
                description: caseDescription,
                owner_team: 'finance',
                metadata: {
                    bank_details_change: true,
                    new_bank_details: newBankDetails,
                    requested_by: userId,
                    requested_at: new Date().toISOString()
                }
            })
            .select()
            .single();

        const { data: newCase, error: caseError } = await withTimeout(
            caseInsertQuery,
            10000,
            'createBankDetailsChangeCase'
        );

        if (caseError) {
            const handledError = handleSupabaseError(caseError, 'requestBankDetailsChange');
            throw handledError || new DatabaseError('Failed to create bank details change case', caseError);
        }

        // Create initial message requiring bank letter evidence
        try {
            await supabase
                .from('vmp_messages')
                .insert({
                    case_id: newCase.id,
                    sender_type: 'system',
                    channel_source: 'portal',
                    body: 'Bank details change requested. Please upload a Bank Letter as evidence. The change will require internal approval before activation.',
                    is_internal_note: false,
                    sender_user_id: userId
                });
        } catch (messageError) {
            console.error('Error creating bank change message:', messageError);
            // Don't fail if message creation fails
        }

        return newCase;
    },

    // Sprint 5.4: Get Compliance Documents
    async getComplianceDocuments(vendorId) {
        if (!vendorId) {
            throw new ValidationError('getComplianceDocuments requires vendorId', null, { vendorId });
        }

        const casesQuery = supabase
            .from('vmp_cases')
            .select(`
                id,
                case_type,
                subject,
                created_at,
                vmp_evidence (
                    id,
                    evidence_type,
                    original_filename,
                    created_at,
                    status
                )
            `)
            .eq('vendor_id', vendorId)
            .in('case_type', ['onboarding', 'compliance'])
            .order('created_at', { ascending: false });

        const { data: cases, error: casesError } = await withTimeout(
            casesQuery,
            10000,
            `getComplianceDocuments(${vendorId})`
        );

        if (casesError) {
            const handledError = handleSupabaseError(casesError, 'getComplianceDocuments');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to fetch compliance documents', casesError, { vendorId });
        }

        // Extract compliance documents from cases and evidence
        const complianceDocs = [];
        if (cases) {
            for (const caseItem of cases) {
                if (caseItem.vmp_evidence && caseItem.vmp_evidence.length > 0) {
                    for (const evidence of caseItem.vmp_evidence) {
                        complianceDocs.push({
                            case_id: caseItem.id,
                            case_type: caseItem.case_type,
                            evidence_type: evidence.evidence_type,
                            filename: evidence.original_filename,
                            uploaded_at: evidence.created_at,
                            status: evidence.status,
                            case_subject: caseItem.subject
                        });
                    }
                }
            }
        }

        return complianceDocs;
    },

    // Sprint 5.5: Get Contract Library
    async getContractLibrary(vendorId) {
        if (!vendorId) {
            throw new ValidationError('getContractLibrary requires vendorId', null, { vendorId });
        }

        const casesQuery = supabase
            .from('vmp_cases')
            .select(`
                id,
                subject,
                created_at,
                vmp_evidence (
                    id,
                    evidence_type,
                    original_filename,
                    storage_path,
                    created_at,
                    status
                )
            `)
            .eq('vendor_id', vendorId)
            .eq('case_type', 'contract')
            .order('created_at', { ascending: false });

        const { data: cases, error: casesError } = await withTimeout(
            casesQuery,
            10000,
            `getContractLibrary(${vendorId})`
        );

        if (casesError) {
            const handledError = handleSupabaseError(casesError, 'getContractLibrary');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to fetch contracts', casesError, { vendorId });
        }

        // Extract contracts from cases and evidence
        const contracts = [];
        if (cases) {
            for (const caseItem of cases) {
                if (caseItem.vmp_evidence && caseItem.vmp_evidence.length > 0) {
                    for (const evidence of caseItem.vmp_evidence) {
                        // Determine contract type from evidence_type or case subject
                        let contractType = evidence.evidence_type || 'contract';
                        if (caseItem.subject) {
                            const subjectLower = caseItem.subject.toLowerCase();
                            if (subjectLower.includes('nda')) contractType = 'NDA';
                            else if (subjectLower.includes('msa') || subjectLower.includes('master service')) contractType = 'MSA';
                            else if (subjectLower.includes('indemnity')) contractType = 'Indemnity';
                        }

                        contracts.push({
                            id: evidence.id,
                            case_id: caseItem.id,
                            contract_type: contractType,
                            filename: evidence.original_filename,
                            uploaded_at: evidence.created_at,
                            status: evidence.status,
                            storage_path: evidence.storage_path
                        });
                    }
                }
            }
        }

        return contracts;
    },

    // Sprint 6.1: Get Organization Tree
    async getOrgTree(userId) {
        if (!userId) {
            throw new ValidationError('getOrgTree requires userId', null, { userId });
        }

        // Get user context to determine scope
        const userContext = await this.getVendorContext(userId);

        if (!userContext.is_internal) {
            throw new UnauthorizedError('Access denied. Internal users only.', { userId });
        }

        // Get tenant_id from user's vendor (internal users still have vendor_id pointing to a tenant)
        const tenantId = userContext.vmp_vendors?.tenant_id;
        if (!tenantId) {
            throw new ValidationError('User must be associated with a tenant', null, { userId });
        }

        // Fetch tenant
        const tenantQuery = supabase
            .from('vmp_tenants')
            .select('id, name')
            .eq('id', tenantId)
            .single();

        const { data: tenant, error: tenantError } = await withTimeout(
            tenantQuery,
            5000,
            'getTenant'
        );

        if (tenantError || !tenant) {
            throw new NotFoundError('Tenant not found', { tenantId });
        }

        // Fetch groups
        const groupsQuery = supabase
            .from('vmp_groups')
            .select('id, name, code')
            .eq('tenant_id', tenantId)
            .order('name', { ascending: true });

        const { data: groups, error: groupsError } = await withTimeout(
            groupsQuery,
            5000,
            'getGroups'
        );

        if (groupsError) {
            console.error('Error fetching groups:', groupsError);
            // Continue with empty groups array
        }

        // Fetch companies (with group links)
        const companiesQuery = supabase
            .from('vmp_companies')
            .select('id, name, legal_name, group_id, country_code, currency_code')
            .eq('tenant_id', tenantId)
            .order('name', { ascending: true });

        const { data: companies, error: companiesError } = await withTimeout(
            companiesQuery,
            5000,
            'getCompanies'
        );

        if (companiesError) {
            console.error('Error fetching companies:', companiesError);
            // Continue with empty companies array
        }

        // Build hierarchical structure
        const orgTree = {
            tenant: tenant,
            groups: (groups || []).map(group => ({
                ...group,
                companies: (companies || []).filter(company => company.group_id === group.id)
            })),
            ungroupedCompanies: (companies || []).filter(company => !company.group_id)
        };

        // Apply RBAC filtering based on user scope
        const userScopeGroupId = userContext.scope_group_id;
        const userScopeCompanyId = userContext.scope_company_id;

        // If user has group scope, filter to that group only
        if (userScopeGroupId) {
            orgTree.groups = orgTree.groups.filter(g => g.id === userScopeGroupId);
            orgTree.ungroupedCompanies = [];
        }

        // If user has company scope, filter to that company only
        if (userScopeCompanyId) {
            orgTree.groups = orgTree.groups.map(group => ({
                ...group,
                companies: group.companies.filter(c => c.id === userScopeCompanyId)
            })).filter(group => group.companies.length > 0);
            orgTree.ungroupedCompanies = orgTree.ungroupedCompanies.filter(c => c.id === userScopeCompanyId);
        }

        return orgTree;
    },

    // Sprint 6.2: Get Scoped Dashboard
    async getScopedDashboard(scopeType, scopeId, userId) {
        if (!scopeType || !scopeId || !userId) {
            throw new ValidationError('getScopedDashboard requires scopeType, scopeId, and userId', null, {
                scopeType,
                scopeId,
                userId
            });
        }

        // Verify user has access to this scope
        const userContext = await this.getVendorContext(userId);

        if (!userContext.is_internal) {
            throw new UnauthorizedError('Access denied. Internal users only.', { userId });
        }

        // Verify scope access
        if (scopeType === 'group') {
            if (userContext.scope_company_id) {
                // Manager can't access group scope
                throw new UnauthorizedError('Access denied. Manager cannot access group scope.', { userId, scopeType });
            }
            if (userContext.scope_group_id && userContext.scope_group_id !== scopeId) {
                throw new UnauthorizedError('Access denied to this group', { userId, scopeId });
            }
        } else if (scopeType === 'company') {
            if (userContext.scope_company_id && userContext.scope_company_id !== scopeId) {
                throw new UnauthorizedError('Access denied to this company', { userId, scopeId });
            }
            if (userContext.scope_group_id) {
                // Director: verify company belongs to their group
                const companyQuery = supabase
                    .from('vmp_companies')
                    .select('group_id')
                    .eq('id', scopeId)
                    .single();

                const { data: company, error: companyError } = await withTimeout(
                    companyQuery,
                    5000,
                    'getCompanyForScopeCheck'
                );

                if (companyError || !company || company.group_id !== userContext.scope_group_id) {
                    throw new UnauthorizedError('Access denied. Company not in your group.', { userId, scopeId });
                }
            }
        }

        // Build query based on scope type
        let casesQuery;
        if (scopeType === 'group') {
            // Director View: All cases in group
            casesQuery = supabase
                .from('vmp_cases')
                .select(`
                    id,
                    case_type,
                    status,
                    escalation_level,
                    subject,
                    created_at,
                    vmp_companies (id, name)
                `)
                .eq('group_id', scopeId)
                .order('created_at', { ascending: false })
                .limit(100);
        } else {
            // Manager View: Cases for single company
            casesQuery = supabase
                .from('vmp_cases')
                .select(`
                    id,
                    case_type,
                    status,
                    escalation_level,
                    subject,
                    created_at,
                    vmp_companies (id, name)
                `)
                .eq('company_id', scopeId)
                .order('created_at', { ascending: false })
                .limit(100);
        }

        const { data: cases, error: casesError } = await withTimeout(
            casesQuery,
            10000,
            `getScopedDashboard(${scopeType}, ${scopeId})`
        );

        if (casesError) {
            const handledError = handleSupabaseError(casesError, 'getScopedDashboard');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to fetch dashboard data', casesError, { scopeType, scopeId });
        }

        // Calculate metrics
        const totalCases = cases?.length || 0;
        const criticalCases = cases?.filter(c => c.escalation_level >= 2).length || 0;
        const openCases = cases?.filter(c => c.status === 'open').length || 0;
        const resolvedCases = cases?.filter(c => c.status === 'resolved').length || 0;

        // Calculate AP Exposure (sum of invoice amounts for pending invoices)
        let apExposure = 0;
        if (scopeType === 'group') {
            // Sum across all companies in group
            const invoicesQuery = supabase
                .from('vmp_invoices')
                .select('amount, company_id, vmp_companies!inner(group_id)')
                .eq('status', 'pending')
                .eq('vmp_companies.group_id', scopeId);

            const { data: invoices } = await withTimeout(invoicesQuery, 5000, 'getGroupAPExposure');
            if (invoices) {
                apExposure = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
            }
        } else {
            // Sum for single company
            const invoicesQuery = supabase
                .from('vmp_invoices')
                .select('amount')
                .eq('company_id', scopeId)
                .eq('status', 'pending');

            const { data: invoices } = await withTimeout(invoicesQuery, 5000, 'getCompanyAPExposure');
            if (invoices) {
                apExposure = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
            }
        }

        return {
            scopeType,
            scopeId,
            metrics: {
                totalCases,
                criticalCases,
                openCases,
                resolvedCases,
                apExposure
            },
            recentCases: cases || []
        };
    },

    // Sprint 6.3: Get Ops Case Queue (Scoped)
    async getOpsCaseQueue(scopeType, scopeId, userId, filters = {}) {
        if (!scopeType || !scopeId || !userId) {
            throw new ValidationError('getOpsCaseQueue requires scopeType, scopeId, and userId', null, {
                scopeType,
                scopeId,
                userId
            });
        }

        // Verify user has access to this scope
        const userContext = await this.getVendorContext(userId);

        if (!userContext.is_internal) {
            throw new UnauthorizedError('Access denied. Internal users only.', { userId });
        }

        // Verify scope access (same logic as getScopedDashboard)
        if (scopeType === 'group') {
            if (userContext.scope_company_id) {
                throw new UnauthorizedError('Access denied. Manager cannot access group scope.', { userId, scopeType });
            }
            if (userContext.scope_group_id && userContext.scope_group_id !== scopeId) {
                throw new UnauthorizedError('Access denied to this group', { userId, scopeId });
            }
        } else if (scopeType === 'company') {
            if (userContext.scope_company_id && userContext.scope_company_id !== scopeId) {
                throw new UnauthorizedError('Access denied to this company', { userId, scopeId });
            }
            if (userContext.scope_group_id) {
                const companyQuery = supabase
                    .from('vmp_companies')
                    .select('group_id')
                    .eq('id', scopeId)
                    .single();

                const { data: company, error: companyError } = await withTimeout(
                    companyQuery,
                    5000,
                    'getCompanyForScopeCheck'
                );

                if (companyError || !company || company.group_id !== userContext.scope_group_id) {
                    throw new UnauthorizedError('Access denied. Company not in your group.', { userId, scopeId });
                }
            }
        }

        // Build query based on scope type
        let casesQuery;
        if (scopeType === 'group') {
            casesQuery = supabase
                .from('vmp_cases')
                .select(`
                    id,
                    case_type,
                    status,
                    escalation_level,
                    subject,
                    owner_team,
                    created_at,
                    updated_at,
                    vmp_companies (id, name),
                    vmp_vendors (id, name)
                `)
                .eq('group_id', scopeId);
        } else {
            casesQuery = supabase
                .from('vmp_cases')
                .select(`
                    id,
                    case_type,
                    status,
                    escalation_level,
                    subject,
                    owner_team,
                    created_at,
                    updated_at,
                    vmp_companies (id, name),
                    vmp_vendors (id, name)
                `)
                .eq('company_id', scopeId);
        }

        // Apply filters
        if (filters.status) {
            casesQuery = casesQuery.eq('status', filters.status);
        }

        if (filters.owner_team) {
            casesQuery = casesQuery.eq('owner_team', filters.owner_team);
        }

        if (filters.case_type) {
            casesQuery = casesQuery.eq('case_type', filters.case_type);
        }

        casesQuery = casesQuery.order('updated_at', { ascending: false });

        const { data: cases, error: casesError } = await withTimeout(
            casesQuery,
            10000,
            `getOpsCaseQueue(${scopeType}, ${scopeId})`
        );

        if (casesError) {
            const handledError = handleSupabaseError(casesError, 'getOpsCaseQueue');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to fetch case queue', casesError, { scopeType, scopeId });
        }

        return cases || [];
    },

    // Sprint 6.4: Get Case Detail for Internal Users (No Vendor Restriction)
    async getCaseDetailForOps(caseId, userId) {
        if (!caseId || !userId) {
            throw new ValidationError('getCaseDetailForOps requires both caseId and userId', null, { caseId, userId });
        }

        // Verify user is internal
        const userContext = await this.getVendorContext(userId);
        if (!userContext.is_internal) {
            throw new UnauthorizedError('Access denied. Internal users only.', { userId });
        }

        // Fetch case without vendor restriction
        const queryPromise = supabase
            .from('vmp_cases')
            .select(`
                *,
                vmp_companies (id, name, group_id),
                vmp_vendors (id, name)
            `)
            .eq('id', caseId)
            .single();

        const { data: caseData, error } = await withTimeout(
            queryPromise,
            10000,
            `getCaseDetailForOps(${caseId})`
        );

        if (error) {
            const handledError = handleSupabaseError(error, 'getCaseDetailForOps');
            if (handledError === null) {
                return null; // Not found
            }
            throw handledError;
        }

        if (!caseData) {
            return null;
        }

        // Verify scope access
        if (userContext.scope_company_id) {
            // Manager: verify company match
            if (caseData.company_id !== userContext.scope_company_id) {
                throw new UnauthorizedError('Access denied to this case', { userId, caseId });
            }
        } else if (userContext.scope_group_id) {
            // Director: verify group match
            if (caseData.group_id !== userContext.scope_group_id) {
                throw new UnauthorizedError('Access denied to this case', { userId, caseId });
            }
        }
        // Super admin (no scope): allow access to all cases

        return caseData;
    },

    // Sprint 6.5: Get Vendor Directory (Scoped)
    async getVendorDirectory(scopeType, scopeId, userId, filters = {}) {
        if (!scopeType || !scopeId || !userId) {
            throw new ValidationError('getVendorDirectory requires scopeType, scopeId, and userId', null, {
                scopeType,
                scopeId,
                userId
            });
        }

        // Verify user is internal
        const userContext = await this.getVendorContext(userId);
        if (!userContext.is_internal) {
            throw new UnauthorizedError('Access denied. Internal users only.', { userId });
        }

        // Verify scope access (same logic as getScopedDashboard)
        if (scopeType === 'group') {
            if (userContext.scope_company_id) {
                throw new UnauthorizedError('Access denied. Manager cannot access group scope.', { userId, scopeType });
            }
            if (userContext.scope_group_id && userContext.scope_group_id !== scopeId) {
                throw new UnauthorizedError('Access denied to this group', { userId, scopeId });
            }
        } else if (scopeType === 'company') {
            if (userContext.scope_company_id && userContext.scope_company_id !== scopeId) {
                throw new UnauthorizedError('Access denied to this company', { userId, scopeId });
            }
            if (userContext.scope_group_id) {
                const companyQuery = supabase
                    .from('vmp_companies')
                    .select('group_id')
                    .eq('id', scopeId)
                    .single();

                const { data: company, error: companyError } = await withTimeout(
                    companyQuery,
                    5000,
                    'getCompanyForScopeCheck'
                );

                if (companyError || !company || company.group_id !== userContext.scope_group_id) {
                    throw new UnauthorizedError('Access denied. Company not in your group.', { userId, scopeId });
                }
            }
        }

        // Get tenant_id from scope
        let tenantId;
        if (scopeType === 'group') {
            const groupQuery = supabase
                .from('vmp_groups')
                .select('tenant_id')
                .eq('id', scopeId)
                .single();

            const { data: group, error: groupError } = await withTimeout(groupQuery, 5000, 'getGroupTenant');
            if (groupError || !group) {
                throw new NotFoundError('Group not found', { scopeId });
            }
            tenantId = group.tenant_id;
        } else {
            const companyQuery = supabase
                .from('vmp_companies')
                .select('tenant_id')
                .eq('id', scopeId)
                .single();

            const { data: company, error: companyError } = await withTimeout(companyQuery, 5000, 'getCompanyTenant');
            if (companyError || !company) {
                throw new NotFoundError('Company not found', { scopeId });
            }
            tenantId = company.tenant_id;
        }

        // Fetch vendors linked to companies in scope
        let vendorsQuery;
        if (scopeType === 'group') {
            // Get all companies in group
            const companiesInGroupQuery = supabase
                .from('vmp_companies')
                .select('id')
                .eq('group_id', scopeId);

            const { data: companiesInGroup, error: companiesError } = await withTimeout(
                companiesInGroupQuery,
                5000,
                'getCompaniesInGroup'
            );

            if (companiesError || !companiesInGroup || companiesInGroup.length === 0) {
                return [];
            }

            const companyIds = companiesInGroup.map(c => c.id);

            // Get vendors linked to these companies
            vendorsQuery = supabase
                .from('vmp_vendor_company_links')
                .select(`
                    *,
                    vmp_vendors (
                        id,
                        name,
                        status,
                        created_at
                    ),
                    vmp_companies (
                        id,
                        name,
                        legal_name
                    )
                `)
                .in('company_id', companyIds)
                .eq('status', 'active');
        } else {
            // Get vendors linked to single company
            vendorsQuery = supabase
                .from('vmp_vendor_company_links')
                .select(`
                    *,
                    vmp_vendors (
                        id,
                        name,
                        status,
                        created_at
                    ),
                    vmp_companies (
                        id,
                        name,
                        legal_name
                    )
                `)
                .eq('company_id', scopeId)
                .eq('status', 'active');
        }

        // Apply filters
        if (filters.status) {
            vendorsQuery = vendorsQuery.eq('vmp_vendors.status', filters.status);
        }

        vendorsQuery = vendorsQuery.order('vmp_vendors.created_at', { ascending: false });

        const { data: links, error: linksError } = await withTimeout(
            vendorsQuery,
            10000,
            `getVendorDirectory(${scopeType}, ${scopeId})`
        );

        if (linksError) {
            const handledError = handleSupabaseError(linksError, 'getVendorDirectory');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to fetch vendor directory', linksError, { scopeType, scopeId });
        }

        // Group vendors by vendor_id (since one vendor can be linked to multiple companies)
        const vendorMap = new Map();
        if (links) {
            for (const link of links) {
                if (!link.vmp_vendors) continue;

                const vendorId = link.vmp_vendors.id;
                if (!vendorMap.has(vendorId)) {
                    vendorMap.set(vendorId, {
                        vendor: link.vmp_vendors,
                        companies: [],
                        erpCodes: {}
                    });
                }

                const vendorEntry = vendorMap.get(vendorId);
                if (link.vmp_companies) {
                    vendorEntry.companies.push(link.vmp_companies);
                }
                if (link.erp_vendor_code && link.vmp_companies) {
                    vendorEntry.erpCodes[link.vmp_companies.id] = link.erp_vendor_code;
                }
            }
        }

        // Get case counts for each vendor
        const vendors = Array.from(vendorMap.values());
        for (const vendorEntry of vendors) {
            // Count cases for this vendor
            let caseCountQuery;
            if (scopeType === 'group') {
                const companiesInGroupQuery = supabase
                    .from('vmp_companies')
                    .select('id')
                    .eq('group_id', scopeId);

                const { data: companiesInGroup } = await withTimeout(companiesInGroupQuery, 5000, 'getCompaniesForCaseCount');
                const companyIds = companiesInGroup?.map(c => c.id) || [];

                if (companyIds.length > 0) {
                    caseCountQuery = supabase
                        .from('vmp_cases')
                        .select('id', { count: 'exact', head: true })
                        .eq('vendor_id', vendorEntry.vendor.id)
                        .in('company_id', companyIds);
                }
            } else {
                caseCountQuery = supabase
                    .from('vmp_cases')
                    .select('id', { count: 'exact', head: true })
                    .eq('vendor_id', vendorEntry.vendor.id)
                    .eq('company_id', scopeId);
            }

            if (caseCountQuery) {
                const { count } = await withTimeout(caseCountQuery, 5000, 'getVendorCaseCount');
                vendorEntry.caseCount = count || 0;
            } else {
                vendorEntry.caseCount = 0;
            }
        }

        return vendors;
    },

    // Sprint 6.8: Log Ingest Operation
    async logIngest(type, filename, recordsCount, scopeType, scopeId, userId, metadata = {}) {
        if (!type || !filename || recordsCount === undefined || !userId) {
            throw new ValidationError('logIngest requires type, filename, recordsCount, and userId', null, {
                type,
                filename,
                recordsCount,
                userId
            });
        }

        const validTypes = ['invoice', 'payment', 'remittance'];
        if (!validTypes.includes(type)) {
            throw new ValidationError(`Invalid ingest type. Must be one of: ${validTypes.join(', ')}`, null, { type });
        }

        const insertQuery = supabase
            .from('vmp_ingest_log')
            .insert({
                ingest_type: type,
                filename: filename,
                records_count: recordsCount,
                scope_type: scopeType || null,
                scope_id: scopeId || null,
                uploaded_by: userId,
                metadata: metadata
            })
            .select()
            .single();

        const { data, error } = await withTimeout(
            insertQuery,
            5000,
            'logIngest'
        );

        if (error) {
            const handledError = handleSupabaseError(error, 'logIngest');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to log ingest operation', error, { type, filename });
        }

        return data;
    },

    // Sprint 6.8: Get Ingest History
    async getIngestHistory(scopeType = null, scopeId = null, userId = null, limit = 100) {
        let query = supabase
            .from('vmp_ingest_log')
            .select(`
                *,
                vmp_vendor_users (id, email, display_name)
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (scopeType && scopeId) {
            query = query.eq('scope_type', scopeType).eq('scope_id', scopeId);
        }

        if (userId) {
            query = query.eq('uploaded_by', userId);
        }

        const { data, error } = await withTimeout(
            query,
            10000,
            'getIngestHistory'
        );

        if (error) {
            const handledError = handleSupabaseError(error, 'getIngestHistory');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to fetch ingest history', error);
        }

        return data || [];
    },

    // Sprint 7.1: Get Cases with SLA Approaching
    async getCasesWithSLAApproaching(thresholdHours = 24) {
        if (thresholdHours < 0) {
            throw new ValidationError('thresholdHours must be non-negative', null, { thresholdHours });
        }

        // Calculate threshold time
        const now = new Date();
        const thresholdTime = new Date(now.getTime() + (thresholdHours * 60 * 60 * 1000));

        const queryPromise = supabase
            .from('vmp_cases')
            .select(`
                id,
                subject,
                status,
                sla_due_at,
                case_type,
                escalation_level,
                vmp_companies (id, name),
                vmp_vendors (id, name)
            `)
            .not('sla_due_at', 'is', null)
            .lte('sla_due_at', thresholdTime.toISOString())
            .in('status', ['open', 'waiting_supplier', 'waiting_internal'])
            .order('sla_due_at', { ascending: true });

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `getCasesWithSLAApproaching(${thresholdHours}h)`
        );

        if (error) {
            const handledError = handleSupabaseError(error, 'getCasesWithSLAApproaching');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to fetch cases with approaching SLA', error);
        }

        // Calculate hours until due for each case
        const casesWithTimeRemaining = (data || []).map(caseItem => {
            const dueAt = new Date(caseItem.sla_due_at);
            const hoursRemaining = Math.round((dueAt.getTime() - now.getTime()) / (1000 * 60 * 60));
            return {
                ...caseItem,
                hours_remaining: hoursRemaining,
                is_overdue: hoursRemaining < 0
            };
        });

        return casesWithTimeRemaining;
    },

    // Sprint 7.2: Log Decision
    async logDecision(caseId, decisionType, who, what, why) {
        if (!caseId || !decisionType || !who || !what) {
            throw new ValidationError('logDecision requires caseId, decisionType, who, and what', null, {
                caseId,
                decisionType,
                who,
                what
            });
        }

        const validDecisionTypes = ['verify', 'reject', 'reassign', 'status_update', 'escalate', 'approve', 'close'];
        if (!validDecisionTypes.includes(decisionType)) {
            throw new ValidationError(`Invalid decisionType. Must be one of: ${validDecisionTypes.join(', ')}`, null, { decisionType });
        }

        const insertQuery = supabase
            .from('vmp_decision_log')
            .insert({
                case_id: caseId,
                decision_type: decisionType,
                who: who,
                what: what,
                why: why || null
            })
            .select()
            .single();

        const { data, error } = await withTimeout(
            insertQuery,
            5000,
            'logDecision'
        );

        if (error) {
            const handledError = handleSupabaseError(error, 'logDecision');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to log decision', error, { caseId, decisionType });
        }

        return data;
    },

    // Sprint 7.2: Get Decision Log
    async getDecisionLog(caseId) {
        if (!caseId) {
            throw new ValidationError('getDecisionLog requires caseId', null, { caseId });
        }

        const queryPromise = supabase
            .from('vmp_decision_log')
            .select('*')
            .eq('case_id', caseId)
            .order('created_at', { ascending: false });

        const { data, error } = await withTimeout(
            queryPromise,
            10000,
            `getDecisionLog(${caseId})`
        );

        if (error) {
            const handledError = handleSupabaseError(error, 'getDecisionLog');
            if (handledError) throw handledError;
            throw new DatabaseError('Failed to fetch decision log', error, { caseId });
        }

        return data || [];
    }
};


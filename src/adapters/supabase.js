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
    async createMessage(caseId, body, senderType = 'vendor', channelSource = 'portal', senderUserId = null, isInternalNote = false) {
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
    }
};


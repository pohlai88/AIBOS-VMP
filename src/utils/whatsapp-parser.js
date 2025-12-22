/**
 * WhatsApp Parser Utility (Sprint 9.2)
 * Parses WhatsApp Business API webhook payloads and extracts relevant information
 */

/**
 * Parse WhatsApp webhook payload (supports WhatsApp Business API format)
 * @param {Object} payload - WhatsApp webhook payload
 * @param {string} provider - WhatsApp provider ('whatsapp', 'twilio', 'generic')
 * @returns {Object} Parsed WhatsApp message data
 */
export function parseWhatsAppWebhook(payload, provider = 'whatsapp') {
    try {
        switch (provider.toLowerCase()) {
            case 'twilio':
                return parseTwilioWebhook(payload);
            case 'whatsapp':
            case 'meta':
            default:
                return parseWhatsAppBusinessWebhook(payload);
        }
    } catch (error) {
        console.error('Error parsing WhatsApp webhook:', error);
        throw new Error(`Failed to parse WhatsApp webhook: ${error.message}`);
    }
}

/**
 * Parse WhatsApp Business API (Meta) webhook format
 */
function parseWhatsAppBusinessWebhook(payload) {
    // WhatsApp Business API sends webhooks in this format:
    // { object: 'whatsapp_business_account', entry: [...] }
    
    if (!payload.entry || !Array.isArray(payload.entry) || payload.entry.length === 0) {
        throw new Error('Invalid WhatsApp Business API webhook format');
    }

    const entry = payload.entry[0];
    const changes = entry.changes || [];
    
    if (changes.length === 0) {
        throw new Error('No changes found in WhatsApp webhook');
    }

    const change = changes[0];
    const value = change.value || {};
    const messages = value.messages || [];
    const contacts = value.contacts || [];
    const statuses = value.statuses || [];

    // Process first message (if any)
    if (messages.length === 0) {
        // This might be a status update, not a message
        if (statuses.length > 0) {
            return parseStatusUpdate(statuses[0], value);
        }
        throw new Error('No messages found in WhatsApp webhook');
    }

    const message = messages[0];
    const contact = contacts.find(c => c.wa_id === message.from) || {};

    return {
        messageId: message.id,
        from: message.from || contact.wa_id || '',
        fromName: contact.profile?.name || '',
        to: value.metadata?.phone_number_id || '',
        timestamp: message.timestamp ? new Date(parseInt(message.timestamp) * 1000) : new Date(),
        messageType: message.type || 'text',
        text: message.text?.body || '',
        media: parseWhatsAppMedia(message),
        metadata: {
            phoneNumberId: value.metadata?.phone_number_id,
            displayPhoneNumber: value.metadata?.display_phone_number,
            provider: 'whatsapp'
        },
        provider: 'whatsapp'
    };
}

/**
 * Parse Twilio WhatsApp webhook format
 */
function parseTwilioWebhook(payload) {
    return {
        messageId: payload.MessageSid || payload.SmsSid || null,
        from: payload.From || payload.FromNumber || '',
        fromName: payload.ProfileName || '',
        to: payload.To || payload.ToNumber || '',
        timestamp: payload.Timestamp ? new Date(payload.Timestamp) : new Date(),
        messageType: payload.NumMedia && parseInt(payload.NumMedia) > 0 ? 'media' : 'text',
        text: payload.Body || payload.MessageBody || '',
        media: parseTwilioMedia(payload),
        metadata: {
            accountSid: payload.AccountSid,
            provider: 'twilio'
        },
        provider: 'twilio'
    };
}

/**
 * Parse WhatsApp media attachments
 */
function parseWhatsAppMedia(message) {
    const media = [];
    const messageType = message.type;

    if (messageType === 'image' && message.image) {
        media.push({
            type: 'image',
            mimeType: message.image.mime_type || 'image/jpeg',
            url: message.image.url || null,
            id: message.image.id || null,
            caption: message.image.caption || null,
            sha256: message.image.sha256 || null
        });
    } else if (messageType === 'document' && message.document) {
        media.push({
            type: 'document',
            mimeType: message.document.mime_type || 'application/pdf',
            url: message.document.url || null,
            id: message.document.id || null,
            filename: message.document.filename || 'document',
            caption: message.document.caption || null,
            sha256: message.document.sha256 || null
        });
    } else if (messageType === 'audio' && message.audio) {
        media.push({
            type: 'audio',
            mimeType: message.audio.mime_type || 'audio/ogg',
            url: message.audio.url || null,
            id: message.audio.id || null,
            sha256: message.audio.sha256 || null
        });
    } else if (messageType === 'video' && message.video) {
        media.push({
            type: 'video',
            mimeType: message.video.mime_type || 'video/mp4',
            url: message.video.url || null,
            id: message.video.id || null,
            caption: message.video.caption || null,
            sha256: message.video.sha256 || null
        });
    }

    return media;
}

/**
 * Parse Twilio media attachments
 */
function parseTwilioMedia(payload) {
    const media = [];
    const numMedia = parseInt(payload.NumMedia || '0', 10);

    for (let i = 0; i < numMedia; i++) {
        const mediaUrl = payload[`MediaUrl${i}`];
        const contentType = payload[`MediaContentType${i}`];

        if (mediaUrl) {
            media.push({
                type: contentType?.split('/')[0] || 'unknown',
                mimeType: contentType || 'application/octet-stream',
                url: mediaUrl,
                id: null,
                filename: payload[`MediaFileName${i}`] || `media-${i}`
            });
        }
    }

    return media;
}

/**
 * Parse status update (message delivery status)
 */
function parseStatusUpdate(status, value) {
    return {
        messageId: status.id,
        from: value.metadata?.phone_number_id || '',
        to: status.recipient_id || '',
        timestamp: status.timestamp ? new Date(parseInt(status.timestamp) * 1000) : new Date(),
        messageType: 'status',
        text: `Message status: ${status.status}`,
        status: status.status,
        media: [],
        metadata: {
            phoneNumberId: value.metadata?.phone_number_id,
            provider: 'whatsapp'
        },
        provider: 'whatsapp'
    };
}

/**
 * Extract case reference from WhatsApp message text
 * Looks for patterns like "Case #123", "Case-123", "RE: Case 123"
 */
export function extractCaseReferenceFromWhatsApp(whatsappData) {
    const text = whatsappData.text || '';
    
    // Pattern: Case #123, Case-123, Case 123, RE: Case 123
    const patterns = [
        /Case\s*#?\s*([A-Za-z0-9-]+)/i,
        /\[Case\s*([A-Za-z0-9-]+)\]/i,
        /case[_-]?([A-Za-z0-9-]+)/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    
    return null;
}

/**
 * Extract vendor identifier from WhatsApp phone number
 * Converts phone number to email format or looks up by phone
 */
export function extractVendorIdentifierFromWhatsApp(whatsappData) {
    const phoneNumber = whatsappData.from || '';
    
    // Remove WhatsApp country code prefix if present
    // WhatsApp numbers are typically in format: 1234567890@c.us or just the number
    const cleanNumber = phoneNumber.replace('@c.us', '').replace(/[^0-9]/g, '');
    
    // For now, return the phone number
    // In production, you might want to map phone numbers to vendor emails
    return cleanNumber || phoneNumber;
}


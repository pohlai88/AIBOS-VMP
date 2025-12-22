/**
 * Email Parser Utility (Sprint 9.1)
 * Parses email webhook payloads and extracts relevant information
 */

/**
 * Parse email webhook payload (supports multiple email service formats)
 * @param {Object} payload - Email webhook payload
 * @param {string} provider - Email provider ('sendgrid', 'mailgun', 'generic')
 * @returns {Object} Parsed email data
 */
export function parseEmailWebhook(payload, provider = 'generic') {
    try {
        switch (provider.toLowerCase()) {
            case 'sendgrid':
                return parseSendGridWebhook(payload);
            case 'mailgun':
                return parseMailgunWebhook(payload);
            case 'generic':
            default:
                return parseGenericWebhook(payload);
        }
    } catch (error) {
        console.error('Error parsing email webhook:', error);
        throw new Error(`Failed to parse email webhook: ${error.message}`);
    }
}

/**
 * Parse SendGrid webhook format
 */
function parseSendGridWebhook(payload) {
    // SendGrid sends an array of events
    const event = Array.isArray(payload) ? payload[0] : payload;
    
    return {
        from: event.from || event.email || '',
        to: event.to || event.recipient || '',
        subject: event.subject || '',
        text: event.text || event.plain || '',
        html: event.html || '',
        attachments: parseAttachments(event.attachments || []),
        headers: event.headers || {},
        messageId: event.sg_message_id || event.message_id || null,
        timestamp: event.timestamp ? new Date(event.timestamp * 1000) : new Date(),
        provider: 'sendgrid'
    };
}

/**
 * Parse Mailgun webhook format
 */
function parseMailgunWebhook(payload) {
    return {
        from: payload['sender'] || payload.from || '',
        to: payload['recipient'] || payload.to || '',
        subject: payload.subject || '',
        text: payload['body-plain'] || payload.text || '',
        html: payload['body-html'] || payload.html || '',
        attachments: parseMailgunAttachments(payload),
        headers: parseHeaders(payload['message-headers'] || []),
        messageId: payload['Message-Id'] || payload.message_id || null,
        timestamp: payload.timestamp ? new Date(payload.timestamp * 1000) : new Date(),
        provider: 'mailgun'
    };
}

/**
 * Parse generic webhook format (standard email fields)
 */
function parseGenericWebhook(payload) {
    return {
        from: payload.from || payload.sender || '',
        to: payload.to || payload.recipient || '',
        subject: payload.subject || '',
        text: payload.text || payload.body || payload.plain || '',
        html: payload.html || payload.body_html || '',
        attachments: parseAttachments(payload.attachments || []),
        headers: payload.headers || {},
        messageId: payload.messageId || payload.message_id || payload['Message-Id'] || null,
        timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
        provider: 'generic'
    };
}

/**
 * Parse attachments from various formats
 */
function parseAttachments(attachments) {
    if (!Array.isArray(attachments)) {
        return [];
    }
    
    return attachments.map(att => ({
        filename: att.filename || att.name || 'attachment',
        contentType: att.type || att.contentType || att['content-type'] || 'application/octet-stream',
        content: att.content || att.data || att.body || null,
        size: att.size || (att.content ? Buffer.from(att.content, 'base64').length : 0)
    }));
}

/**
 * Parse Mailgun attachments (stored as form data)
 */
function parseMailgunAttachments(payload) {
    const attachments = [];
    
    // Mailgun sends attachment count
    const count = parseInt(payload['attachment-count'] || '0', 10);
    
    for (let i = 1; i <= count; i++) {
        const attachment = payload[`attachment-${i}`];
        if (attachment) {
            attachments.push({
                filename: payload[`attachment-${i}-name`] || `attachment-${i}`,
                contentType: attachment.type || 'application/octet-stream',
                content: attachment.data || attachment.buffer || null,
                size: attachment.size || 0
            });
        }
    }
    
    return attachments;
}

/**
 * Parse email headers from array format
 */
function parseHeaders(headerArray) {
    if (!Array.isArray(headerArray)) {
        return {};
    }
    
    const headers = {};
    for (let i = 0; i < headerArray.length; i += 2) {
        if (headerArray[i] && headerArray[i + 1]) {
            headers[headerArray[i]] = headerArray[i + 1];
        }
    }
    
    return headers;
}

/**
 * Extract case reference from email subject or body
 * Looks for patterns like "Case #123", "Case-123", "RE: Case 123"
 */
export function extractCaseReference(emailData) {
    const subject = emailData.subject || '';
    const text = emailData.text || '';
    const combined = `${subject} ${text}`;
    
    // Pattern: Case #123, Case-123, Case 123, RE: Case 123
    const patterns = [
        /Case\s*#?\s*([A-Za-z0-9-]+)/i,
        /\[Case\s*([A-Za-z0-9-]+)\]/i,
        /case[_-]?([A-Za-z0-9-]+)/i
    ];
    
    for (const pattern of patterns) {
        const match = combined.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    
    return null;
}

/**
 * Extract vendor email domain or identifier
 */
export function extractVendorIdentifier(emailData) {
    const from = emailData.from || '';
    
    // Extract email address if in format "Name <email@domain.com>"
    const emailMatch = from.match(/<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/);
    if (emailMatch) {
        return emailMatch[1];
    }
    
    return from;
}


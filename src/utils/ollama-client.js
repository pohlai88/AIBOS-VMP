/**
 * Ollama Client Utility
 *
 * Provides a client interface for calling Ollama via Supabase Edge Functions.
 * This allows AI features to use Ollama instead of external APIs.
 */

/**
 * Call Ollama via Supabase Edge Functions
 * @param {string} action - Action to perform ('ollama-chat', 'ollama-embedding', 'ollama-classify')
 * @param {Object} data - Request data
 * @param {string} supabaseUrl - Supabase project URL
 * @param {string} anonKey - Supabase anon key
 * @returns {Promise<Object>} Response from Ollama
 */
export async function callOllamaViaEdgeFunction(action, data, supabaseUrl, anonKey) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/integrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        action,
        ...data,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Ollama Edge Function error: ${response.statusText}`, {
        cause: errorData,
      });
    }

    const result = await response.json();
    return result.data || result;
  } catch (error) {
    console.error('[Ollama Client] Error calling Edge Function:', error);
    throw error;
  }
}

/**
 * Chat with Ollama
 * @param {Array} messages - Chat messages array [{role: 'user', content: '...'}]
 * @param {string} model - Ollama model name (default: 'llama3')
 * @param {Object} options - Additional Ollama options
 * @param {string} supabaseUrl - Supabase project URL
 * @param {string} anonKey - Supabase anon key
 * @returns {Promise<Object>} Chat response
 */
export async function chatWithOllama(
  messages,
  model = 'llama3',
  options = {},
  supabaseUrl,
  anonKey
) {
  return callOllamaViaEdgeFunction(
    'ollama-chat',
    {
      messages,
      model,
      stream: false,
      options,
    },
    supabaseUrl,
    anonKey
  );
}

/**
 * Generate embedding with Ollama
 * @param {string} text - Text to embed
 * @param {string} model - Ollama embedding model (default: 'nomic-embed-text')
 * @param {string} supabaseUrl - Supabase project URL
 * @param {string} anonKey - Supabase anon key
 * @returns {Promise<Object>} Embedding response
 */
export async function embedWithOllama(text, model = 'nomic-embed-text', supabaseUrl, anonKey) {
  return callOllamaViaEdgeFunction(
    'ollama-embedding',
    {
      text,
      model,
    },
    supabaseUrl,
    anonKey
  );
}

/**
 * Classify text with Ollama
 * @param {string} text - Text to classify
 * @param {string} systemPrompt - System prompt for classification
 * @param {string} prompt - User prompt
 * @param {string} model - Ollama model (default: 'llama3')
 * @param {string} supabaseUrl - Supabase project URL
 * @param {string} anonKey - Supabase anon key
 * @returns {Promise<Object>} Classification response
 */
export async function classifyWithOllama(
  text,
  systemPrompt = null,
  prompt = null,
  model = 'llama3',
  supabaseUrl,
  anonKey
) {
  return callOllamaViaEdgeFunction(
    'ollama-classify',
    {
      text,
      systemPrompt,
      prompt,
      model,
    },
    supabaseUrl,
    anonKey
  );
}

/**
 * Call AI Chat Edge Function
 * @param {string} message - User message
 * @param {Object} context - Context object (caseId, vendorId, etc.)
 * @param {Array} history - Conversation history
 * @param {string} model - Ollama model (default: 'llama3')
 * @param {string} supabaseUrl - Supabase project URL
 * @param {string} anonKey - Supabase anon key
 * @returns {Promise<Object>} Chat response
 */
export async function callAIChat(
  message,
  context = {},
  history = [],
  model = 'llama3',
  supabaseUrl,
  anonKey
) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        action: 'chat',
        message,
        context,
        history,
        model,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`AI Chat Edge Function error: ${response.statusText}`, {
        cause: errorData,
      });
    }

    const result = await response.json();
    return result.data || result;
  } catch (error) {
    console.error('[Ollama Client] Error calling AI Chat:', error);
    throw error;
  }
}

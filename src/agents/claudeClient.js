import Anthropic from '@anthropic-ai/sdk'

/**
 * Initializes the Anthropic client if an API key is available.
 * Note: Running this in the browser is generally insecure and only for hackathon/demo purposes.
 */
let anthropic = null
try {
    // We'll read from Vite's import.meta.env for the key
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY

    if (apiKey) {
        anthropic = new Anthropic({
            apiKey,
            dangerouslyAllowBrowser: true, // Required to call from frontend
        })
    } else {
        console.warn('⚠️ No VITE_ANTHROPIC_API_KEY found. Agent calls will fall back to demo data.')
    }
} catch (error) {
    console.error('Failed to initialize Anthropic client:', error)
}

/**
 * Calls Claude with the given system prompt and user message.
 * Safely catches and logs errors without crashing the app.
 *
 * @param {string} systemPrompt 
 * @param {string} userMessage 
 * @param {string|null} imageBase64 
 * @param {string} model 
 * @returns {Promise<string|null>} The text response, or null if it failed.
 */
export async function callClaude(
    systemPrompt,
    userMessage,
    imageBase64 = null,
    model = 'claude-sonnet-4-6'
) {
    try {
        if (!anthropic) {
            throw new Error('Anthropic client is not initialized (missing API key).')
        }

        const content = []

        if (imageBase64) {
            const images = Array.isArray(imageBase64) ? imageBase64 : [imageBase64];
            images.forEach(img => {
                // Simple heuristic: if it starts with 'iVBORw0KGgo', it's likely a PNG. 
                // We'll default to jpeg for safety, but real implementation would check magic bytes or pass mime types.
                content.push({
                    type: 'image',
                    source: {
                        type: 'base64',
                        media_type: img.startsWith('iVBORw') ? 'image/png' : 'image/jpeg',
                        data: img,
                    },
                })
            })
        }

        content.push({
            type: 'text',
            text: userMessage,
        })

        const response = await anthropic.messages.create({
            model,
            max_tokens: 1024,
            system: systemPrompt,
            messages: [
                {
                    role: 'user',
                    content,
                },
            ],
        })

        return response.content[0].text
    } catch (error) {
        console.error('❌ Claude API Error:', error)
        // Return null so the orchestrator knows it failed and can fall back
        return null
    }
}

import { useState } from 'react'
import { callClaude } from '../agents/claudeClient'

export default function ApiTestPage() {
    const [response, setResponse] = useState('')
    const [loading, setLoading] = useState(false)

    const testApi = async () => {
        setLoading(true)
        setResponse('Connecting to Claude...')
        try {
            const res = await callClaude(
                'You are a helpful assistant testing API configuration.',
                'Say exactly: "Connection successful! Claude is online and ready analyze crop data."',
                null, // no image
                'claude-sonnet-4-6'
            )
            setResponse(res || 'Error: API returned null.')
        } catch (err) {
            setResponse(`Error: ${err.message}`)
        }
        setLoading(false)
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8" style={{ background: '#0a0e17' }}>
            <button
                id="test-btn"
                onClick={testApi}
                disabled={loading}
                className="px-6 py-3 rounded-xl bg-blue-600 font-bold text-white shadow-xl disabled:opacity-50"
            >
                {loading ? 'Testing...' : 'Test Anthropic API Connection'}
            </button>

            {response && (
                <div className="mt-4 p-4 rounded-lg bg-slate-900 text-green-400 border border-slate-700 max-w-md w-full">
                    <strong>Response:</strong>
                    <p id="response-text" className="mt-2 text-sm text-slate-300">{response}</p>
                </div>
            )}
        </div>
    )
}

/**
 * @module EmptyState
 * @description Production-quality empty-state placeholder for report sections.
 * Renders a dashed-border dark-mode container with a Lucide icon, primary
 * message, and optional secondary description. Used when backend data is
 * missing or an array field is empty.
 *
 * @param {Object}   props
 * @param {import('lucide-react').LucideIcon} props.icon - Lucide icon component to display.
 * @param {string}   props.message - Primary empty-state message.
 * @param {string}   [props.description] - Optional secondary description text.
 * @returns {JSX.Element}
 */
export default function EmptyState({ icon: Icon, message, description }) {
    return (
        <div
            className="flex flex-col items-center justify-center gap-3 py-10 px-6 rounded-xl"
            style={{
                border: '1.5px dashed rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.015)',
            }}
        >
            <div
                className="flex items-center justify-center rounded-full"
                style={{
                    width: 48,
                    height: 48,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                }}
            >
                <Icon size={20} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p
                style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    textAlign: 'center',
                }}
            >
                {message}
            </p>
            {description && (
                <p
                    style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        maxWidth: 280,
                    }}
                >
                    {description}
                </p>
            )}
        </div>
    )
}

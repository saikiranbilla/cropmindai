/**
 * @module SectionHeader
 * @description Reusable section header used across all report cards.
 * Renders a Lucide icon, uppercase label, horizontal rule, and optional
 * trailing metadata (e.g. counts).
 *
 * @param {Object}   props
 * @param {import('lucide-react').LucideIcon} props.icon - Lucide icon component.
 * @param {string}   props.title - Section title (rendered uppercase).
 * @param {string}   [props.meta] - Optional trailing text (e.g. "3 zones").
 * @param {React.ReactNode} [props.children] - Optional children rendered below the header.
 * @returns {JSX.Element}
 */
export default function SectionHeader({ icon: Icon, title, meta, children }) {
    return (
        <section className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-4 print:mb-2">
                <Icon size={13} className="shrink-0 text-zinc-500 print:text-zinc-700" />
                <h2
                    className="uppercase"
                    style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '10px',
                        fontWeight: 600,
                        letterSpacing: '0.12em',
                        color: 'var(--text-muted)',
                    }}
                >
                    {title}
                </h2>
                <div className="flex-1 h-px bg-zinc-800 print:bg-zinc-200" />
                {meta && (
                    <span
                        style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                        }}
                    >
                        {meta}
                    </span>
                )}
            </div>
            {children && <div className="flex-1">{children}</div>}
        </section>
    )
}

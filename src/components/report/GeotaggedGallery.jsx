import { Camera, ImageOff } from 'lucide-react'
import SectionHeader from './SectionHeader'
import EmptyState from './EmptyState'

// ─── Severity HUD Badge Styles ────────────────────────────────────────────────

/** @type {Record<string, { label: string, bg: string, border: string }>} */
const SEV_BADGE = {
    high: { label: 'STATUS: SEVERE DAMAGE', bg: 'rgba(239,68,68,0.88)', border: '#ef4444' },
    moderate: { label: 'STATUS: WATERLOGGED', bg: 'rgba(245,158,11,0.88)', border: '#f59e0b' },
    low: { label: 'STATUS: NOMINAL', bg: 'rgba(34,197,94,0.88)', border: '#22c55e' },
}

// ─── EXIF HUD Overlay ─────────────────────────────────────────────────────────

/**
 * GPS / severity heads-up display overlaid on each gallery image.
 *
 * @param {Object} props
 * @param {Object} props.img - Image metadata object.
 * @param {string|number} [props.img.lat] - Latitude.
 * @param {string|number} [props.img.lng] - Longitude.
 * @param {string}        [props.img.elev] - Elevation string.
 * @param {string}        [props.img.severity] - Severity level.
 * @param {string}        [props.img.time] - Capture time string.
 */
function ExifHud({ img }) {
    const badge = SEV_BADGE[img?.severity] ?? SEV_BADGE.low

    return (
        <div
            className="absolute bottom-0 left-0 right-0 px-3 py-2 print:hidden"
            style={{
                background: 'linear-gradient(to top,rgba(0,0,0,0.92) 0%,rgba(0,0,0,0.5) 60%,transparent 100%)',
            }}
        >
            <div
                className="inline-flex items-center gap-1.5 mb-1.5 px-2 py-0.5 rounded"
                style={{ background: badge.bg, border: `1px solid ${badge.border}` }}
            >
                {img?.severity === 'high' && (
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inset-0 rounded-full bg-red-400 opacity-75" />
                        <span className="relative rounded-full h-1.5 w-1.5 bg-red-500" />
                    </span>
                )}
                <span className="font-mono text-[8px] font-bold text-white tracking-widest">
                    [ {badge.label} ]
                </span>
            </div>
            <div className="font-mono text-[8px] leading-relaxed text-emerald-400">
                LAT: {img?.lat ?? '—'} | LNG: {img?.lng ?? '—'}<br />
                <span className="text-zinc-400">
                    GPS_ALT: {img?.elev ?? '—'} · {img?.time ?? '—'}
                </span>
            </div>
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * @module GeotaggedGallery
 * @description Displays geotagged field-evidence photographs with EXIF HUD
 * overlays showing GPS coordinates, elevation, severity, and capture time.
 * Maps strictly to `assessment.image_urls` or photo metadata from the backend.
 *
 * No hardcoded Unsplash or Wikimedia URLs — shows an elegant empty state
 * when no images are available.
 *
 * @param {Object}   props
 * @param {Object[]} props.images - Array of image objects with metadata.
 * @param {string}   props.images[].url - Image URL.
 * @param {string|number} [props.images[].lat] - Latitude.
 * @param {string|number} [props.images[].lng] - Longitude.
 * @param {string}   [props.images[].elev] - Elevation string.
 * @param {string}   [props.images[].severity] - Severity level ('high'|'moderate'|'low').
 * @param {string}   [props.images[].time] - Capture time display string.
 * @param {string}   [props.images[].caption] - Alt text / caption.
 * @returns {JSX.Element}
 */
export default function GeotaggedGallery({ images }) {
    const hasImages = Array.isArray(images) && images.length > 0

    return (
        <SectionHeader icon={Camera} title="Geotagged Field Evidence">
            {hasImages ? (
                <div className="grid grid-cols-2 gap-3">
                    {images.map((img, i) => (
                        <div
                            key={img?.url ?? i}
                            className="relative rounded-xl overflow-hidden print:rounded print:border print:border-gray-200"
                            style={{ aspectRatio: '4/3', background: '#0d1220' }}
                        >
                            <img
                                src={img?.url}
                                alt={img?.caption ?? `Field evidence ${i + 1}`}
                                className="w-full h-full object-cover print:opacity-80"
                            />
                            <ExifHud img={img} />
                            <div
                                className="absolute top-2 right-2 rounded px-1.5 py-0.5 print:hidden"
                                style={{
                                    background: 'rgba(0,0,0,0.75)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                }}
                            >
                                <span className="font-mono text-[8px] text-zinc-400">
                                    PT-{String(i + 1).padStart(3, '0')}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <EmptyState
                    icon={ImageOff}
                    message="No geotagged evidence available"
                    description="Field photographs with GPS metadata will appear here after scouting images are uploaded."
                />
            )}
        </SectionHeader>
    )
}

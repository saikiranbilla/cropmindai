import { CloudLightning, Satellite, CloudOff } from 'lucide-react'
import SectionHeader from './SectionHeader'
import EmptyState from './EmptyState'
import { formatPrecipMm, formatSoilMoisturePercent } from '../../utils/formatters'

/**
 * @module WeatherTelemetryCard
 * @description Handles the satellite/radar image display and precipitation
 * telemetry data. Maps strictly to `assessment.satellite_data`.
 *
 * @param {Object}  props
 * @param {Object|null|undefined} props.satellite - Satellite data object from backend.
 * @param {string}  [props.satellite.map_image] - URL of the radar/satellite image.
 * @param {number}  [props.satellite.total_precip_mm] - 7-day cumulative precipitation in mm.
 * @param {number}  [props.satellite.avg_soil_moisture_m3m3] - Average soil moisture (m³/m³).
 * @param {string}  [props.satellite.source] - Data source label (e.g. "open-meteo").
 * @param {Object}  [props.satellite.daily_precipitation] - Daily precipitation breakdown.
 * @param {Object}  props.weather - Weather event metadata.
 * @param {string}  [props.weather.event] - Weather event type (e.g. "Severe Convective Storm").
 * @param {string}  [props.weather.dateOfLoss] - Date of loss string.
 * @returns {JSX.Element}
 */
export default function WeatherTelemetryCard({ satellite, weather }) {
    const mapImage = satellite?.map_image ?? null
    const totalPrecip = satellite?.total_precip_mm ?? null
    const moisture = satellite?.avg_soil_moisture_m3m3 ?? null
    const source = satellite?.source ?? null
    const moisturePct = formatSoilMoisturePercent(moisture)

    return (
        <SectionHeader icon={CloudLightning} title="Weather Event">
            {/* Weather event info pill */}
            <div className="rounded-[8px] p-3 bg-[var(--bg-elevated)] print:bg-gray-50 print:rounded print:border print:border-gray-200">
                <p
                    className="font-medium print:text-zinc-900"
                    style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '13px',
                        color: 'var(--text-primary)',
                    }}
                >
                    {weather?.event ?? '—'}
                </p>
                <p
                    className="mt-1 print:text-zinc-600"
                    style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                    }}
                >
                    Date of Loss: {weather?.dateOfLoss ?? '—'}
                </p>
            </div>

            {/* Satellite / Radar image */}
            {mapImage ? (
                <div
                    className="mt-3 relative rounded-xl overflow-hidden h-44 print:h-32 print:rounded"
                    style={{ background: '#070d18' }}
                >
                    <img
                        src={mapImage}
                        alt="Satellite or NEXRAD Doppler radar"
                        className="w-full h-full object-cover print:opacity-60"
                    />
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none print:hidden" />

                    {/* Live badge */}
                    {source && (
                        <div
                            className="absolute top-2 left-2 flex items-center gap-1.5 rounded px-1.5 py-0.5 print:hidden"
                            style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.08)' }}
                        >
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                            </span>
                            <span className="font-mono text-[8px] text-emerald-400 tracking-widest">
                                SAT · {source.toUpperCase()}
                            </span>
                        </div>
                    )}

                    {/* Bottom stats strip */}
                    <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 flex items-end justify-between print:hidden">
                        <div>
                            <p className="font-mono text-[8px] text-zinc-400 tracking-wider mb-0.5">7-DAY PRECIP</p>
                            {totalPrecip != null ? (
                                <p className="font-mono font-bold leading-none text-emerald-400">
                                    <span className="text-3xl">{formatPrecipMm(totalPrecip)}</span>
                                    <span className="text-xs text-zinc-500 ml-1">mm</span>
                                </p>
                            ) : (
                                <p className="font-mono text-zinc-600 text-sm">—</p>
                            )}
                        </div>
                        {moisturePct != null && (
                            <div className="text-right">
                                <p className="font-mono text-[8px] text-zinc-400 tracking-wider mb-0.5">SOIL MOISTURE</p>
                                <p className="font-mono text-xl font-bold text-blue-400 leading-none">
                                    {moisturePct}<span className="text-xs text-zinc-500">%</span>
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="mt-3">
                    <EmptyState
                        icon={Satellite}
                        message="No satellite imagery available"
                        description="Radar and satellite telemetry will populate once the environmental agent processes weather data."
                    />
                </div>
            )}

            {/* Precipitation summary cards (only when data exists) */}
            {(totalPrecip != null || moisturePct != null) && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                    {totalPrecip != null && (
                        <div className="rounded-[8px] p-3 bg-[var(--bg-elevated)] print:bg-gray-50 print:rounded print:border print:border-gray-200">
                            <p className="font-mono text-[8px] uppercase tracking-widest text-zinc-500 print:text-zinc-600 mb-1">Cumulative</p>
                            <p className="font-mono font-bold leading-none text-blue-400 print:text-blue-800">
                                <span className="text-3xl">{formatPrecipMm(totalPrecip)}</span>
                                <span className="text-xs text-zinc-500 print:text-zinc-600 ml-1">mm</span>
                            </p>
                        </div>
                    )}
                    {moisturePct != null && (
                        <div className="rounded-[8px] p-3 bg-[var(--bg-elevated)] print:bg-gray-50 print:rounded print:border print:border-gray-200">
                            <p className="font-mono text-[8px] uppercase tracking-widest text-zinc-500 print:text-zinc-600 mb-1">Soil Moisture</p>
                            <p className="font-mono font-bold leading-none text-emerald-400 print:text-emerald-800">
                                <span className="text-3xl">{moisturePct}</span>
                                <span className="text-xs text-zinc-500 print:text-zinc-600 ml-1">%</span>
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Source attribution */}
            {source && (
                <p className="font-mono text-[8px] text-zinc-600 mt-2">↑ {source}</p>
            )}
        </SectionHeader>
    )
}

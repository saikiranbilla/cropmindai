import * as exifr from 'exifr'

const FALLBACK_COORDS = {
  latitude:    40.1105,
  longitude:   -88.2401,
  elevation_m: 213.0,
}

/**
 * Extract GPS + timestamp from an image File.
 * Always returns a complete object — missing fields fall back to
 * Champaign County defaults with gps_source = 'fallback'.
 *
 * @param {File} file
 * @returns {Promise<{
 *   latitude:    number,
 *   longitude:   number,
 *   elevation_m: number,
 *   capturedAt:  string|null,
 *   gps_source:  'exif'|'fallback'
 * }>}
 */
export async function extractExif(file) {
  try {
    const data = await exifr.parse(file, {
      gps:  true,
      tiff: true,
      exif: true,
      pick: ['latitude', 'longitude', 'DateTimeOriginal', 'GPSLatitude', 'GPSLongitude', 'GPSAltitude'],
    })

    const latitude  = data?.latitude  ?? null
    const longitude = data?.longitude ?? null
    const hasGps    = latitude !== null && longitude !== null

    return {
      latitude:    hasGps ? latitude  : FALLBACK_COORDS.latitude,
      longitude:   hasGps ? longitude : FALLBACK_COORDS.longitude,
      elevation_m: data?.GPSAltitude  ?? FALLBACK_COORDS.elevation_m,
      capturedAt:  data?.DateTimeOriginal
                     ? new Date(data.DateTimeOriginal).toISOString()
                     : null,
      gps_source: hasGps ? 'exif' : 'fallback',
    }
  } catch {
    return {
      ...FALLBACK_COORDS,
      capturedAt: null,
      gps_source: 'fallback',
    }
  }
}

/**
 * Convert an array of File objects into scouting point descriptors
 * ready for the backend and the local UI.
 *
 * @param {File[]} files
 * @returns {Promise<Array>}
 */
export async function filesToScoutingPoints(files) {
  return Promise.all(
    files.map(async (file, i) => {
      const { latitude, longitude, elevation_m, capturedAt, gps_source } = await extractExif(file)
      return {
        id:           Date.now() + i,
        lat:          latitude,
        lng:          longitude,
        elevation_m,
        gps_source,
        severity:     'moderate',
        zone:         'A',
        damageType:   'Unknown',
        thumbnailUrl: URL.createObjectURL(file),
        capturedAt:   capturedAt ?? new Date().toISOString(),
        _file:        file,
      }
    })
  )
}

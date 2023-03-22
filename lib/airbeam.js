import { dateFromUnix } from '@robireton/chrono'
import { getAirBeamTemporalRange, getAirBeamSummary, getAirBeamData } from './datastore.js'

export function formatCSV (data) {
  const columns = ['timestamp', 'ISO 8601', 'latitude', 'longitude', 'Particulate Matter (µg/m³)', 'Temperature (°F)', 'Sound Level (decibels)', 'Humidity (%)']
  const lines = [columns.map(α => `"${α}"`).join(',')]
  for (const d of data) {
    lines.push([
      d.timestamp,
      dateFromUnix(d.timestamp).toISOString(),
      d.latitude.toFixed(4),
      d.longitude.toFixed(4),
      d.pm,
      d.temperature,
      d.soundlevel,
      d.humidity
    ])
  }
  lines.push('')
  return lines.join('\n')
}

export function formatGeoJSON (data) {
  return {
    type: 'FeatureCollection',
    features: data.map(d => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [d.longitude, d.latitude]
      },
      properties: {
        datetime: dateFromUnix(d.timestamp).toLocaleString(),
        timestamp: d.timestamp,
        pm: d.pm,
        temperature: d.temperature,
        soundlevel: d.soundlevel,
        humidity: d.humidity
      }
    }))
  }
}

export async function getTemporalRange () {
  return await getAirBeamTemporalRange()
}

export async function getSummary (min, max) {
  return await getAirBeamSummary(min, max)
}

export async function getData (min, max) {
  return await getAirBeamData(min, max)
}

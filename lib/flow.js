import { dateFromUnix } from '@robireton/chrono'
import { getFlowTemporalRange, getFlowSummary, getFlowData } from './datastore.js'

function aqiName (aqi) {
  if (aqi <= 20) return 'Low'
  if (aqi <= 50) return 'Moderate'
  if (aqi <= 100) return 'High'
  if (aqi <= 150) return 'Very High'
  if (aqi <= 200) return 'Excessive'
  if (aqi <= 250) return 'Extreme'
  return 'Airpocalypse'
}

export function formatCSV (data) {
  const columns = ['timestamp', 'ISO 8601', 'latitude', 'longitude', 'NO₂ (ppb)', 'VOC (ppb)', 'pm 10 (µg/m³)', 'pm 2.5 (µg/m³)', 'pm 1 (µg/m³)']
  const lines = [columns.map(α => `"${α}"`).join(',')]
  for (const d of data) {
    lines.push([
      d.timestamp,
      dateFromUnix(d.timestamp).toISOString(),
      d.latitude.toFixed(4),
      d.longitude.toFixed(4),
      d.no2,
      d.voc,
      d.pm10,
      d.pm25,
      d.pm1
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
        no2: d.no2,
        voc: d.voc,
        pm10: d.pm10,
        pm25: d.pm25,
        pm1: d.pm1,
        aqi: Number.isInteger(d.aqi) ? aqiName(d.aqi) : null
      }
    }))
  }
}

export async function getTemporalRange () {
  return await getFlowTemporalRange()
}

export async function getSummary (min, max) {
  return await getFlowSummary(min, max)
}

export async function getData (min, max) {
  return await getFlowData(min, max)
}

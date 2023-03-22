import { dateFromUnix } from '@robireton/chrono'
import { getXRFTemporalRange, getXRFSummary, getXRFData } from './datastore.js'

export function formatCSV (data) {
  let elements
  const columns = ['timestamp', 'ISO 8601', 'latitude', 'longitude']
  const lines = []
  for (const d of data) {
    if (elements === undefined) {
      elements = Object.keys(d.elements)
      for (const e of elements) {
        columns.push(`${e} concentration`)
        columns.push(`${e} error1s`)
      }
    }
    const line = [
      d.timestamp,
      dateFromUnix(d.timestamp).toISOString(),
      d.latitude.toFixed(4),
      d.longitude.toFixed(4)
    ]
    for (const e of elements) {
      line.push(d.elements[e].concentration)
      line.push(d.elements[e].error1s)
    }
    lines.push(line.join(','))
  }
  lines.push('')
  lines.unshift(columns.map(α => `"${α}"`).join(','))
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
      properties: Object.fromEntries([
        ['datetime', dateFromUnix(d.timestamp).toLocaleString()],
        ['timestamp', d.timestamp],
        ...Object.entries(d.elements).filter(([_, b]) => Number.isInteger(b.concentration)).map(([a, b]) => [a, b.concentration])
      ])
    }))
  }
}

export async function getTemporalRange () {
  return await getXRFTemporalRange()
}

export async function getSummary (min, max) {
  return await getXRFSummary(min, max)
}

export async function getData (min, max) {
  return await getXRFData(min, max)
}

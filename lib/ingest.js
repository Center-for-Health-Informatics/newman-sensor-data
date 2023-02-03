import Zip from 'adm-zip'
import { setMeasurement } from './datastore.js'

function interpolate (x, x0, x1, y0, y1) {
  return y0 + (x - x0) * ((y1 - y0) / (x1 - x0))
}

class PositionMap {
  constructor () {
    this.map = new Map()
  }

  set (timestamp, latitude, longitude) {
    this.map.set(timestamp, {
      latitude: Number.parseFloat(latitude.toFixed(4)),
      longitude: Number.parseFloat(longitude.toFixed(4))
    })
  }

  get (timestamp) {
    if (this.map.has(timestamp)) {
      return this.map.get(timestamp)
    } else {
      const timestamps = Array.from(this.map.keys()).sort()
      const tMin = timestamps[0]
      if (timestamp < tMin) return this.map.get(tMin)
      const tMax = timestamps[timestamps.length - 1]
      if (timestamp > tMax) return this.map.get(tMax)
      const t0 = timestamps.filter(t => t < timestamp).pop()
      const t1 = timestamps.filter(t => t > timestamp).shift()
      const p0 = this.map.get(t0)
      const p1 = this.map.get(t1)
      return {
        latitude: Number.parseFloat(interpolate(timestamp, t0, t1, p0.latitude, p1.latitude).toFixed(4)),
        longitude: Number.parseFloat(interpolate(timestamp, t0, t1, p0.longitude, p1.longitude).toFixed(4))
      }
    }
  }
}

export default function ingest (pathname) {
  const archive = new Zip(pathname)
  const Positions = new PositionMap()
  const positionsPattern = /^user_positions.*[.]csv$/
  const measuresPattern = /^user_measures.*[.]csv$/

  for (const entry of archive.getEntries()) {
    if (!positionsPattern.test(entry.name)) continue
    const lines = archive.readAsText(entry).split(/[\r\n]+/)
    const header = lines.shift().split(',')
    const columns = new Map(Object.entries(header).map(pair => pair.reverse()))
    for (const line of lines) {
      const fields = line.split(',')
      if (fields.length !== header.length) continue
      Positions.set(Number.parseInt(fields[columns.get('timestamp')]), Number.parseFloat(fields[columns.get('latitude')]), Number.parseFloat(fields[columns.get('longitude')]))
    }
  }

  for (const entry of archive.getEntries()) {
    if (!measuresPattern.test(entry.name)) continue
    const lines = archive.readAsText(entry).split(/[\r\n]+/)
    const header = lines.shift().split(/"?,"?/)
    const columns = new Map(Object.entries(header).map(pair => pair.reverse()))
    console.log(`ingesting ${entry.name} with ${lines.length} entries`)
    for (const line of lines) {
      const fields = line.split(',')
      if (fields.length !== header.length) continue
      const timestamp = Number.parseInt(fields[columns.get('timestamp')])
      const position = Positions.get(timestamp)
      setMeasurement(
        timestamp,
        position.latitude,
        position.longitude,
        Math.round(Number.parseFloat(fields[columns.get('NO2 (ppb)')])),
        Math.round(Number.parseFloat(fields[columns.get('VOC (ppb)')])),
        Math.round(Number.parseFloat(fields[columns.get('pm 10 (ug/m3)')])),
        Math.round(Number.parseFloat(fields[columns.get('pm 2.5 (ug/m3)')])),
        Math.round(Number.parseFloat(fields[columns.get('pm 1 (ug/m3)')]))
      )
    }
  }
}

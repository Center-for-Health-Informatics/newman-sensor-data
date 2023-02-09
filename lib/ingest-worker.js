import { parentPort } from 'node:worker_threads'

function interpolate (x, x0, x1, y0, y1) {
  return y0 + (x - x0) * ((y1 - y0) / (x1 - x0))
}

function fixed (n, m = 4) {
  return Number.parseFloat(n.toFixed(m))
}

class PositionMap {
  constructor (items) {
    this.map = new Map(items.map(item => [item.timestamp, { latitude: fixed(item.latitude), longitude: fixed(item.longitude) }]))
    this.timestamps = Array.from(this.map.keys()).sort()
    this.tMin = this.timestamps[0]
    this.tMax = this.timestamps[this.timestamps.length - 1]
  }

  set (timestamp, position) {
    this.map.set(timestamp, {
      latitude: fixed(position.latitude),
      longitude: fixed(position.longitude)
    })
    this.timestamps = Array.from(this.map.keys()).sort()
    this.tMin = this.timestamps[0]
    this.tMax = this.timestamps[this.timestamps.length - 1]
  }

  get (timestamp) {
    if (this.map.has(timestamp)) {
      return this.map.get(timestamp)
    } else {
      if (timestamp < this.tMin) return this.map.get(this.tMin)
      if (timestamp > this.tMax) return this.map.get(this.tMax)
      const t0 = this.timestamps.filter(t => t < timestamp).pop()
      const t1 = this.timestamps.filter(t => t > timestamp).shift()
      const p0 = this.map.get(t0)
      const p1 = this.map.get(t1)
      if (p0.latitude === p1.latitude && p0.longitude === p1.longitude) return p0
      return {
        latitude: fixed(interpolate(timestamp, t0, t1, p0.latitude, p1.latitude)),
        longitude: fixed(interpolate(timestamp, t0, t1, p0.longitude, p1.longitude))
      }
    }
  }

  get length () {
    return this.map.size
  }
}

parentPort.on('message', data => {
  const n = 1024
  const Positions = new PositionMap(data.spatial)
  let results = []
  for (const measure of data.measures) {
    const position = Positions.get(measure.timestamp)
    results.push({
      timestamp: measure.timestamp,
      latitude: position.latitude,
      longitude: position.longitude,
      no2: Math.round(measure.no2),
      voc: Math.round(measure.voc),
      pm10: Math.round(measure.pm10),
      pm25: Math.round(measure.pm25),
      pm1: Math.round(measure.pm1)
    })
    if (results.length >= n) {
      parentPort.postMessage({ // return a chunck of n results
        id: data.id,
        complete: false,
        results
      })
      results = []
    }
  }
  parentPort.postMessage({ // return any remaining results
    id: data.id,
    complete: true,
    results
  })
})

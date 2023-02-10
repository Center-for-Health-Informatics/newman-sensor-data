export class PositionMap {
  #map
  #timestamps = []
  #tMin = NaN
  #tMax = NaN

  static #interpolate (x, x0, x1, y0, y1) {
    return y0 + (x - x0) * ((y1 - y0) / (x1 - x0))
  }

  static #fixed (n, m = 4) {
    return Number.parseFloat(n.toFixed(m))
  }

  constructor (items) {
    this.#map = new Map(items.map(item => [item.timestamp, { latitude: PositionMap.#fixed(item.latitude), longitude: PositionMap.#fixed(item.longitude) }]))
    this.#timestamps = Array.from(this.#map.keys()).sort()
    this.#tMin = this.#timestamps[0]
    this.#tMax = this.#timestamps[this.#timestamps.length - 1]
  }

  set (timestamp, position) {
    this.#map.set(timestamp, {
      latitude: PositionMap.#fixed(position.latitude),
      longitude: PositionMap.#fixed(position.longitude)
    })
    this.#timestamps = Array.from(this.#map.keys()).sort()
    this.#tMin = this.#timestamps[0]
    this.#tMax = this.#timestamps[this.#timestamps.length - 1]
  }

  get (timestamp) {
    if (this.#map.has(timestamp)) {
      return this.#map.get(timestamp)
    } else {
      if (timestamp < this.#tMin) return this.#map.get(this.#tMin)
      if (timestamp > this.#tMax) return this.#map.get(this.#tMax)
      const t0 = this.#timestamps.filter(t => t < timestamp).pop()
      const t1 = this.#timestamps.filter(t => t > timestamp).shift()
      const p0 = this.#map.get(t0)
      const p1 = this.#map.get(t1)
      if (p0.latitude === p1.latitude && p0.longitude === p1.longitude) return p0
      return {
        latitude: PositionMap.#fixed(PositionMap.#interpolate(timestamp, t0, t1, p0.latitude, p1.latitude)),
        longitude: PositionMap.#fixed(PositionMap.#interpolate(timestamp, t0, t1, p0.longitude, p1.longitude))
      }
    }
  }

  get length () {
    return this.#map.size
  }
}
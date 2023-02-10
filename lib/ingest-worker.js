import { exit } from 'node:process'
import { parentPort } from 'node:worker_threads'
import { PositionMap } from './position-map.js'

parentPort.on('message', data => {
  if (!('id' in data)) exit()
  if (!('spatial' in data)) exit()
  if (!('measures' in data)) exit()
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

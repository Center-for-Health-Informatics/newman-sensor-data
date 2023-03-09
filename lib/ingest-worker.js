import { exit } from 'node:process'
import { parentPort } from 'node:worker_threads'
import { PositionMap } from './position-map.js'

function ms2s (ms) {
  return Math.round(ms / 1000)
}

function coord (n) {
  return Math.round(n * 10000) / 10000
}

parentPort.on('message', async data => {
  const n = 256
  if (!('id' in data)) exit()
  if ('flow' in data) {
    const Positions = new PositionMap(data.flow.spatial)
    let results = []
    for (const measure of data.flow.measures) {
      const position = await Positions.get(measure.timestamp)
      results.push({
        timestamp: measure.timestamp,
        latitude: coord(position.latitude),
        longitude: coord(position.longitude),
        no2: measure.no2,
        voc: measure.voc,
        pm10: Math.round(measure.pm10),
        pm25: Math.round(measure.pm25),
        pm1: measure.pm1,
        aqi: measure.aqi
      })
      if (results.length >= n) {
        parentPort.postMessage({ // return a chunck of n results
          type: 'flow',
          id: data.id,
          complete: false,
          results
        })
        results = []
      }
    }
    parentPort.postMessage({ // return any remaining results
      type: 'flow',
      id: data.id,
      complete: true,
      results
    })
  } else if ('airbeam' in data) {
    let results = []
    for (const reading of data.airbeam) {
      results.push({
        sensor: reading.sensor,
        timestamp: ms2s(reading.timestamp),
        latitude: coord(reading.latitude),
        longitude: coord(reading.longitude),
        value: Math.round(reading.value)
      })
      if (results.length >= n) {
        parentPort.postMessage({ // return a chunck of n results
          type: 'airbeam',
          id: data.id,
          complete: false,
          results
        })
        results = []
      }
    }
    parentPort.postMessage({ // return any remaining results
      type: 'airbeam',
      id: data.id,
      complete: true,
      results
    })
  } else if ('xrf' in data) {
    let results = []
    for (const d of data.xrf) {
      results.push({
        meta: {
          instrument: d.meta.instrument,
          reading: Number.parseInt(d.meta.reading),
          timestamp: Math.round((new Date(...d.meta.date.split('-').map((x, i) => Number.parseInt(x) - (i === 1 ? 1 : 0)), ...d.meta.time.split(':').map(x => Number.parseInt(x)))).valueOf() / 1000),
          latitude: coord(Number.parseFloat(d.meta.latitude)),
          longitude: coord(Number.parseFloat(d.meta.longitude)),
          method: d.meta.method === '' ? null : d.meta.method,
          factor: d.meta.factor === '' ? null : d.meta.factor,
          label: d.meta.label === '' ? null : d.meta.label,
          collimation: d.meta.collimation === '' ? null : d.meta.collimation,
          units: d.meta.units === '' ? null : d.meta.units,
          info: d.meta.info === '' ? null : d.meta.info
        },
        measurements: d.measurements
      })
      if (results.length >= n) {
        parentPort.postMessage({ // return a chunck of n results
          type: 'xrf',
          id: data.id,
          complete: false,
          results
        })
        results = []
      }
    }
    parentPort.postMessage({ // return any remaining results
      type: 'xrf',
      id: data.id,
      complete: true,
      results
    })
  } else {
    exit()
  }
})

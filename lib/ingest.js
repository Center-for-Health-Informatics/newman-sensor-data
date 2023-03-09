import process from 'node:process'
import { Worker } from 'node:worker_threads'
import Zip from 'adm-zip'
import { v4 as uuid } from 'uuid'
import { setFlowData, getAirBeamSensorID, setAirBeamData, setXRFData } from './datastore.js'

const Progress = new Map()

const worker = new Worker('./lib/ingest-worker.js')

const csv = /\s*,\s*/
const newline = /\s*[\r\n]+\s*/

worker.on('message', async data => {
  switch (data.type) {
    case 'flow':
      data.results.forEach(async a => await setFlowData(a.timestamp, a.latitude, a.longitude, a.no2, a.voc, a.pm10, a.pm25, a.pm1, a.aqi))
      break

    case 'airbeam':
      data.results.forEach(async a => await setAirBeamData(a))
      break

    case 'xrf':
      data.results.forEach(async a => await setXRFData(a))
      break
  }
  const p = Progress.get(data.id)
  p.value += data.results.length
  p.complete = data.complete
  if (data.complete && process.env.NODE_ENV !== 'production') console.log(`ingest took ${((Date.now() - p.start) / 1000).toFixed(3)} seconds`)
})

worker.on('error', err => console.error(`worker error: ${err.message}`))

for (const signal of ['SIGUSR2', 'SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    worker.postMessage({}) // asks worker to exit
  })
}

export function progress (id) {
  return Progress.get(id)
}

export function ingestFlow (source) {
  return new Promise((resolve, reject) => {
    try {
      const start = Date.now()
      const archive = new Zip(source)
      const positionsPattern = /^user_positions.*[.]csv$/
      const measuresPattern = /^user_measures.*[.]csv$/
      const aqiColumns = ['NO2 (Plume AQI)', 'VOC (Plume AQI)', 'pm 10 (Plume AQI)', 'pm 2.5 (Plume AQI)', 'pm 1 (Plume AQI)']
      const spatial = []
      for (const entry of archive.getEntries()) {
        if (!positionsPattern.test(entry.name)) continue
        const lines = archive.readAsText(entry).split(newline)
        const header = lines.shift().split(csv)
        const columns = new Map(Object.entries(header).map(pair => pair.reverse()))
        for (const line of lines) {
          const fields = line.split(csv)
          if (fields.length !== header.length) continue
          spatial.push({
            timestamp: Number.parseInt(fields[columns.get('timestamp')]),
            latitude: Number.parseFloat(fields[columns.get('latitude')]),
            longitude: Number.parseFloat(fields[columns.get('longitude')])
          })
        }
      }

      const measures = []
      for (const entry of archive.getEntries()) {
        if (!measuresPattern.test(entry.name)) continue
        const lines = archive.readAsText(entry).split(newline)
        const header = lines.shift().replaceAll('"', '').split(csv)
        const columns = new Map(Object.entries(header).map(pair => pair.reverse()))
        for (const line of lines) {
          const fields = line.split(csv)
          if (fields.length !== header.length) continue
          const measure = {
            timestamp: fields[columns.get('timestamp')],
            no2: Number.parseInt(fields[columns.get('NO2 (ppb)')]),
            voc: Number.parseInt(fields[columns.get('VOC (ppb)')]),
            pm10: Number.parseFloat(fields[columns.get('pm 10 (ug/m3)')]),
            pm25: Number.parseFloat(fields[columns.get('pm 2.5 (ug/m3)')]),
            pm1: Number.parseInt(fields[columns.get('pm 1 (ug/m3)')]),
            aqi: null
          }
          if (columns.has('Plume AQI')) {
            measure.aqi = Number.parseInt(fields[columns.get('Plume AQI')])
          } else if (aqiColumns.every(key => columns.has(key))) {
            measure.aqi = Math.max(...aqiColumns.map(key => Number.parseInt(fields[columns.get(key)])))
          }
          measures.push(measure)
        }
      }

      const id = uuid()
      Progress.set(id, { start, complete: false, max: measures.length, value: 0 })
      worker.postMessage({ id, flow: { spatial, measures } })
      resolve(id)
    } catch (err) {
      console.error(err)
      reject(err)
    }
  })
}

function sensorMeta (values) {
  return Object.fromEntries(['model', 'package', 'capability', 'units'].map((e, i) => [e, values[i]]))
}

export async function ingestAirBeam (data) {
  const sectionHeader = 'sensor:model,sensor:package,sensor:capability,sensor:units'
  let sensorID = null
  let columns = null
  const lines = data.split(newline)
  const measurements = []
  while (lines.length > 0) {
    const line = lines.shift()
    if (line === sectionHeader) {
      sensorID = await getAirBeamSensorID(sensorMeta(lines.shift().split(csv)))
      columns = new Map(Object.entries(lines.shift().split(csv)).map(pair => pair.reverse()))
      continue
    }
    const fields = line.split(csv)
    if (sensorID && fields.length === columns.size) {
      measurements.push({
        sensor: sensorID,
        timestamp: Date.parse(fields[columns.get('Timestamp')]),
        latitude: Number.parseFloat(fields[columns.get('geo:lat')]),
        longitude: Number.parseFloat(fields[columns.get('geo:long')]),
        value: Number.parseFloat(fields[columns.get('Value')])
      })
    }
  }
  return new Promise((resolve, reject) => {
    try {
      const id = uuid()
      Progress.set(id, { start: Date.now(), complete: false, max: measurements.length, value: 0 })
      worker.postMessage({ id, airbeam: measurements })
      resolve(id)
    } catch (err) {
      console.error(err)
      reject(err)
    }
  })
}

export function ingestXRF (data) {
  return new Promise((resolve, reject) => {
    const measurement = /^(?<element>[a-z]{1,2}) (?<key>Compound|Compound Level|Compound Error|Concentration|Error1s)$/i
    try {
      const lines = data.split(newline)
      lines.shift() // skip the sep=, line
      const dataFieldNames = lines.shift().split(csv).filter(name => name.length > 0)
      const columns = new Map(Object.entries(dataFieldNames).map(pair => pair.reverse()))
      const results = []
      for (const line of lines) {
        const fields = line.split(csv)
        if (fields.length > 1) {
          const meta = {
            instrument: fields[columns.get('Instrument Serial Num')],
            reading: fields[columns.get('Reading #')],
            date: fields[columns.get('Date')],
            time: fields[columns.get('Time')],
            latitude: fields[columns.get('Latitude')],
            longitude: fields[columns.get('Longitude')],
            method: fields[columns.get('Method Name')],
            factor: fields[columns.get('User Factor Name')],
            label: fields[columns.get('Test Label')],
            collimation: fields[columns.get('Collimation Status')],
            units: fields[columns.get('Units')],
            info: fields[columns.get('info')]
          }
          const measurements = new Map()
          for (const [f, p] of columns.entries()) {
            const value = Number.parseInt(fields[p])
            if (Number.isNaN(value)) continue
            const match = f.match(measurement)
            if (match) {
              if (!measurements.has(match.groups.element)) {
                measurements.set(match.groups.element, {})
              }
              measurements.get(match.groups.element)[match.groups.key] = value
            }
          }
          results.push({
            meta,
            measurements: Object.fromEntries(measurements)
          })
        }
      }
      const id = uuid()
      Progress.set(id, { start: Date.now(), complete: false, max: results.length, value: 0 })
      worker.postMessage({ id, xrf: results })
      resolve(id)
    } catch (err) {
      console.error(err)
      reject(err)
    }
  })
}

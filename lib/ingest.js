import { Worker } from 'node:worker_threads'
import Zip from 'adm-zip'
import { v4 as uuid } from 'uuid'
import { setMeasurement } from './datastore.js'

const worker = new Worker('./lib/ingest-worker.js')
const Progress = new Map()

worker.on('message', data => {
  data.results.forEach(a => setMeasurement(a.timestamp, a.latitude, a.longitude, a.no2, a.voc, a.pm10, a.pm25, a.pm1))
  const p = Progress.get(data.id)
  p.complete = data.complete
  p.value += data.results.length
})

export function progress (id) {
  return Progress.get(id)
}

export function ingest (source) {
  return new Promise((resolve, reject) => {
    try {
      const archive = new Zip(source)
      const positionsPattern = /^user_positions.*[.]csv$/
      const measuresPattern = /^user_measures.*[.]csv$/

      const spatial = []
      for (const entry of archive.getEntries()) {
        if (!positionsPattern.test(entry.name)) continue
        const lines = archive.readAsText(entry).split(/[\r\n]+/)
        const header = lines.shift().split(',')
        const columns = new Map(Object.entries(header).map(pair => pair.reverse()))
        for (const line of lines) {
          const fields = line.split(',')
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
        const lines = archive.readAsText(entry).split(/[\r\n]+/)
        const header = lines.shift().split(/"?,"?/)
        const columns = new Map(Object.entries(header).map(pair => pair.reverse()))
        for (const line of lines) {
          const fields = line.split(',')
          if (fields.length !== header.length) continue
          measures.push({
            timestamp: Number.parseInt(fields[columns.get('timestamp')]),
            no2: Number.parseFloat(fields[columns.get('NO2 (ppb)')]),
            voc: Number.parseFloat(fields[columns.get('VOC (ppb)')]),
            pm10: Number.parseFloat(fields[columns.get('pm 10 (ug/m3)')]),
            pm25: Number.parseFloat(fields[columns.get('pm 2.5 (ug/m3)')]),
            pm1: Number.parseFloat(fields[columns.get('pm 1 (ug/m3)')])
          })
        }
      }

      const id = uuid()
      Progress.set(id, {
        complete: false,
        max: measures.length,
        value: 0
      })
      worker.postMessage({
        id,
        spatial,
        measures
      })
      resolve(id)
    } catch (err) {
      reject(err)
    }
  })
}

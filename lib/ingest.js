import { Worker } from 'node:worker_threads'
import Zip from 'adm-zip'
import { setMeasurement } from './datastore.js'

const worker = new Worker('./lib/ingest-worker.js')

worker.on('message', data => {
  console.log(`${(new Date()).toISOString()}\tsaving ${data.length} measurements`)
  data.forEach(a => setMeasurement(a.timestamp, a.latitude, a.longitude, a.no2, a.voc, a.pm10, a.pm25, a.pm1))
  console.log(`${(new Date()).toISOString()}\tdone`)
})

export default function ingest (source) {
  const archive = new Zip(source)
  const positionsPattern = /^user_positions.*[.]csv$/
  const measuresPattern = /^user_measures.*[.]csv$/

  const spatial = []
  console.log(`${(new Date()).toISOString()}\tparsing positions`)
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
  console.log(`${(new Date()).toISOString()}\tgot positions for ${spatial.length} timestamps`)

  const measures = []
  console.log(`${(new Date()).toISOString()}\tparsing measures`)
  for (const entry of archive.getEntries()) {
    if (!measuresPattern.test(entry.name)) continue
    const lines = archive.readAsText(entry).split(/[\r\n]+/)
    const header = lines.shift().split(/"?,"?/)
    const columns = new Map(Object.entries(header).map(pair => pair.reverse()))
    console.log(`${(new Date()).toISOString()}\tingesting ${entry.name} with ${lines.length} entries`)
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
  console.log(`${(new Date()).toISOString()}\tgot measures for ${measures.length} timestamps`)

  worker.postMessage({
    spatial,
    measures
  })
  console.log(`${(new Date()).toISOString()}\tingest “done”`)
}

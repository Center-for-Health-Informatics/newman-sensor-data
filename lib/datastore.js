import { Worker } from 'node:worker_threads'
import { unixTime } from '@robireton/chrono'
import { v4 as uuid } from 'uuid'

const Jobs = new Map()

const worker = new Worker('./lib/data-worker.js')

worker.on('message', message => {
  const job = Jobs.get(message.id)
  if (Jobs.has(message.id)) {
    job.resolve(message.result)
    Jobs.delete(message.id)
  } else {
    console.error(`unknown job ${message.id}`)
  }
})

worker.on('error', err => console.error(`worker error: ${err.message}`))

for (const signal of ['SIGUSR2', 'SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    worker.postMessage({}) // asks worker to exit
  })
}

export function setMeasurement (timestamp, latitude, longitude, no2, voc, pm10, pm25, pm1, aqi) {
  return new Promise((resolve, reject) => {
    if (no2 > 0 || voc > 0 || [pm10, pm25, pm1].some(n => Number.isInteger(n))) {
      const job = {
        id: uuid(),
        cmd: 'setMeasurement',
        arg: {
          timestamp,
          latitude,
          longitude,
          no2: Number.isInteger(no2) ? no2 : null,
          voc: Number.isInteger(voc) ? voc : null,
          pm10: Number.isInteger(pm10) ? pm10 : null,
          pm25: Number.isInteger(pm25) ? pm25 : null,
          pm1: Number.isInteger(pm1) ? pm1 : null,
          aqi: Number.isInteger(aqi) ? aqi : null
        }
      }
      Jobs.set(job.id, { resolve, reject })
      worker.postMessage(job)
    } else {
      resolve({ changes: 0, lastInsertRowid: null })
    }
  })
}

export function getSummary (first, last) {
  return new Promise((resolve, reject) => {
    const job = {
      id: uuid(),
      cmd: 'getSummary',
      arg: {
        first: unixTime(first),
        last: unixTime(last) + 86399
      }
    }
    Jobs.set(job.id, { resolve, reject })
    worker.postMessage(job)
  })
}

export function getTemporalRange () {
  return new Promise((resolve, reject) => {
    const job = {
      id: uuid(),
      cmd: 'getTemporalRange',
      arg: {}
    }
    Jobs.set(job.id, { resolve, reject })
    worker.postMessage(job)
  })
}

export function getDataRange (first, last) {
  return new Promise((resolve, reject) => {
    const job = {
      id: uuid(),
      cmd: 'getDataRange',
      arg: {
        first: unixTime(first),
        last: unixTime(last) + 86399
      }
    }
    Jobs.set(job.id, { resolve, reject })
    worker.postMessage(job)
  })
}

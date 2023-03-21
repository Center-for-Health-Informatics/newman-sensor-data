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

export function setFlowData (timestamp, latitude, longitude, no2, voc, pm10, pm25, pm1, aqi) {
  return new Promise((resolve, reject) => {
    if (no2 > 0 || voc > 0 || [pm10, pm25, pm1].some(n => Number.isInteger(n))) {
      const job = {
        id: uuid(),
        cmd: 'setFlowData',
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

export function getFlowSummary (first, last) {
  return new Promise((resolve, reject) => {
    const job = {
      id: uuid(),
      cmd: 'getFlowSummary',
      arg: {
        first: unixTime(first),
        last: unixTime(last) + 86399
      }
    }
    Jobs.set(job.id, { resolve, reject })
    worker.postMessage(job)
  })
}

export function getFlowTemporalRange () {
  return new Promise((resolve, reject) => {
    const job = {
      id: uuid(),
      cmd: 'getFlowTemporalRange',
      arg: {}
    }
    Jobs.set(job.id, { resolve, reject })
    worker.postMessage(job)
  })
}

export function getFlowData (first, last) {
  return new Promise((resolve, reject) => {
    const job = {
      id: uuid(),
      cmd: 'getFlowData',
      arg: {
        first: unixTime(first),
        last: unixTime(last) + 86399
      }
    }
    Jobs.set(job.id, { resolve, reject })
    worker.postMessage(job)
  })
}

export function getAirBeamSensorID (sensor) {
  return new Promise((resolve, reject) => {
    const job = {
      id: uuid(),
      cmd: 'getAirBeamSensorID',
      arg: sensor
    }
    Jobs.set(job.id, { resolve, reject })
    worker.postMessage(job)
  })
}

export function setAirBeamData (reading) {
  return new Promise((resolve, reject) => {
    const job = {
      id: uuid(),
      cmd: 'setAirBeamData',
      arg: reading
    }
    Jobs.set(job.id, { resolve, reject })
    worker.postMessage(job)
  })
}

export function getAirBeamTemporalRange () {
  console.log('getAirBeamTemporalRange()')
  return new Promise((resolve, reject) => {
    const job = {
      id: uuid(),
      cmd: 'getAirBeamTemporalRange',
      arg: {}
    }
    Jobs.set(job.id, { resolve, reject })
    worker.postMessage(job)
  })
}

export function getAirBeamSummary (first, last) {
  console.log(`getAirBeamSummary(${first}, ${last})`)
  return new Promise((resolve, reject) => {
    const job = {
      id: uuid(),
      cmd: 'getAirBeamSummary',
      arg: {
        first: unixTime(first),
        last: unixTime(last) + 86399
      }
    }
    Jobs.set(job.id, { resolve, reject })
    worker.postMessage(job)
  })
}

export function getAirBeamData (first, last) {
  console.log(`getAirBeamData(${first}, ${last})`)
  return new Promise((resolve, reject) => {
    const job = {
      id: uuid(),
      cmd: 'getAirBeamData',
      arg: {
        first: unixTime(first),
        last: unixTime(last) + 86399
      }
    }
    Jobs.set(job.id, { resolve, reject })
    worker.postMessage(job)
  })
}

export function setXRFData (reading) {
  return new Promise((resolve, reject) => {
    const job = {
      id: uuid(),
      cmd: 'setXRFData',
      arg: reading
    }
    Jobs.set(job.id, { resolve, reject })
    worker.postMessage(job)
  })
}

export function getXRFTemporalRange () {
  return new Promise((resolve, reject) => {
    const job = {
      id: uuid(),
      cmd: 'getXRFTemporalRange',
      arg: {}
    }
    Jobs.set(job.id, { resolve, reject })
    worker.postMessage(job)
  })
}

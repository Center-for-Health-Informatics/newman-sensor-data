import { resolve } from 'node:path'
import process from 'node:process'
import { parentPort } from 'node:worker_threads'
import Database from 'better-sqlite3'
import { dateFromUnix } from '@robireton/chrono'

class DB extends Database {
  constructor () {
    super(resolve(process.env.DB_PATH || 'measurements.db'))
    this.pragma('foreign_keys = ON')
    this.pragma('journal_mode = WAL') // c.f. https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md
    this.init()
    process.on('exit', this.shutdown.bind(this))
  }

  init () {
    this.prepare('CREATE TABLE IF NOT EXISTS "flow_data" ("timestamp" INTEGER NOT NULL, "latitude" REAL NOT NULL, "longitude" REAL NOT NULL, "no2" integer, "voc" integer, "pm10" integer, "pm25" integer, "pm1" integer, "aqi" integer, PRIMARY KEY("timestamp", "latitude", "longitude"));').run()
    this.prepare('CREATE TABLE IF NOT EXISTS "airbeam_sensors" ("id" INTEGER PRIMARY KEY, "model" TEXT NOT NULL, "package" TEXT NOT NULL, "capability" TEXT NOT NULL, "units" TEXT NOT NULL);').run()
    this.prepare('CREATE UNIQUE INDEX IF NOT EXISTS "sensor_instance" ON "airbeam_sensors" ("model", "package", "capability", "units")').run()
    this.prepare('CREATE TABLE IF NOT EXISTS "airbeam_data" ("sensor" INTEGER NOT NULL, "timestamp" INTEGER NOT NULL, "latitude" REAL NOT NULL, "longitude" REAL NOT NULL, "value" INTEGER NOT NULL, FOREIGN KEY("sensor") REFERENCES "airbeam_sensors"("id") ON DELETE RESTRICT, PRIMARY KEY("sensor", "timestamp", "latitude", "longitude"));').run()
    this.prepare('CREATE TABLE IF NOT EXISTS "xrf_meta" ("id" INTEGER PRIMARY KEY, "instrument" TEXT NOT NULL, "timestamp" INTEGER NOT NULL, "latitude" REAL NOT NULL, "longitude" REAL NOT NULL, "reading" INTEGER DEFAULT NULL, "method" TEXT DEFAULT NULL, "factor" TEXT DEFAULT NULL, "label" TEXT DEFAULT NULL, "collimation" TEXT DEFAULT NULL, "units" TEXT DEFAULT NULL, "info" TEXT DEFAULT NULL)').run()
    this.prepare('CREATE TABLE IF NOT EXISTS "xrf_data" ("meta" INTEGER NOT NULL, "element" TEXT NOT NULL, "compound" INTEGER DEFAULT NULL, "level" INTEGER DEFAULT NULL, "error" INTEGER DEFAULT NULL, "concentration" INTEGER DEFAULT NULL, "error1s" INTEGER DEFAULT NULL, FOREIGN KEY("meta") REFERENCES "xrf_meta"("id") ON DELETE RESTRICT, PRIMARY KEY("meta", "element"))').run()
  }

  shutdown () {
    this.close()
  }
}

const db = new DB()
const pluckAirBeamSensorID = db.prepare('SELECT "id" FROM "airbeam_sensors" WHERE "model" = :model AND "package" = :package AND "capability" = :capability AND "units" = :units').pluck(true)
const insertAirBeamSensor = db.prepare('INSERT INTO "airbeam_sensors" ("model", "package", "capability", "units") VALUES (:model, :package, :capability, :units)')
const upsertAirBeamData = db.prepare('INSERT INTO "airbeam_data" ("sensor", "timestamp", "latitude", "longitude", "value") VALUES (:sensor, :timestamp, :latitude, :longitude, :value) ON CONFLICT("sensor", "timestamp", "latitude", "longitude") DO UPDATE SET "value" = excluded.value')
const selectAirBeamTemporalRange = db.prepare('SELECT MIN("timestamp") AS timeMin, MAX("timestamp") AS timeMax FROM "airbeam_data"')
const selectAirBeamSensors = db.prepare('SELECT "id", "model", "package", "capability", "units" FROM "airbeam_sensors"')
const selectAirBeamSummary = db.prepare('SELECT MIN(d."latitude") AS latMin, MAX(d."latitude") AS latMax, MIN(d."longitude") AS lonMin, MAX(d."longitude") AS lonMax, MIN(d."value") AS valueMin, ROUND(AVG(d."value")) AS valueAvg, MAX(d."value") AS valueMax, COUNT(*) AS samples FROM "airbeam_data" d, "airbeam_sensors" s WHERE d."sensor" = s."id" AND s."id" = :sensor AND d."timestamp" BETWEEN :first AND :last')
const selectAirBeamData = db.prepare('SELECT d."timestamp", d."latitude", d."longitude", d."value", s."capability" FROM "airbeam_data" d, "airbeam_sensors" s WHERE d."sensor" = s."id" AND d."timestamp" BETWEEN :first AND :last')

const upsertFlowData = db.prepare('INSERT INTO "flow_data" ("timestamp", "latitude", "longitude", "no2", "voc", "pm10", "pm25", "pm1", "aqi") VALUES (:timestamp, :latitude, :longitude, :no2, :voc, :pm10, :pm25, :pm1, :aqi) ON CONFLICT("timestamp", "latitude", "longitude") DO UPDATE SET "no2" = excluded.no2, "voc" = excluded.voc, "pm10" = excluded.pm10, "pm25" = excluded.pm25, "pm1" = excluded.pm1, "aqi" = excluded.aqi')
const selectFlowSummary = db.prepare('SELECT MIN("latitude") AS latMin, MAX("latitude") AS latMax, MIN("longitude") AS lonMin, MAX("longitude") AS lonMax, MIN("no2") AS no2Min, ROUND(AVG("no2")) AS no2Avg, MAX("no2") AS no2Max, MIN("voc") AS vocMin, ROUND(AVG("voc")) AS vocAvg, MAX("voc") AS vocMax, MIN("pm10") AS pm10Min, ROUND(AVG("pm10")) AS pm10Avg, MAX("pm10") AS pm10Max, MIN("pm25") AS pm25Min, ROUND(AVG("pm25")) AS pm25Avg, MAX("pm25") AS pm25Max, MIN("pm1") AS pm1Min, ROUND(AVG("pm1")) AS pm1Avg, MAX("pm1") AS pm1Max, MIN("aqi") AS aqiMin, ROUND(AVG("aqi")) AS aqiAvg, MAX("aqi") AS aqiMax, COUNT(*) AS samples FROM "flow_data" WHERE timestamp BETWEEN :first AND :last')
const selectFlowTemporalRange = db.prepare('SELECT MIN("timestamp") AS timeMin, MAX("timestamp") AS timeMax FROM "flow_data"')
const selectFlowData = db.prepare('SELECT * FROM "flow_data" WHERE timestamp BETWEEN :first AND :last')

const pluckXRFElements = db.prepare('SELECT DISTINCT "element" FROM "xrf_data"').pluck(true)
const insertXRFMeta = db.prepare('INSERT INTO "xrf_meta" ("instrument", "reading", "timestamp", "latitude", "longitude", "method", "factor", "label", "collimation", "units", "info") VALUES (:instrument, :reading, :timestamp, :latitude, :longitude, :method, :factor, :label, :collimation, :units, :info)')
const insertXRFData = db.prepare('INSERT INTO "xrf_data" ("meta", "element", "compound", "level", "error", "concentration", "error1s") VALUES (:meta, :element, :compound, :level, :error, :concentration, :error1s)')
const selectXRFTemporalRange = db.prepare('SELECT MIN("timestamp") AS timeMin, MAX("timestamp") AS timeMax FROM "xrf_meta"')
const selectXRFSummary = db.prepare('SELECT d."element", MIN(m."latitude") AS latMin, MAX(m."latitude") AS latMax, MIN(m."longitude") AS lonMin, MAX(m."longitude") AS lonMax, MIN(d."concentration") AS valueMin, ROUND(AVG(d."concentration")) AS valueAvg, MAX(d."concentration") AS valueMax, COUNT(*) AS samples FROM "xrf_meta" m, "xrf_data" d WHERE d."meta" = m."id" AND m."timestamp" BETWEEN :first AND :last GROUP BY d."element"')
const selectXRFData = db.prepare('SELECT m."timestamp", m."latitude", m."longitude", d."element", d."concentration", d."error1s" FROM "xrf_meta" m, "xrf_data" d WHERE d."meta" = m."id" AND m."timestamp" BETWEEN :first AND :last')

parentPort.on('message', message => {
  switch (message.cmd) {
    case 'getAirBeamSensorID': {
      let sensorID = pluckAirBeamSensorID.get(message.arg)
      if (!sensorID) {
        const insert = insertAirBeamSensor.run(message.arg)
        if (!insert.changes) throw new Error(`sensor ${message.arg.model}/${message.arg.capability} not added`)
        sensorID = insert.lastInsertRowid
      }
      parentPort.postMessage({
        id: message.id,
        result: sensorID
      })
      break
    }

    case 'getAirBeamTemporalRange': {
      const range = selectAirBeamTemporalRange.get()
      parentPort.postMessage({
        id: message.id,
        result: (Number.isInteger(range.timeMin) && Number.isInteger(range.timeMax)) ? { min: dateFromUnix(range.timeMin), max: dateFromUnix(range.timeMax) } : false
      })
      break
    }

    case 'getAirBeamSummary': {
      const summary = {
        count: 0,
        spatial: {
          min: { latitude: NaN, longitude: NaN },
          max: { latitude: NaN, longitude: NaN }
        }
      }
      for (const sensor of selectAirBeamSensors.all()) {
        const s = selectAirBeamSummary.get(Object.assign({ sensor: sensor.id }, message.arg))
        summary.count = Math.max(summary.count, s.samples)
        summary.spatial.min.latitude = Number.isNaN(summary.spatial.min.latitude) ? s.latMin : Math.min(summary.spatial.min.latitude, s.latMin)
        summary.spatial.min.longitude = Number.isNaN(summary.spatial.min.longitude) ? s.lonMin : Math.min(summary.spatial.min.longitude, s.lonMin)
        summary.spatial.max.latitude = Number.isNaN(summary.spatial.max.latitude) ? s.latMax : Math.max(summary.spatial.max.latitude, s.latMax)
        summary.spatial.max.longitude = Number.isNaN(summary.spatial.max.longitude) ? s.lonMax : Math.max(summary.spatial.max.longitude, s.lonMax)
        switch (sensor.capability) {
          case 'Particulate Matter':
            summary.pm = { min: s.valueMin, avg: s.valueAvg, max: s.valueMax }
            break
          case 'Temperature':
            summary.temperature = { min: s.valueMin, avg: s.valueAvg, max: s.valueMax }
            break
          case 'Sound Level':
            summary.soundlevel = { min: s.valueMin, avg: s.valueAvg, max: s.valueMax }
            break
          case 'Humidity':
            summary.humidity = { min: s.valueMin, avg: s.valueAvg, max: s.valueMax }
            break
        }
      }
      parentPort.postMessage({
        id: message.id,
        result: summary
      })
      break
    }

    case 'getAirBeamData': {
      const m = new Map()
      for (const α of selectAirBeamData.all(message.arg)) {
        const key = `${α.timestamp}:${α.latitude}:${α.longitude}`
        if (!m.has(key)) m.set(key, { timestamp: α.timestamp, latitude: α.latitude, longitude: α.longitude, pm: null, temperature: null, soundlevel: null, humidity: null })
        switch (α.capability) {
          case 'Particulate Matter':
            m.get(key).pm = α.value
            break
          case 'Temperature':
            m.get(key).temperature = α.value
            break
          case 'Sound Level':
            m.get(key).soundlevel = α.value
            break
          case 'Humidity':
            m.get(key).humidity = α.value
            break
        }
      }
      parentPort.postMessage({
        id: message.id,
        result: Array.from(m.values())
      })
      break
    }

    case 'setAirBeamData': {
      parentPort.postMessage({
        id: message.id,
        result: upsertAirBeamData.run(message.arg)
      })
      break
    }

    case 'getFlowTemporalRange': {
      const range = selectFlowTemporalRange.get()
      parentPort.postMessage({
        id: message.id,
        result: (Number.isInteger(range.timeMin) && Number.isInteger(range.timeMax)) ? { min: dateFromUnix(range.timeMin), max: dateFromUnix(range.timeMax) } : false
      })
      break
    }

    case 'getFlowSummary': {
      const summary = selectFlowSummary.get(message.arg)
      parentPort.postMessage({
        id: message.id,
        result: {
          count: summary.samples,
          spatial: {
            min: { latitude: summary.latMin, longitude: summary.lonMin },
            max: { latitude: summary.latMax, longitude: summary.lonMax }
          },
          no2: {
            min: summary.no2Min,
            avg: summary.no2Avg,
            max: summary.no2Max
          },
          voc: {
            min: summary.vocMin,
            avg: summary.vocAvg,
            max: summary.vocMax
          },
          pm10: {
            min: summary.pm10Min,
            avg: summary.pm10Avg,
            max: summary.pm10Max
          },
          pm25: {
            min: summary.pm25Min,
            avg: summary.pm25Avg,
            max: summary.pm25Max
          },
          pm1: {
            min: summary.pm1Min,
            avg: summary.pm1Avg,
            max: summary.pm1Max
          },
          aqi: {
            min: summary.aqiMin,
            avg: summary.aqiAvg,
            max: summary.aqiMax
          }
        }
      })
      break
    }

    case 'getFlowData': {
      parentPort.postMessage({
        id: message.id,
        result: selectFlowData.all(message.arg)
      })
      break
    }

    case 'setFlowData': {
      parentPort.postMessage({
        id: message.id,
        result: upsertFlowData.run(message.arg)
      })
      break
    }

    case 'getXRFTemporalRange': {
      const range = selectXRFTemporalRange.get()
      parentPort.postMessage({
        id: message.id,
        result: (Number.isInteger(range.timeMin) && Number.isInteger(range.timeMax)) ? { min: dateFromUnix(range.timeMin), max: dateFromUnix(range.timeMax) } : false
      })
      break
    }

    case 'getXRFSummary': {
      const summary = {
        count: 0,
        spatial: {
          min: { latitude: NaN, longitude: NaN },
          max: { latitude: NaN, longitude: NaN }
        },
        elements: {}
      }
      for (const e of selectXRFSummary.all(message.arg)) {
        summary.count = Math.max(summary.count, e.samples)
        summary.spatial.min.latitude = Number.isNaN(summary.spatial.min.latitude) ? e.latMin : Math.min(summary.spatial.min.latitude, e.latMin)
        summary.spatial.min.longitude = Number.isNaN(summary.spatial.min.longitude) ? e.lonMin : Math.min(summary.spatial.min.longitude, e.lonMin)
        summary.spatial.max.latitude = Number.isNaN(summary.spatial.max.latitude) ? e.latMax : Math.max(summary.spatial.max.latitude, e.latMax)
        summary.spatial.max.longitude = Number.isNaN(summary.spatial.max.longitude) ? e.lonMax : Math.max(summary.spatial.max.longitude, e.lonMax)
        summary.elements[e.element] = {
          min: e.valueMin,
          avg: e.valueAvg,
          max: e.valueMax
        }
      }
      parentPort.postMessage({
        id: message.id,
        result: summary
      })
      break
    }

    case 'getXRFData': {
      const m = new Map()
      const elements = pluckXRFElements.all()
      for (const α of selectXRFData.all(message.arg)) {
        const key = `${α.timestamp}:${α.latitude}:${α.longitude}`
        if (!m.has(key)) m.set(key, { timestamp: α.timestamp, latitude: α.latitude, longitude: α.longitude, elements: Object.fromEntries(elements.map(e => [e, { concentration: null, error1s: null }])) })
        m.get(key).elements[α.element] = { concentration: α.concentration, error1s: α.error1s }
      }
      parentPort.postMessage({
        id: message.id,
        result: Array.from(m.values())
      })
      break
    }

    case 'setXRFData': {
      const meta = insertXRFMeta.run(message.arg.meta)
      if (!meta.changes) throw new Error(`measurement ${message.arg.instrument}/${message.arg.reading} not added`)
      const metaID = meta.lastInsertRowid
      for (const [element, values] of Object.entries(message.arg.measurements)) {
        insertXRFData.run({
          meta: metaID,
          element,
          compound: values.Compound,
          level: values['Compound Level'],
          error: values['Compound Error'],
          concentration: values.Concentration,
          error1s: values.Error1s
        })
      }
      parentPort.postMessage({
        id: message.id,
        result: true
      })
      break
    }

    default:
      process.exit()
  }
})

import process from 'node:process'
import { parentPort } from 'node:worker_threads'
import Database from 'better-sqlite3'
import { dateFromUnix } from '@robireton/chrono'

class DB extends Database {
  constructor () {
    super('measurements.db')
    this.init()
    process.on('exit', this.shutdown.bind(this))
  }

  init () {
    this.prepare('CREATE TABLE IF NOT EXISTS "measurements" ("timestamp" integer NOT NULL, "latitude" real NOT NULL, "longitude" real NOT NULL, "no2" integer, "voc" integer, "pm10" integer, "pm25" integer, "pm1" integer, "aqi" integer, PRIMARY KEY("timestamp", "latitude", "longitude"));').run()
  }

  shutdown () {
    this.close()
  }
}

const db = new DB()
const upsertMeasurement = db.prepare('INSERT INTO "measurements" ("timestamp", "latitude", "longitude", "no2", "voc", "pm10", "pm25", "pm1", "aqi") VALUES (:timestamp, :latitude, :longitude, :no2, :voc, :pm10, :pm25, :pm1, :aqi) ON CONFLICT("timestamp", "latitude", "longitude") DO UPDATE SET "no2" = excluded.no2, "voc" = excluded.voc, "pm10" = excluded.pm10, "pm25" = excluded.pm25, "pm1" = excluded.pm1, "aqi" = excluded.aqi')
const selectSummary = db.prepare('SELECT MIN("latitude") AS latMin, MAX("latitude") AS latMax, MIN("longitude") AS lonMin, MAX("longitude") AS lonMax, MIN("no2") AS no2Min, ROUND(AVG("no2")) AS no2Avg, MAX("no2") AS no2Max, MIN("voc") AS vocMin, ROUND(AVG("voc")) AS vocAvg, MAX("voc") AS vocMax, MIN("pm10") AS pm10Min, ROUND(AVG("pm10")) AS pm10Avg, MAX("pm10") AS pm10Max, MIN("pm25") AS pm25Min, ROUND(AVG("pm25")) AS pm25Avg, MAX("pm25") AS pm25Max, MIN("pm1") AS pm1Min, ROUND(AVG("pm1")) AS pm1Avg, MAX("pm1") AS pm1Max, MIN("aqi") AS aqiMin, ROUND(AVG("aqi")) AS aqiAvg, MAX("aqi") AS aqiMax, COUNT(*) AS samples FROM "measurements" WHERE timestamp BETWEEN :first AND :last')
const selectTemporalRange = db.prepare('SELECT MIN("timestamp") AS timeMin, MAX("timestamp") AS timeMax FROM "measurements"')
const selectDataRange = db.prepare('SELECT * FROM "measurements" WHERE timestamp BETWEEN :first AND :last')

parentPort.on('message', message => {
  switch (message.cmd) {
    case 'setMeasurement': {
      parentPort.postMessage({
        id: message.id,
        result: upsertMeasurement.run(message.arg)
      })
      break
    }

    case 'getSummary': {
      const summary = selectSummary.get(message.arg)
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

    case 'getTemporalRange': {
      const range = selectTemporalRange.get()
      parentPort.postMessage({
        id: message.id,
        result: (Number.isInteger(range.timeMin) && Number.isInteger(range.timeMax)) ? { min: dateFromUnix(range.timeMin), max: dateFromUnix(range.timeMax) } : false
      })
      break
    }

    case 'getDataRange': {
      parentPort.postMessage({
        id: message.id,
        result: selectDataRange.all(message.arg)
      })
      break
    }

    default:
      process.exit()
  }
})
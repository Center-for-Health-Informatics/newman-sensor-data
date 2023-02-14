import process from 'node:process'
import Database from 'better-sqlite3'
import { dateFromUnix, unixTime } from '@robireton/chrono'

class DB extends Database {
  constructor () {
    super('measurements.db')
    this.init()
    process.on('exit', this.shutdown.bind(this))
  }

  init () {
    this.prepare('CREATE TABLE IF NOT EXISTS "measurements" ("timestamp" integer NOT NULL, "latitude" real NOT NULL, "longitude" real NOT NULL, "no2" integer, "voc" integer, "pm10" integer, "pm25" integer, "pm1" integer, PRIMARY KEY("timestamp", "latitude", "longitude"));').run()
  }

  shutdown () {
    this.close()
  }
}

const db = new DB()
const upsertMeasurement = db.prepare('INSERT INTO "measurements" ("timestamp", "latitude", "longitude", "no2", "voc", "pm10", "pm25", "pm1") VALUES (:timestamp, :latitude, :longitude, :no2, :voc, :pm10, :pm25, :pm1) ON CONFLICT("timestamp", "latitude", "longitude") DO UPDATE SET "no2" = excluded.no2, "voc" = excluded.voc, "pm10" = excluded.pm10, "pm25" = excluded.pm25, "pm1" = excluded.pm1')
const selectMeasurement = db.prepare('SELECT "no2", "voc", "pm10", "pm25", "pm1" FROM "measurements" WHERE "timestamp" = :timestamp AND "latitude" = :latitude AND "longitude" = :longitude')
const selectSummary = db.prepare('SELECT MIN("latitude") AS latMin, MAX("latitude") AS latMax, MIN("longitude") AS lonMin, MAX("longitude") AS lonMax, MIN("no2") AS no2Min, ROUND(AVG("no2")) AS no2Avg, MAX("no2") AS no2Max, MIN("voc") AS vocMin, ROUND(AVG("voc")) AS vocAvg, MAX("voc") AS vocMax, MIN("pm10") AS pm10Min, ROUND(AVG("pm10")) AS pm10Avg, MAX("pm10") AS pm10Max, MIN("pm25") AS pm25Min, ROUND(AVG("pm25")) AS pm25Avg, MAX("pm25") AS pm25Max, MIN("pm1") AS pm1Min, ROUND(AVG("pm1")) AS pm1Avg, MAX("pm1") AS pm1Max, COUNT(*) AS samples FROM "measurements" WHERE timestamp BETWEEN :first AND :last')
const selectTemporalRange = db.prepare('SELECT MIN("timestamp") AS timeMin, MAX("timestamp") AS timeMax FROM "measurements"')
const selectDataRange = db.prepare('SELECT * FROM "measurements" WHERE timestamp BETWEEN :first AND :last')

export function getMeasurement (timestamp, latitude, longitude) {
  return selectMeasurement.get({ timestamp, latitude, longitude })
}

export function setMeasurement (timestamp, latitude, longitude, no2, voc, pm10, pm25, pm1) {
  if (no2 > 0 || voc > 0 || [pm10, pm25, pm1].some(n => Number.isInteger(n))) {
    return upsertMeasurement.run({
      timestamp,
      latitude,
      longitude,
      no2: Number.isInteger(no2) ? no2 : null,
      voc: Number.isInteger(voc) ? voc : null,
      pm10: Number.isInteger(pm10) ? pm10 : null,
      pm25: Number.isInteger(pm25) ? pm25 : null,
      pm1: Number.isInteger(pm1) ? pm1 : null
    })
  }
}

export function getSummary (first, last) {
  const summary = selectSummary.get({
    first: unixTime(first),
    last: unixTime(last) + 86399
  })
  return {
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
    }
  }
}

export function getTemporalRange () {
  const range = selectTemporalRange.get()
  return {
    min: dateFromUnix(range.timeMin),
    max: dateFromUnix(range.timeMax)
  }
}

export function getDataRange (first, last) {
  return selectDataRange.all({
    first: unixTime(first),
    last: unixTime(last) + 86399
  })
}

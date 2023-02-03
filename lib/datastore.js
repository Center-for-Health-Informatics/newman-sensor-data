import process from 'node:process'
import Database from 'better-sqlite3'

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

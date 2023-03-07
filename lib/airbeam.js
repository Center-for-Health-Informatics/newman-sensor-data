import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const sectionHeader = 'sensor:model,sensor:package,sensor:capability,sensor:units'
try {
  const contents = await readFile(resolve('./info/edenavepazenca-afternoonbaselinerun2.csv'), { encoding: 'utf8' })
  const lines = contents.split(/\s*[\r\n]+\s*/)
  const sensorFieldNames = lines.shift()
  console.log(sensorFieldNames)
  const sensorMeta = lines.shift()
  console.log(sensorMeta)
  const dataFieldNames = lines.shift()
  console.log(dataFieldNames)
  for (const measurement of lines) {
    if (measurement.length === 4) {
      console.log({
        timestamp: Date.parse(measurement[0]),
        latitude: Number.parseFloat(Number.parseFloat(measurement[1]).toFixed(4)),
        longitude: Number.parseFloat(Number.parseFloat(measurement[2]).toFixed(4)),
        pm: Math.round(Number.parseFloat(measurement[3]))
      })
    }
  }
} catch (err) {
  console.error(err.message)
}

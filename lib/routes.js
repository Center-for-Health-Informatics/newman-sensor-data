import { env } from 'node:process'
import { Router } from 'express'
import { dateFromUnix, datetag, localDate, months } from '@robireton/chrono'
import handlebars from './handlebars.js'
import * as ds from './datastore.js'
import { ingestFlow, ingestAirBeam, ingestXRF, progress } from './ingest.js'
import { Menu } from './menu.js'

const router = Router()

const menu = new Menu([
  ['/airbeam', 'AirBeam', { weight: 0 }],
  ['/flow', 'Flow', { weight: 0 }],
  ['/xrf', 'XRF', { weight: 0 }],
  ['/import', 'Import', { weight: 1 }]
  // ['/export', 'Export', { weight: 2 }]
])

const ImportFiles = new Map()

function stylesheets (base, ...sheets) {
  return sheets.map(sheet => (String(sheet).toLowerCase().startsWith('http') ? String(sheet) : `${base}/${sheet}`))
}

function scripts (base, ...sources) {
  const results = []
  for (const source of sources) {
    if (typeof source === 'object') {
      results.push({
        src: source.src.toLowerCase().startsWith('http') ? String(source.src) : `${base}/${source.src}`,
        module: ('module' in source ? source.module : true)
      })
    } else {
      results.push({
        src: String(source).toLowerCase().startsWith('http') ? String(source) : `${base}/${source}`,
        module: true
      })
    }
  }
  return results
}

function errorPage (request, response, error) {
  response.status(500).render('error', {
    page_title: 'Error',
    base_url: request.proxyBase,
    sitemenu: menu.entries(request.path, request.proxyBase),
    code: error.message
  })
}

function formatFlowCSV (data) {
  const lines = ['"timestamp","latitude","longitude","NO2 (ppb)","VOC (ppb)","pm 10 (µg/m³)","pm 2.5 (µg/m³)","pm 1 (µg/m³)"']
  for (const d of data) {
    lines.push([
      d.timestamp,
      d.latitude,
      d.longitude,
      d.no2,
      d.voc,
      d.pm10,
      d.pm25,
      d.pm1
    ])
  }
  lines.push('')
  return lines.join('\n')
}

function formatAirBeamCSV (data) {
  const lines = ['"timestamp", "latitude", "longitude", "pm (µg/m³)", "temperature (°F)", "soundlevel (decibels)", "humidity (%)"']
  for (const d of data) {
    lines.push([
      d.timestamp,
      d.latitude,
      d.longitude,
      d.pm,
      d.temperature,
      d.soundlevel,
      d.humidity
    ])
  }
  lines.push('')
  return lines.join('\n')
}

function aqiName (aqi) {
  if (aqi <= 20) return 'Low'
  if (aqi <= 50) return 'Moderate'
  if (aqi <= 100) return 'High'
  if (aqi <= 150) return 'Very High'
  if (aqi <= 200) return 'Excessive'
  if (aqi <= 250) return 'Extreme'
  return 'Airpocalypse'
}

async function getTemporalRange () {
  const flow = await ds.getFlowTemporalRange()
  const airbeam = await ds.getAirBeamTemporalRange()
  const xrf = await ds.getXRFTemporalRange()
  const count = (flow ? 1 : 0) + (airbeam ? 1 : 0) + (xrf ? 1 : 0)
  const range = { count, flow, airbeam, xrf }
  return range
}

function formatFlowGeoJSON (data) {
  return {
    type: 'FeatureCollection',
    features: data.map(d => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [d.longitude, d.latitude]
      },
      properties: {
        datetime: dateFromUnix(d.timestamp).toLocaleString(),
        timestamp: d.timestamp,
        no2: d.no2,
        voc: d.voc,
        pm10: d.pm10,
        pm25: d.pm25,
        pm1: d.pm1,
        aqi: Number.isInteger(d.aqi) ? aqiName(d.aqi) : null
      }
    }))
  }
}

function formatAirBeamGeoJSON (data) {
  return {
    type: 'FeatureCollection',
    features: data.map(d => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [d.longitude, d.latitude]
      },
      properties: {
        datetime: dateFromUnix(d.timestamp).toLocaleString(),
        timestamp: d.timestamp,
        pm: d.pm,
        temperature: d.temperature,
        soundlevel: d.soundlevel,
        humidity: d.humidity
      }
    }))
  }
}

function exportParams (query) {
  if (['first', 'last'].every(key => key in query)) {
    return {
      first: localDate(query.first),
      last: localDate(query.last),
      filename: `${query.first}--${query.last}`
    }
  }

  if ('month' in query) {
    const target = localDate(query.month)
    return {
      first: new Date(target.getFullYear(), target.getMonth(), 1), // first day of the seleced month
      last: new Date(target.getFullYear(), 1 + target.getMonth(), 0), // last day of the selected month (0th day of the next month)
      filename: query.month
    }
  }

  throw Error('bad request')
}

router.get('/', async (req, res) => {
  try {
    const temporal = await getTemporalRange()
    if (temporal.count === 0) return res.redirect(`${req.proxyBase}/import`)
    return res.redirect(`${req.proxyBase}/${['flow', 'airbeam', 'xrf'].find(s => temporal[s])}`)
  } catch (err) {
    console.error(err)
    errorPage(req, res, err)
  }
})

router.get('/flow', async (req, res) => {
  try {
    const temporal = await getTemporalRange()
    if (!temporal.flow) return res.redirect(`${req.proxyBase}/import`)
    const summary = await ds.getFlowSummary(temporal.flow.min, temporal.flow.max)
    res.render('summary', {
      page_title: 'Flow Summary',
      base_url: req.proxyBase,
      sitemenu: menu.entries(req.path, req.proxyBase),
      scripts: scripts(req.proxyBase, { src: 'https://api.mapbox.com/mapbox-gl-js/v2.12.0/mapbox-gl.js', module: false }, { src: 'summary.js', module: false }),
      stylesheets: stylesheets(req.proxyBase, 'summary.css', 'https://api.mapbox.com/mapbox-gl-js/v2.12.0/mapbox-gl.css'),
      token: env.MAPBOX_TOKEN,
      source: `${req.proxyBase}/export/flow`,
      count: summary.count.toLocaleString(),
      temporal: {
        min: { display: temporal.flow.min.toLocaleDateString(), datetime: temporal.flow.min.toISOString(), tag: datetag(temporal.flow.min) },
        max: { display: temporal.flow.max.toLocaleDateString(), datetime: temporal.flow.max.toISOString(), tag: datetag(temporal.flow.max) }
      },
      spatial: {
        min: { latitude: summary.spatial.min.latitude.toFixed(4), longitude: summary.spatial.min.longitude.toFixed(4) },
        max: { latitude: summary.spatial.max.latitude.toFixed(4), longitude: summary.spatial.max.longitude.toFixed(4) }
      },
      measurements: [
        { heading: 'NO₂', units: 'ppb', min: summary.no2.min.toLocaleString(), avg: summary.no2.avg.toLocaleString(), max: summary.no2.max.toLocaleString() },
        { heading: 'VOC', units: 'ppb', min: summary.voc.min.toLocaleString(), avg: summary.voc.avg.toLocaleString(), max: summary.voc.max.toLocaleString() },
        { heading: 'pm10', units: 'μg/m³', min: summary.pm10.min.toLocaleString(), avg: summary.pm10.avg.toLocaleString(), max: summary.pm10.max.toLocaleString() },
        { heading: 'pm2.5', units: 'μg/m³', min: summary.pm25.min.toLocaleString(), avg: summary.pm25.avg.toLocaleString(), max: summary.pm25.max.toLocaleString() },
        { heading: 'pm1', units: 'μg/m³', min: summary.pm1.min.toLocaleString(), avg: summary.pm1.avg.toLocaleString(), max: summary.pm1.max.toLocaleString() },
        { heading: 'AQI', title: 'Plume AQI', min: summary.aqi.min.toLocaleString(), avg: summary.aqi.avg.toLocaleString(), max: summary.aqi.max.toLocaleString() }
      ],
      picker: {
        year: { min: temporal.flow.min.getFullYear(), value: temporal.flow.max.getFullYear(), max: temporal.flow.max.getFullYear() },
        month: temporal.flow.max.getMonth() + 1,
        months: months.map(month => ({ name: month.long, value: month.id, selected: month.index === temporal.flow.max.getMonth() })),
        min: { year: temporal.flow.min.getFullYear(), month: 1 + temporal.flow.min.getMonth() },
        max: { year: temporal.flow.max.getFullYear(), month: 1 + temporal.flow.max.getMonth() }
      }
    })
  } catch (err) {
    console.error(err)
    errorPage(req, res, err)
  }
})

router.get('/airbeam', async (req, res) => {
  try {
    const temporal = await getTemporalRange()
    if (!temporal.airbeam) return res.redirect(`${req.proxyBase}/import`)
    const summary = await ds.getAirBeamSummary(temporal.airbeam.min, temporal.airbeam.max)
    res.render('summary', {
      page_title: 'AirBeam Summary',
      base_url: req.proxyBase,
      sitemenu: menu.entries(req.path, req.proxyBase),
      scripts: scripts(req.proxyBase, { src: 'https://api.mapbox.com/mapbox-gl-js/v2.12.0/mapbox-gl.js', module: false }, { src: 'summary.js', module: false }),
      stylesheets: stylesheets(req.proxyBase, 'summary.css', 'https://api.mapbox.com/mapbox-gl-js/v2.12.0/mapbox-gl.css'),
      token: env.MAPBOX_TOKEN,
      source: `${req.proxyBase}/export/airbeam`,
      count: summary.count.toLocaleString(),
      temporal: {
        min: { display: temporal.airbeam.min.toLocaleDateString(), datetime: temporal.airbeam.min.toISOString(), tag: datetag(temporal.airbeam.min) },
        max: { display: temporal.airbeam.max.toLocaleDateString(), datetime: temporal.airbeam.max.toISOString(), tag: datetag(temporal.airbeam.max) }
      },
      spatial: {
        min: { latitude: summary.spatial.min.latitude.toFixed(4), longitude: summary.spatial.min.longitude.toFixed(4) },
        max: { latitude: summary.spatial.max.latitude.toFixed(4), longitude: summary.spatial.max.longitude.toFixed(4) }
      },
      measurements: [
        { heading: 'PM', units: 'μg/m³', min: summary.pm.min.toLocaleString(), avg: summary.pm.avg.toLocaleString(), max: summary.pm.max.toLocaleString() },
        { heading: 'Temperature', units: '°F', min: summary.temperature.min.toLocaleString(), avg: summary.temperature.avg.toLocaleString(), max: summary.temperature.max.toLocaleString() },
        { heading: 'Sound Level', units: 'decibels', min: summary.soundlevel.min.toLocaleString(), avg: summary.soundlevel.avg.toLocaleString(), max: summary.soundlevel.max.toLocaleString() },
        { heading: 'Humidity', units: '%', min: summary.humidity.min.toLocaleString(), avg: summary.humidity.avg.toLocaleString(), max: summary.humidity.max.toLocaleString() }
      ],
      picker: {
        year: { min: temporal.airbeam.min.getFullYear(), value: temporal.airbeam.max.getFullYear(), max: temporal.airbeam.max.getFullYear() },
        month: temporal.airbeam.max.getMonth() + 1,
        months: months.map(month => ({ name: month.long, value: month.id, selected: month.index === temporal.airbeam.max.getMonth() })),
        min: { year: temporal.airbeam.min.getFullYear(), month: 1 + temporal.airbeam.min.getMonth() },
        max: { year: temporal.airbeam.max.getFullYear(), month: 1 + temporal.airbeam.max.getMonth() }
      }
    })
  } catch (err) {
    console.error(err)
    errorPage(req, res, err)
  }
})

router.get('/import', (req, res) => {
  try {
    res.render('import', {
      page_title: 'Import Data',
      base_url: req.proxyBase,
      sitemenu: menu.entries(req.path, req.proxyBase),
      scripts: scripts(req.proxyBase, 'import.js'),
      stylesheets: stylesheets(req.proxyBase, 'import.css'),
      action: `${req.proxyBase}/import`
    })
  } catch (err) {
    console.error(err)
    errorPage(req, res, err)
  }
})

router.post('/import', async (req, res) => {
  if (!req.files) res.status(400).send('No files object in request.')
  const uploads = Object.values(req.files).filter(f => ['application/zip', 'text/csv'].includes(f.mimetype))
  if (uploads.length === 0) return res.status(400).send('No data files were uploaded.')
  try {
    const response = []
    for (const file of uploads) {
      console.log(`import ${file.name} (${file.mimetype})`)
      if (file.mimetype === 'application/zip' || file.name.toLowerCase().endsWith('.zip')) {
        const id = await ingestFlow(file.data)
        ImportFiles.set(id, file.name)
        response.push(`${req.proxyBase}/import/progress/${id}`)
      } else if (file.mimetype === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
        const content = file.data.toString()
        if (content.includes('sensor:model,sensor:package,sensor:capability,sensor:units')) {
          const id = await ingestAirBeam(content)
          ImportFiles.set(id, file.name)
          response.push(`${req.proxyBase}/import/progress/${id}`)
        } else if (content.startsWith('sep=,')) {
          const id = await ingestXRF(content)
          ImportFiles.set(id, file.name)
          response.push(`${req.proxyBase}/import/progress/${id}`)
        }
      }
    }
    res.json(response)
  } catch (err) {
    console.error(err)
    res.status(500).send(err.message)
  }
})

router.get('/import/progress/:id', async (req, res) => {
  const id = req.params.id
  if (!ImportFiles.has(id)) return res.sendStatus(404)
  try {
    const p = progress(id)
    const html = await handlebars.render('partials/progress', {
      layout: false,
      id,
      filename: ImportFiles.get(id),
      max: p.max,
      value: p.complete ? p.max : p.value,
      percent: p.complete ? '100' : (100 * p.value / p.max).toFixed(1)
    })
    res.json({
      complete: p.complete,
      id,
      html
    })
  } catch (err) {
    console.error(err)
    res.status(500).send(err.message)
  }
})

// router.get('/export', async (req, res) => {
//   try {
//     if ('format' in req.query) {
//       if (!['csv', 'geojson'].includes(req.query.format)) return res.status(400).send(`unknown export format “${req.query.format}”`)

//       const params = exportParams(req.query)
//       const data = await ds.getFlowData(params.first, params.last)
//       switch (req.query.format) {
//         case 'csv':
//           res.set({
//             'Content-Type': 'text/csv',
//             'Content-Disposition': `attachment; filename="${params.filename}.csv"`
//           }).send(formatFlowCSV(data))
//           break

//         case 'geojson':
//           res.json(formatFlowGeoJSON(data))
//           break
//       }
//     } else {
//       // show the export configuration form
//       const temporal = await getTemporalRange()
//       if (temporal.count === 0) return res.redirect(`${req.proxyBase}/import`)
//       const dates = {
//         min: datetag(temporal.flow.min),
//         value: datetag((new Date(temporal.flow.max)).setDate(temporal.flow.max.getDate() - 7)),
//         max: datetag(temporal.flow.max)
//       }
//       res.render('export', {
//         page_title: 'Export Data',
//         base_url: req.proxyBase,
//         sitemenu: menu.entries(req.path, req.proxyBase),
//         scripts: scripts(req.proxyBase, 'export.js'),
//         stylesheets: stylesheets(req.proxyBase, 'export.css'),
//         action: `${req.proxyBase}/export`,
//         first: {
//           min: dates.min,
//           value: dates.value,
//           max: dates.max
//         },
//         last: {
//           min: dates.min,
//           value: dates.max,
//           max: dates.max
//         }
//       })
//     }
//   } catch (err) {
//     if (err.message === 'bad request') {
//       res.sendStatus(400)
//     } else {
//       console.error(err)
//       errorPage(req, res, err)
//     }
//   }
// })

router.get('/export/airbeam', async (req, res) => {
  try {
    if ('format' in req.query) {
      if (!['csv', 'geojson'].includes(req.query.format)) return res.status(400).send(`unknown export format “${req.query.format}”`)

      const params = exportParams(req.query)
      const data = await ds.getAirBeamData(params.first, params.last)
      switch (req.query.format) {
        case 'csv':
          return res.set({
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${params.filename}.csv"`
          }).send(formatAirBeamCSV(data))

        case 'geojson':
          return res.json(formatAirBeamGeoJSON(data))
      }
    }
    res.sendStatus(400)
  } catch (err) {
    if (err.message === 'bad request') {
      res.sendStatus(400)
    } else {
      console.error(err)
      errorPage(req, res, err)
    }
  }
})

router.get('/export/flow', async (req, res) => {
  try {
    if ('format' in req.query) {
      if (!['csv', 'geojson'].includes(req.query.format)) return res.status(400).send(`unknown export format “${req.query.format}”`)

      const params = exportParams(req.query)
      const data = await ds.getFlowData(params.first, params.last)
      switch (req.query.format) {
        case 'csv':
          return res.set({
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${params.filename}.csv"`
          }).send(formatFlowCSV(data))

        case 'geojson':
          return res.json(formatFlowGeoJSON(data))
      }
    }
    res.sendStatus(400)
  } catch (err) {
    if (err.message === 'bad request') {
      res.sendStatus(400)
    } else {
      console.error(err)
      errorPage(req, res, err)
    }
  }
})

export default router

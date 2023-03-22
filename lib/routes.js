import { env } from 'node:process'
import { Router } from 'express'
import { datetag, localDate, months } from '@robireton/chrono'
import handlebars from './handlebars.js'
import { ingestFlow, ingestAirBeam, ingestXRF, progress } from './ingest.js'
import { Menu } from './menu.js'
import * as airbeam from './airbeam.js'
import * as flow from './flow.js'
import * as xrf from './xrf.js'

const router = Router()

const menu = new Menu([
  ['/airbeam', 'AirBeam', { weight: 0 }],
  ['/flow', 'Flow', { weight: 0 }],
  ['/xrf', 'XRF', { weight: 0 }],
  ['/import', 'Import', { weight: 1 }]
])

const ImportFiles = new Map()

function stylesheets (base, ...sheets) {
  return ['site.css'].concat(sheets).map(sheet => (String(sheet).toLowerCase().startsWith('http') ? String(sheet) : `${base}/${sheet}`))
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

function errorPage (req, res, error) {
  res.status(500).render('error', {
    page_title: 'Error',
    favicon: `${req.proxyBase}/favicon.ico`,
    stylesheets: stylesheets(req.proxyBase),
    sitemenu: menu.entries(req.path, req.proxyBase),
    code: error.message
  })
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
    const sensors = [
      { sensor: 'flow', available: Boolean(await flow.getTemporalRange()) },
      { sensor: 'airbeam', available: Boolean(await airbeam.getTemporalRange()) },
      { sensor: 'xrf', available: Boolean(await xrf.getTemporalRange()) }
    ]

    if (sensors.every(s => !s.available)) {
      // Redirect to the import page if there is no data
      return res.redirect(`${req.proxyBase}/import`)
    } else {
      // redirect to the first available sensor
      return res.redirect(`${req.proxyBase}/${sensors.find(s => s.available).sensor}`)
    }
  } catch (err) {
    console.error(err)
    errorPage(req, res, err)
  }
})

router.get('/airbeam', async (req, res) => {
  try {
    const temporal = await airbeam.getTemporalRange()
    if (!temporal) return res.redirect(`${req.proxyBase}/import`)
    const summary = await airbeam.getSummary(temporal.min, temporal.max)
    res.render('summary', {
      page_title: 'AirBeam',
      favicon: `${req.proxyBase}/favicon.ico`,
      stylesheets: stylesheets(req.proxyBase, 'summary.css', 'https://api.mapbox.com/mapbox-gl-js/v2.12.0/mapbox-gl.css'),
      scripts: scripts(req.proxyBase, { src: 'https://api.mapbox.com/mapbox-gl-js/v2.12.0/mapbox-gl.js', module: false }, { src: 'summary.js', module: false }),
      sitemenu: menu.entries(req.path, req.proxyBase),
      token: env.MAPBOX_TOKEN,
      source: `${req.proxyBase}/export/airbeam`,
      count: summary.count.toLocaleString(),
      temporal: {
        min: { display: temporal.min.toLocaleDateString(), datetime: temporal.min.toISOString(), tag: datetag(temporal.min) },
        max: { display: temporal.max.toLocaleDateString(), datetime: temporal.max.toISOString(), tag: datetag(temporal.max) }
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
        year: { min: temporal.min.getFullYear(), value: temporal.max.getFullYear(), max: temporal.max.getFullYear() },
        month: temporal.max.getMonth() + 1,
        months: months.map(month => ({ name: month.long, value: month.id, selected: month.index === temporal.max.getMonth() })),
        min: { year: temporal.min.getFullYear(), month: 1 + temporal.min.getMonth() },
        max: { year: temporal.max.getFullYear(), month: 1 + temporal.max.getMonth() }
      }
    })
  } catch (err) {
    console.error(err)
    errorPage(req, res, err)
  }
})

router.get('/flow', async (req, res) => {
  try {
    const temporal = await flow.getTemporalRange()
    if (!temporal) return res.redirect(`${req.proxyBase}/import`)
    const summary = await flow.getSummary(temporal.min, temporal.max)
    res.render('summary', {
      page_title: 'Flow',
      favicon: `${req.proxyBase}/favicon.ico`,
      stylesheets: stylesheets(req.proxyBase, 'summary.css', 'https://api.mapbox.com/mapbox-gl-js/v2.12.0/mapbox-gl.css'),
      scripts: scripts(req.proxyBase, { src: 'https://api.mapbox.com/mapbox-gl-js/v2.12.0/mapbox-gl.js', module: false }, { src: 'summary.js', module: false }),
      sitemenu: menu.entries(req.path, req.proxyBase),
      token: env.MAPBOX_TOKEN,
      source: `${req.proxyBase}/export/flow`,
      count: summary.count.toLocaleString(),
      temporal: {
        min: { display: temporal.min.toLocaleDateString(), datetime: temporal.min.toISOString(), tag: datetag(temporal.min) },
        max: { display: temporal.max.toLocaleDateString(), datetime: temporal.max.toISOString(), tag: datetag(temporal.max) }
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
        year: { min: temporal.min.getFullYear(), value: temporal.max.getFullYear(), max: temporal.max.getFullYear() },
        month: temporal.max.getMonth() + 1,
        months: months.map(month => ({ name: month.long, value: month.id, selected: month.index === temporal.max.getMonth() })),
        min: { year: temporal.min.getFullYear(), month: 1 + temporal.min.getMonth() },
        max: { year: temporal.max.getFullYear(), month: 1 + temporal.max.getMonth() }
      }
    })
  } catch (err) {
    console.error(err)
    errorPage(req, res, err)
  }
})

router.get('/xrf', async (req, res) => {
  try {
    const temporal = await xrf.getTemporalRange()
    if (!temporal) return res.redirect(`${req.proxyBase}/import`)
    const summary = await xrf.getSummary(temporal.min, temporal.max)
    res.render('summary', {
      page_title: 'XRF',
      favicon: `${req.proxyBase}/favicon.ico`,
      stylesheets: stylesheets(req.proxyBase, 'summary.css', 'https://api.mapbox.com/mapbox-gl-js/v2.12.0/mapbox-gl.css'),
      scripts: scripts(req.proxyBase, { src: 'https://api.mapbox.com/mapbox-gl-js/v2.12.0/mapbox-gl.js', module: false }, { src: 'summary.js', module: false }),
      sitemenu: menu.entries(req.path, req.proxyBase),
      token: env.MAPBOX_TOKEN,
      source: `${req.proxyBase}/export/xrf`,
      count: summary.count.toLocaleString(),
      temporal: {
        min: { display: temporal.min.toLocaleDateString(), datetime: temporal.min.toISOString(), tag: datetag(temporal.min) },
        max: { display: temporal.max.toLocaleDateString(), datetime: temporal.max.toISOString(), tag: datetag(temporal.max) }
      },
      spatial: {
        min: { latitude: summary.spatial.min.latitude.toFixed(4), longitude: summary.spatial.min.longitude.toFixed(4) },
        max: { latitude: summary.spatial.max.latitude.toFixed(4), longitude: summary.spatial.max.longitude.toFixed(4) }
      },
      measurements: Object.entries(summary.elements).map(([key, value]) => ({ heading: key, units: 'ppb', min: value.min.toLocaleString(), avg: value.avg.toLocaleString(), max: value.max.toLocaleString() })),
      picker: {
        year: { min: temporal.min.getFullYear(), value: temporal.max.getFullYear(), max: temporal.max.getFullYear() },
        month: temporal.max.getMonth() + 1,
        months: months.map(month => ({ name: month.long, value: month.id, selected: month.index === temporal.max.getMonth() })),
        min: { year: temporal.min.getFullYear(), month: 1 + temporal.min.getMonth() },
        max: { year: temporal.max.getFullYear(), month: 1 + temporal.max.getMonth() }
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
      favicon: `${req.proxyBase}/favicon.ico`,
      stylesheets: stylesheets(req.proxyBase, 'import.css'),
      scripts: scripts(req.proxyBase, 'import.js'),
      sitemenu: menu.entries(req.path, req.proxyBase),
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
      if (process.env.NODE_ENV !== 'production') console.log(`import ${file.name} (${file.mimetype})`)
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

router.get('/export/airbeam', async (req, res) => {
  try {
    if ('format' in req.query) {
      if (!['csv', 'geojson'].includes(req.query.format)) return res.status(400).send(`unknown export format “${req.query.format}”`)

      const params = exportParams(req.query)
      const data = await airbeam.getData(params.first, params.last)
      switch (req.query.format) {
        case 'csv':
          return res.set({
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="airbeam-${params.filename}.csv"`
          }).send(airbeam.formatCSV(data))

        case 'geojson':
          return res.json(airbeam.formatGeoJSON(data))
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
      const data = await flow.getData(params.first, params.last)
      switch (req.query.format) {
        case 'csv':
          return res.set({
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="flow-${params.filename}.csv"`
          }).send(flow.formatCSV(data))

        case 'geojson':
          return res.json(flow.formatGeoJSON(data))
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

router.get('/export/xrf', async (req, res) => {
  try {
    if ('format' in req.query) {
      if (!['csv', 'geojson'].includes(req.query.format)) return res.status(400).send(`unknown export format “${req.query.format}”`)

      const params = exportParams(req.query)
      const data = await xrf.getData(params.first, params.last)
      switch (req.query.format) {
        case 'csv':
          return res.set({
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="xrf-${params.filename}.csv"`
          }).send(xrf.formatCSV(data))

        case 'geojson':
          return res.json(xrf.formatGeoJSON(data))
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

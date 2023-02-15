import { env } from 'node:process'
import { Router } from 'express'
import { dateFromUnix, datetag, localDate, months } from '@robireton/chrono'
import handlebars from './handlebars.js'
import { getSummary, getTemporalRange, getDataRange } from './datastore.js'
import { ingest, progress } from './ingest.js'
import { Menu } from './menu.js'

const router = Router()

const menu = new Menu([
  ['/', 'Home', { weight: 0 }],
  ['/import', 'Import', { weight: 1 }],
  ['/export', 'Export', { weight: 2 }]
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

function formatCSV (data) {
  const lines = ['"timestamp","latitude","longitude","NO2 (ppb)","VOC (ppb)","pm 10 (ug/m3)","pm 2.5 (ug/m3)","pm 1 (ug/m3)"']
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

function aqiName (aqi) {
  if (aqi <= 20) return 'Low'
  if (aqi <= 50) return 'Moderate'
  if (aqi <= 100) return 'High'
  if (aqi <= 150) return 'Very High'
  if (aqi <= 200) return 'Excessive'
  if (aqi <= 250) return 'Extreme'
  return 'Airpocalypse'
}

function formatGeoJSON (data) {
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

router.get('/', (req, res) => {
  try {
    const temporal = getTemporalRange()
    if (!temporal) return res.redirect('./import')
    const summary = getSummary(temporal.min, temporal.max)
    const randomDate = new Date(temporal.min.valueOf() + Math.random() * (temporal.max.valueOf() - temporal.min.valueOf()))
    res.render('summary', {
      page_title: 'Summary',
      base_url: req.proxyBase,
      sitemenu: menu.entries(req.path, req.proxyBase),
      scripts: scripts(req.proxyBase, { src: 'https://api.mapbox.com/mapbox-gl-js/v2.12.0/mapbox-gl.js', module: false }, { src: 'summary.js', module: false }),
      stylesheets: stylesheets(req.proxyBase, 'summary.css', 'https://api.mapbox.com/mapbox-gl-js/v2.12.0/mapbox-gl.css'),
      count: summary.count.toLocaleString(),
      temporal: {
        min: { display: temporal.min.toLocaleDateString(), datetime: temporal.min.toISOString() },
        max: { display: temporal.max.toLocaleDateString(), datetime: temporal.max.toISOString() }
      },
      spatial: {
        min: { latitude: summary.spatial.min.latitude.toFixed(4), longitude: summary.spatial.min.longitude.toFixed(4) },
        max: { latitude: summary.spatial.max.latitude.toFixed(4), longitude: summary.spatial.max.longitude.toFixed(4) }
      },
      measurement: {
        no2: {
          min: summary.no2.min.toLocaleString(),
          avg: summary.no2.avg.toLocaleString(),
          max: summary.no2.max.toLocaleString()
        },
        voc: {
          min: summary.voc.min.toLocaleString(),
          avg: summary.voc.avg.toLocaleString(),
          max: summary.voc.max.toLocaleString()
        },
        pm10: {
          min: summary.pm10.min.toLocaleString(),
          avg: summary.pm10.avg.toLocaleString(),
          max: summary.pm10.max.toLocaleString()
        },
        pm25: {
          min: summary.pm25.min.toLocaleString(),
          avg: summary.pm25.avg.toLocaleString(),
          max: summary.pm25.max.toLocaleString()
        },
        pm1: {
          min: summary.pm1.min.toLocaleString(),
          avg: summary.pm1.avg.toLocaleString(),
          max: summary.pm1.max.toLocaleString()
        },
        aqi: {
          min: summary.aqi.min.toLocaleString(),
          avg: summary.aqi.avg.toLocaleString(),
          max: summary.aqi.max.toLocaleString()
        }
      },
      token: env.MAPBOX_TOKEN,
      picker: {
        year: { min: temporal.min.getFullYear(), value: randomDate.getFullYear(), max: temporal.max.getFullYear() },
        month: randomDate.getMonth() + 1,
        months: months.map(month => ({ name: month.long, value: month.id, selected: month.index === randomDate.getMonth() })),
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
    res.render('ingest', {
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
  const uploads = Object.values(req.files).filter(f => f.mimetype === 'application/zip')
  if (uploads.length === 0) return res.status(400).send('No zip files were uploaded.')
  try {
    const response = []
    for (const file of uploads) {
      const id = await ingest(file.data)
      ImportFiles.set(id, file.name)
      response.push(`${req.proxyBase}/import/progress/${id}`)
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
      percent: p.complete ? '100' : (100 * p.value / p.max).toFixed(0)
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

router.get('/export', (req, res) => {
  try {
    if ('format' in req.query) {
      if (!['csv', 'geojson'].includes(req.query.format)) return res.status(400).send(`unknown export format “${req.query.format}”`)

      const params = exportParams(req.query)
      const data = getDataRange(params.first, params.last)
      switch (req.query.format) {
        case 'csv':
          res.set({
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${params.filename}.csv"`
          }).send(formatCSV(data))
          break

        case 'geojson':
          res.json(formatGeoJSON(data))
          break
      }
    } else {
      // show the export configuration form
      const temporal = getTemporalRange()
      const dates = {
        min: datetag(temporal.min),
        value: datetag((new Date(temporal.max)).setDate(temporal.max.getDate() - 7)),
        max: datetag(temporal.max)
      }
      res.render('export', {
        page_title: 'Export Data',
        base_url: req.proxyBase,
        sitemenu: menu.entries(req.path, req.proxyBase),
        scripts: scripts(req.proxyBase, 'export.js'),
        stylesheets: stylesheets(req.proxyBase, 'export.css'),
        action: `${req.proxyBase}/export`,
        first: {
          min: dates.min,
          value: dates.value,
          max: dates.max
        },
        last: {
          min: dates.min,
          value: dates.max,
          max: dates.max
        }
      })
    }
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

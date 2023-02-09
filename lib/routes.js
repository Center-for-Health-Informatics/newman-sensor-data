import { Router } from 'express'
import handlebars from './handlebars.js'
import { getSummary } from './datastore.js'
import { ingest, progress } from './ingest.js'
import { Menu } from './menu.js'

const router = Router()

const menu = new Menu([
  ['/', 'Home', { weight: 0 }],
  ['/import', 'Import', { weight: 1 }],
  ['/export', 'Export', { weight: 2 }],
  ['/devices', 'Devices', { weight: 3 }]
])

const ImportFiles = new Map()

router.get('/', (req, res) => {
  try {
    const summary = getSummary()
    res.render('home', {
      page_title: 'Summary',
      base_url: req.proxyBase,
      sitemenu: menu.entries(req.path, req.proxyBase),
      count: summary.count.toLocaleString(),
      temporal: {
        min: summary.temporal.min.toLocaleString(),
        max: summary.temporal.max.toLocaleString()
      },
      spatial: {
        min: { latitude: summary.spatial.min.latitude.toFixed(4), longitude: summary.spatial.min.longitude.toFixed(4) },
        avg: { latitude: summary.spatial.avg.latitude.toFixed(4), longitude: summary.spatial.avg.longitude.toFixed(4) },
        max: { latitude: summary.spatial.max.latitude.toFixed(4), longitude: summary.spatial.max.longitude.toFixed(4) }
      },
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
      }
    })
  } catch (err) {
    res.status(500).render('error', {
      page_title: 'Error',
      base_url: req.proxyBase,
      sitemenu: menu.entries(req.path, req.proxyBase),
      code: err.message
    })
  }
})

router.get('/import', (req, res) => {
  try {
    res.render('ingest', {
      page_title: 'Import Data',
      base_url: req.proxyBase,
      sitemenu: menu.entries(req.path, req.proxyBase),
      scripts: ['import.js'],
      stylesheets: ['import.css'],
      action: `${req.proxyBase}/import'`
    })
  } catch (err) {
    res.status(500).render('error', {
      page_title: 'Error',
      base_url: req.proxyBase,
      sitemenu: menu.entries(req.path, req.proxyBase),
      code: err.message
    })
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
    res.status(500).render('error', {
      page_title: 'Error',
      base_url: req.proxyBase,
      sitemenu: menu.entries(req.path, req.proxyBase),
      code: err.message
    })
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
    res.status(500).send(err.message)
  }
})

export default router

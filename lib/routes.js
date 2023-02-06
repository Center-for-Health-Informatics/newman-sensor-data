import { Router } from 'express'
import { getSummary } from './datastore.js'
import { Menu } from './menu.js'

const router = Router()

const menu = new Menu([
  ['/', 'Home', { weight: 0 }],
  ['/import', 'Import', { weight: 1 }],
  ['/export', 'Export', { weight: 2 }],
  ['/devices', 'Devices', { weight: 3 }]
])

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
    console.error(err.message)
  }
})

export default router

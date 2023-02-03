import { Router } from 'express'

const router = Router()

router.all('*', (req, _res, next) => {
  req.proxyBase = req.get('x-script-name') || ''

  next()
})

export default router

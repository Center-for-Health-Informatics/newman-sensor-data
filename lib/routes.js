import { Router } from 'express'

const router = Router()

router.get('/', (req, res) => {
  res.render('home', {
    page_title: 'Home',
    base_url: req.proxyBase
  })
})

export default router

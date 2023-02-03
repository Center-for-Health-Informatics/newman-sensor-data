import { resolve } from 'node:path'
import express from 'express'
import fileUpload from 'express-fileupload'
import favicon from 'serve-favicon'
import handlebars from './handlebars.js'
import scriptName from './script-name.js'
import routes from './routes.js'

const app = express()

app.engine(handlebars.extname, handlebars.engine)
app.set('view engine', handlebars.extname)
app.set('trust proxy', ['loopback', 'uniquelocal'])
app.set('x-powered-by', false)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(fileUpload())

app.use(favicon(resolve('static/plume.png')))
app.use(express.static(resolve('static')))
app.use(scriptName)
app.use(routes)

export default app

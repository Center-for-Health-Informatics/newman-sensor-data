import { env } from 'node:process'
import Server from './lib/server.js'

if ('NODE_ENV' in env) console.log(`NODE_ENV is ${env.NODE_ENV}`)

const server = new Server({
  host: env.HTTP_HOST || 'localhost',
  port: env.HTTP_PORT || 0
})
server.on('listening', (address, port) => {
  const host = (address === '::1') ? 'localhost' : address
  console.log(`listening on http://${host}:${port}`)
})

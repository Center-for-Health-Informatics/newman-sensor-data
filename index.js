// import ingest from './lib/ingest.js'
import Server from './lib/server.js'

const server = new Server({
  host: '::1',
  port: 3569
})
console.log(`listening on ${server.address}:${server.port}`)

// ingest('./user_1002061_1675089365.zip')

import Server from './lib/server.js'

const server = new Server({
  host: '::1',
  port: 3569
})
server.on('listening', (address, port) => console.log(`listening on ${address}:${port}`))

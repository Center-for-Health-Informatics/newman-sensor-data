import process from 'node:process'
import { EventEmitter } from 'node:events'
import framework from './framework.js'

export default class Server extends EventEmitter {
  constructor (config) {
    super()
    this.server = framework.listen(config, () => {
      const addr = this.server.address()
      this.address = addr.address
      this.port = addr.port
      this.emit('listening', this.address, this.port)
    })

    for (const signal of ['SIGUSR2', 'SIGINT', 'SIGTERM']) {
      process.on(signal, () => {
        this.server.close(err => {
          err && console.error(err.message)
        })
        this.server.closeAllConnections()
      })
    }
  }
}

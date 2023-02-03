import process from 'node:process'
import framework from './framework.js'

export default class Server {
  constructor (config) {
    this.server = framework.listen(config, () => {
      const addr = this.server.address()
      this.address = addr.address
      this.port = addr.port
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

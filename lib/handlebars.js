import { cwd } from 'node:process'
import path from 'node:path'
import { ExpressHandlebars } from 'express-handlebars'

const handlebars = new ExpressHandlebars({
  extname: '.hbs',
  defaultLayout: 'main',
  helpers: {
    equals: (a, b) => String(a) === String(b)
  }
})

export default {
  engine: handlebars.engine,
  extname: handlebars.extname,
  render: async (template, context) => {
    const parts = path.parse(template)
    if (!parts.dir.split(path.sep).includes('views')) parts.dir = path.join(cwd(), 'views', parts.dir)
    if (!parts.ext) {
      parts.ext = handlebars.extname
      delete parts.base
    }
    if (context.layout) {
      const layout = path.parse(context.layout)
      if (!layout.dir.split(path.sep).includes('views')) layout.dir = path.join(cwd(), 'views', 'layouts', layout.dir)
      if (!layout.ext) {
        layout.ext = handlebars.extname
        delete layout.base
      }
      context.layout = path.format(layout)
    }
    return await handlebars.renderView(path.format(parts), context)
  }
}

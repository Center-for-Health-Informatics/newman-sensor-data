export class MenuItem {
  constructor (url, text, options = {}) {
    this.url = String(url)
    this.text = String(text)
    this.weight = Number.parseInt(options.weight)
    this.title = options.title
    this.id = options.id
    this.classes = Array.isArray(options.classes) ? options.classes : []
    this.roles = Array.isArray(options.roles) ? options.roles : []
    this.hideself = Boolean(options.hideself)

    if (Number.isNaN(this.weight)) this.weight = 0
  }
}

export class Menu {
  constructor (items = []) {
    this.items = []
    for (const item of items) {
      this.items.push(item instanceof MenuItem ? item : new MenuItem(...item))
    }
  }

  entries (current, base = '', user = null) {
    const menu = []
    const userRoles = (user && 'roles' in user && Array.isArray(user.roles)) ? user.roles : []
    for (const item of this.items) {
      if (item.roles.includes('unauthenticated') && user) continue // Don’t show to authenticated users
      if (item.roles.includes('authenticated') && !user) continue // Don’t show to unauthenticated users
      const roles = item.roles.filter(role => !['authenticated', 'unauthenticated'].includes(role))
      if (roles.length > 0 && !roles.some(role => userRoles.includes(role))) continue // Don’t show to users without a required role when certain roles are required
      const isCurrent = (current === item.url)
      if (item.hideself && isCurrent) continue // Don’t show item for current page
      const entry = {
        url: isCurrent ? null : (item.url.startsWith('https://') ? item.url : base + item.url),
        text: item.text,
        weight: item.weight
      }
      if (item.title) entry.title = item.title
      if (item.id) entry.id = item.id
      if (item.classes) entry.class = item.classes.join(' ')
      menu.push(entry)
    }
    return menu.sort((a, b) => ((a.weight - b.weight) || a.text.localeCompare(b.text)))
  }
}

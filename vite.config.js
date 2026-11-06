import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const featuredDir = path.resolve('public/assets/works/featuredWorks')
const featuredId = 'virtual:featured-works'
const featuredResolved = `\0${featuredId}`
const imageExt = /\.(jpe?g|png|webp|gif|avif)$/i
const imageTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
}
const featuredPrefix = '/assets/works/featuredWorks/'

// # in a filename is a URL fragment, so Vite never finds the file.
const serveFeatured = (req, res, next) => {
  const pathname = (req.url || '').split('?')[0]
  if (!pathname.startsWith(featuredPrefix)) return next()
  let name
  try {
    name = decodeURIComponent(pathname.slice(featuredPrefix.length))
  } catch {
    return next()
  }
  if (!name || name.includes('/') || name.includes('\\') || name.includes('\0')) return next()
  const file = path.join(featuredDir, name)
  const type = imageTypes[path.extname(file).toLowerCase()]
  if (!type || !fs.existsSync(file)) return next()
  res.setHeader('Content-Type', type)
  res.setHeader('Cache-Control', 'no-cache')
  fs.createReadStream(file).pipe(res)
}

const featuredList = () => {
  if (!fs.existsSync(featuredDir)) return []
  return fs
    .readdirSync(featuredDir)
    .filter((name) => imageExt.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => `/assets/works/featuredWorks/${encodeURIComponent(name)}`)
}

// Lists whatever is dropped in public/assets/works/featuredWorks.
const featuredWorks = () => ({
  name: 'featured-works',
  resolveId(id) {
    if (id === featuredId) return featuredResolved
  },
  load(id) {
    if (id !== featuredResolved) return
    return `export default ${JSON.stringify(featuredList())}`
  },
  configureServer(server) {
    server.middlewares.use(serveFeatured)
    const reload = (file) => {
      if (!file.split(path.sep).includes('featuredWorks')) return
      const mod = server.moduleGraph.getModuleById(featuredResolved)
      if (mod) server.moduleGraph.invalidateModule(mod)
      server.ws.send({ type: 'full-reload' })
    }
    server.watcher.add(featuredDir)
    server.watcher.on('add', reload)
    server.watcher.on('unlink', reload)
  },
  configurePreviewServer(server) {
    server.middlewares.use(serveFeatured)
  },
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), featuredWorks()],
  server: {
    port: 3000,
  },
})

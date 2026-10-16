import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { resolve, extname, sep } from 'node:path'
import { loadEnv } from 'vite'
import { driveMiddleware } from './drive.mjs'
import { createAppLibrary } from './library.mjs'

const root = process.cwd()
const env = { ...loadEnv('production', root, ''), ...process.env }
const recipes = JSON.parse(await readFile(resolve(root, 'src/data/recipes.json'), 'utf8'))
const library = createAppLibrary(env, recipes)
library.start()
const api = driveMiddleware(library)
const dist = resolve(root, 'dist')
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' }
const server = createServer((req, res) => api(req, res, async () => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    const file = resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname))
    if (!file.startsWith(dist + sep)) { res.writeHead(403); res.end(); return }
    // This app has no path-based routing: missing files are real 404s.
    const { stat } = await import('node:fs/promises')
    if (!(await stat(file)).isFile()) throw new Error('not a file')
    res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream')
    createReadStream(file).on('error', () => res.destroy()).pipe(res)
  } catch { res.writeHead(404); res.end('Not found') }
}))
server.listen(Number(env.PORT || 3000), '0.0.0.0', () => console.log(`Bếp nhà: http://localhost:${env.PORT || 3000}`))

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { library.stop(); server.close(() => process.exit(0)) })

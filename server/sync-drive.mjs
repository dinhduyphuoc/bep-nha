import { readFile } from 'node:fs/promises'
import { loadEnv } from 'vite'
import { createAppLibrary } from './library.mjs'
const env = { ...loadEnv('production', process.cwd(), ''), ...process.env }
const recipes = JSON.parse(await readFile('src/data/recipes.json', 'utf8'))
const library = createAppLibrary(env, recipes)
try {
  const snapshot = await library.synchronize()
  const images = new Set((snapshot.albums || []).flatMap(album => [...album.photos, ...(album.galleryPhotos || [])]).map(photo => photo.id))
  console.log(JSON.stringify({ configured: snapshot.configured, images: images.size, missingFolders: snapshot.missingFolders || [], syncedAt: snapshot.fetchedAt }))
} catch (error) { console.error(`Đồng bộ thất bại: ${error.message}`); process.exitCode = 1 }
finally { library.stop() }

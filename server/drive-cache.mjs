import { mkdir, readFile, writeFile, rename, stat, unlink, open } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { join } from 'node:path'

const hash = value => createHash('sha256').update(value).digest('hex')
const photosOf = snapshot => snapshot.albums.flatMap(album => [...album.photos, ...(album.galleryPhotos || [])])

export function createCachedDriveLibrary({ library, directory, identity, intervalMs = 30000 }) {
  const scope = hash(identity)
  const folder = join(directory, scope)
  const manifest = join(folder, 'manifest.json')
  let state = null, flight = null, timer = null, stopped = false
  let lastError = null
  const initialized = (async () => {
    await mkdir(folder, { recursive: true })
    try {
      const saved = JSON.parse(await readFile(manifest, 'utf8'))
      if (saved.scope !== scope || !saved.snapshot?.configured || !saved.records) return
      for (const record of Object.values(saved.records)) {
        if (!/^[a-f0-9]{64}\.img$/.test(record.filename) || !record.type?.startsWith('image/')) return
        await stat(join(folder, record.filename))
      }
      state = saved
    } catch { /* No usable snapshot: perform an initial sync. */ }
  })()

  async function synchronize() {
    if (flight) return flight
    flight = (async () => {
      await initialized
      const snapshot = await library.load()
      if (!snapshot.configured) { state = null; return snapshot }
      const records = { ...(state?.records || {}) }
      const photos = [...new Map(photosOf(snapshot).map(photo => [photo.id, photo])).values()]
      let next = 0
      async function worker() {
        while (!stopped && next < photos.length) {
          const photo = photos[next++]
          const version = new URL(photo.image, 'http://localhost').searchParams.get('v') || ''
          const key = `${photo.id}:${version}`
          if (records[key]) {
            try { await stat(join(folder, records[key].filename)); continue } catch { /* Re-download missing cache file. */ }
          }
          const filename = `${hash(key)}.img`
          // Resume complete downloads from an interrupted sync, even before its
          // snapshot was published. Never reuse .tmp files.
          try {
            const cached = await open(join(folder, filename), 'r')
            const bytes = Buffer.alloc(512)
            try { await cached.read(bytes, 0, 512, 0) } finally { await cached.close() }
            const header = bytes.toString('utf8')
            const type = bytes[0] === 255 && bytes[1] === 216 ? 'image/jpeg' : bytes.subarray(1,4).toString() === 'PNG' ? 'image/png' : bytes.subarray(0,3).toString() === 'GIF' ? 'image/gif' : bytes.subarray(8,12).toString() === 'WEBP' ? 'image/webp' : header.includes('<svg') ? 'image/svg+xml' : null
            if (type) { records[key] = { filename, type }; continue }
          } catch { /* File not cached yet. */ }
          let response
          for (let attempt = 0; attempt < 2; attempt++) {
            try { response = await library.image(photo.id); break }
            catch (error) { if (attempt === 1 || stopped) throw error }
          }
          const type = response?.headers.get('content-type') || ''
          if (!response?.ok || !type.startsWith('image/')) throw new Error('Không tải được ảnh khi đồng bộ Drive.')
          const temporary = join(folder, `${filename}.${randomUUID()}.tmp`)
          try {
            await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, { flags: 'wx' }))
            await rename(temporary, join(folder, filename))
          } catch (error) { await unlink(temporary).catch(() => {}); throw error }
          records[key] = { filename, type }
        }
      }
      const outcomes = await Promise.allSettled(Array.from({ length: Math.min(3, photos.length) }, worker))
      const failure = outcomes.find(result => result.status === 'rejected')
      if (failure) throw failure.reason
      if (stopped) throw new Error('Đã dừng đồng bộ.')
      // Old file versions for still-present IDs remain readable for already-open tabs.
      const ids = new Set(photos.map(photo => photo.id))
      for (const key of Object.keys(records)) if (!ids.has(key.split(':')[0])) delete records[key]
      const updated = { scope, snapshot, records }
      const temporary = `${manifest}.${randomUUID()}.tmp`
      await writeFile(temporary, JSON.stringify(updated))
      await rename(temporary, manifest)
      state = updated
      lastError = null
      return snapshot
    })().catch(error => { lastError = error.message; throw error }).finally(() => { flight = null })
    return flight
  }
  async function load() {
    await initialized
    if (!state) return synchronize()
    return { ...state.snapshot, cached: true, syncError: lastError }
  }
  async function image(id, version = '') {
    await initialized
    if (!state || !photosOf(state.snapshot).some(photo => photo.id === id)) return null
    const record = state.records[`${id}:${version}`]
    if (!record) return null
    const path = join(folder, record.filename)
    try { await stat(path) } catch { return null }
    return new Response(Readable.toWeb(createReadStream(path)), { headers: { 'Content-Type': record.type, 'Cache-Control': 'public, max-age=31536000, immutable', ETag: `"${record.filename}"` } })
  }
  function start() {
    if (timer) return
    stopped = false
    synchronize().catch(() => {})
    timer = setInterval(() => synchronize().catch(() => {}), Math.max(1000, intervalMs))
    timer.unref()
  }
  function stop() { stopped = true; clearInterval(timer); timer = null }
  return { load, image, start, stop, synchronize }
}

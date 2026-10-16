import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCachedDriveLibrary } from './drive-cache.mjs'

test('disk cache survives restart, downloads changes only, keeps old snapshot on error and removes deleted IDs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'drive-cache-test-'))
  let version = '1', offline = false, downloads = 0, removed = false, failedImage = false
  const library = {
    async load() { if (offline) throw new Error('offline'); return { configured: true, albums: [{ name: 'dish', photos: removed ? [] : [{ id: 'img', image: `/api/drive/images/img?v=${version}` }], galleryPhotos: [] }] } },
    async image() { downloads++; if (failedImage) throw new Error('download failed'); return new Response(`image-${version}`, { headers: { 'Content-Type': 'image/jpeg' } }) },
  }
  const options = { library, directory, identity: 'root-and-recipes' }
  const cache = createCachedDriveLibrary(options)
  try {
    await Promise.all([cache.synchronize(), cache.synchronize()])
    assert.equal(downloads, 1)
    assert.equal(await (await cache.image('img', '1')).text(), 'image-1')
    await cache.synchronize(); assert.equal(downloads, 1)
    const restarted = createCachedDriveLibrary(options)
    offline = true
    assert.equal((await restarted.load()).configured, true)
    assert.equal(await (await restarted.image('img', '1')).text(), 'image-1')
    await assert.rejects(cache.synchronize(), /offline/)
    assert.equal((await cache.load()).syncError, 'offline')
    offline = false; version = '2'; failedImage = true
    await assert.rejects(cache.synchronize(), /download failed/)
    assert.equal((await cache.load()).albums[0].photos[0].image, '/api/drive/images/img?v=1')
    failedImage = false; await cache.synchronize()
    assert.equal(await (await cache.image('img', '2')).text(), 'image-2')
    assert.equal(await (await cache.image('img', '1')).text(), 'image-1')
    assert.equal(await cache.image('outside', '1'), null)
    removed = true; await cache.synchronize()
    assert.equal(await cache.image('img', '1'), null)
    const otherRoot = createCachedDriveLibrary({ ...options, identity: 'other-root' })
    offline = true; await assert.rejects(otherRoot.load(), /offline/)
  } finally { cache.stop(); await rm(directory, { recursive: true, force: true }) }
})

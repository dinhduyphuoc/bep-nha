import test from 'node:test'
import assert from 'node:assert/strict'
import { createImageStore } from '../src/lib/imageStore.js'

test('shares image requests, limits concurrency, retries failure and releases blobs', async () => {
  const originalFetch = globalThis.fetch, originalImage = globalThis.Image
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL
  let active = 0, maximum = 0, count = 0, fail = true
  const calls = [], revoked = []
  globalThis.Image = class { async decode() {} }
  URL.createObjectURL = () => `blob:${++count}`
  URL.revokeObjectURL = url => revoked.push(url)
  globalThis.fetch = async source => {
    calls.push(source); active++; maximum = Math.max(maximum, active)
    await new Promise(resolve => setTimeout(resolve, 5)); active--
    return new Response('image', { status: source === '/retry' && fail ? 404 : 200 })
  }
  const controller = new AbortController()
  const store = createImageStore(controller.signal)
  try {
    const results = await Promise.all([store.load('/same'), store.load('/same'), ...Array.from({ length: 8 }, (_, i) => store.load(`/image-${i}`))])
    assert.equal(results[0], results[1])
    assert.equal(calls.filter(url => url === '/same').length, 1)
    assert(maximum <= 4)
    await assert.rejects(store.load('/retry'))
    fail = false
    assert.match(await store.load('/retry'), /^blob:/)
    store.dispose()
    assert.equal(revoked.length, 10)
  } finally { controller.abort(); store.dispose(); globalThis.fetch = originalFetch; globalThis.Image = originalImage; URL.createObjectURL = create; URL.revokeObjectURL = revoke }
})

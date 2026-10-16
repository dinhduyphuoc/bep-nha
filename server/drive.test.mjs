import test from 'node:test'
import assert from 'node:assert/strict'
import { createDriveLibrary } from './drive.mjs'
import { mergePhotoLibrary } from '../src/lib/photoLibrary.js'

const folder = (id, name) => ({ id, name, mimeType: 'application/vnd.google-apps.folder' })
const photo = (id) => ({ id, name: `${id}.jpg`, mimeType: 'image/jpeg', modifiedTime: '2026-10-12', imageMediaMetadata: { width: 800, height: 1200 } })
const recipes = [{ id: 0, name: 'Phở', driveFolder: 'pho', image: '/demo.svg', gallery: [{ image: '/demo.svg', label: 'Demo' }] }]
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })

test('paginates images, filters non-images, merges albums, refetches additions and deletions', async () => {
  let updated = false
  const calls = []
  const fetchImpl = async url => {
    calls.push(url)
    const q = url.searchParams.get('q')
    if (q.includes("'root'")) return json({ files: [folder('dish', 'pho'), folder('extra', 'gallery')] })
    if (q.includes("'dish'")) {
      if (updated) return json({ files: [photo('new'), folder('dish-gallery', 'gallery')] })
      if (url.searchParams.get('pageToken')) return json({ files: [photo('second')] })
      return json({ files: [photo('first'), { id: 'txt', mimeType: 'text/plain' }, folder('dish-gallery', 'gallery')], nextPageToken: 'page2' })
    }
    if (q.includes("'dish-gallery'")) return json({ files: updated ? [] : [photo('detail')] })
    return json({ files: [photo('event')] })
  }
  const drive = createDriveLibrary({ rootFolderId: 'root', apiKey: 'test-key', recipes, fetchImpl })
  const first = await drive.load()
  assert.deepEqual(first.albums[0].photos.map(p => p.id), ['first', 'second'])
  const view = mergePhotoLibrary(recipes, first)
  assert.deepEqual(view.recipes[0].carouselPhotos.map(p => p.id), ['first', 'second'])
  assert.deepEqual(view.recipes[0].gallery.map(p => p.id), ['detail'])
  assert.deepEqual(view.events.map(p => p.id), ['first', 'second', 'detail', 'event'])
  assert.equal(view.events[0].height, 1200)
  assert.equal(await drive.image('unrelated'), null)
  updated = true
  const second = await drive.load()
  assert.deepEqual(second.albums[0].photos.map(p => p.id), ['new'])
  assert.equal(await drive.image('first'), null)
  assert.equal(await drive.image('detail'), null)
  assert.equal(mergePhotoLibrary(recipes, second).recipes[0].gallery.length, 0)
  assert(calls.every(url => url.searchParams.get('key') === 'test-key'))
})

test('unconfigured demo, missing folders, duplicate folder names, incomplete configuration', async () => {
  assert.deepEqual(await createDriveLibrary({ recipes }).load(), { configured: false })
  const demo = mergePhotoLibrary(recipes, null)
  assert.equal(demo.events.length, 0)
  assert.equal(demo.recipes[0].image, '/dishes/empty.svg')
  assert.deepEqual(demo.recipes[0].gallery, [])
  const missing = await createDriveLibrary({ rootFolderId: 'root', apiKey: 'key', recipes, fetchImpl: async () => json({ files: [] }) }).load()
  assert.deepEqual(missing.missingFolders, ['pho', 'gallery'])
  assert.equal(mergePhotoLibrary(recipes, missing).recipes[0].gallery.length, 0)
  assert.equal(mergePhotoLibrary(recipes, missing).recipes[0].image, '/dishes/empty.svg')
  assert.equal(mergePhotoLibrary(recipes, missing).recipes[0].carouselPhotos.length, 0)
  await assert.rejects(createDriveLibrary({ rootFolderId: 'root', recipes }).load(), /thiếu/)
  await assert.rejects(createDriveLibrary({ rootFolderId: 'root', apiKey: 'key', recipes, fetchImpl: async () => json({ files: [folder('a', 'pho'), folder('b', 'pho')] }) }).load(), /trùng tên/)
})

test('Drive failures are surfaced instead of silently returning an empty album', async () => {
  const drive = createDriveLibrary({ rootFolderId: 'root', apiKey: 'key', recipes, fetchImpl: async () => new Response('', { status: 403 }) })
  await assert.rejects(drive.load(), /HTTP 403/)
})

 test('missing or duplicate nested galleries do not reuse carousel photos', async () => {
  const fetchImpl = async url => json({ files: url.searchParams.get('q').includes("'root'") ? [folder('dish', 'pho')] : [photo('cover')] })
  const result = await createDriveLibrary({ rootFolderId: 'root', apiKey: 'key', recipes, fetchImpl }).load()
  assert(result.missingFolders.includes('pho/gallery'))
  const view = mergePhotoLibrary(recipes, result)
  assert.equal(view.recipes[0].gallery.length, 0)
  assert.equal(view.recipes[0].carouselPhotos.length, 1)
  const duplicate = async url => json({ files: url.searchParams.get('q').includes("'root'") ? [folder('dish', 'pho')] : [folder('g1', 'gallery'), folder('g2', 'gallery')] })
  await assert.rejects(createDriveLibrary({ rootFolderId: 'root', apiKey: 'key', recipes, fetchImpl: duplicate }).load(), /pho\/gallery/)
})

test('empty dish folder can still have gallery photos without using them as its cover', async () => {
  const fetchImpl = async url => {
    const q = url.searchParams.get('q')
    if (q.includes("'root'")) return json({ files: [folder('dish', 'pho')] })
    if (q.includes("'dish'")) return json({ files: [folder('nested', 'gallery')] })
    return json({ files: [photo('detail')] })
  }
  const data = await createDriveLibrary({ rootFolderId: 'root', apiKey: 'key', recipes, fetchImpl }).load()
  const view = mergePhotoLibrary(recipes, data)
  assert.equal(view.recipes[0].image, '/dishes/empty.svg')
  assert.equal(view.recipes[0].carouselPhotos.length, 0)
  assert.deepEqual(view.recipes[0].gallery.map(p => p.id), ['detail'])
  assert.deepEqual(view.events.map(p => p.id), ['detail'])
})

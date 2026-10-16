const FOLDER = 'application/vnd.google-apps.folder'
const ID = /^[a-zA-Z0-9_-]+$/

export function createDriveLibrary({ rootFolderId, apiKey, recipes, fetchImpl = fetch }) {
  let allowedImages = new Map()
  async function request(path, params = {}, resourceKeys = '') {
    const url = new URL(`https://www.googleapis.com/drive/v3/${path}`)
    for (const [key, value] of Object.entries({ ...params, key: apiKey })) url.searchParams.set(key, value)
    const response = await fetchImpl(url, { headers: resourceKeys ? { 'X-Goog-Drive-Resource-Keys': resourceKeys } : {}, signal: AbortSignal.timeout(params.alt === 'media' ? 120000 : 30000), cache: 'no-store' })
    if (!response.ok) throw new Error(`Không thể đọc Google Drive (HTTP ${response.status}). Kiểm tra API key, Drive API và quyền chia sẻ folder.`)
    return response
  }
  async function list(folderId, resourceKey = '') {
    if (!ID.test(folderId)) throw new Error('ID folder không hợp lệ.')
    const files = []
    let pageToken = ''
    do {
      const response = await request('files', {
        q: `'${folderId}' in parents and trashed = false`, pageSize: '1000',
        fields: 'nextPageToken,incompleteSearch,files(id,name,mimeType,resourceKey,modifiedTime,imageMediaMetadata(width,height))',
        orderBy: 'name_natural', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', ...(pageToken ? { pageToken } : {}),
      }, resourceKey ? `${folderId}/${resourceKey}` : '')
      const page = await response.json()
      if (page.incompleteSearch) throw new Error('Drive chưa trả đầy đủ danh sách ảnh. Vui lòng thử lại.')
      files.push(...(page.files || []))
      pageToken = page.nextPageToken || ''
    } while (pageToken)
    return files
  }
  async function load() {
    if (!rootFolderId && !apiKey) return { configured: false }
    if (!rootFolderId || !apiKey) throw new Error('Cấu hình Drive còn thiếu folder gốc hoặc API key.')
    const folders = (await list(rootFolderId)).filter(file => file.mimeType === FOLDER)
    const mappings = [...recipes.map(recipe => ({ name: recipe.driveFolder, dishId: recipe.id, album: recipe.name })), { name: 'gallery', album: 'Ảnh sự kiện' }]
    const nextImages = new Map()
    const missingFolders = []
    const albums = []
    // A bounded sequence avoids bursting the Drive API with one request per image.
    for (const mapping of mappings) {
      const matches = folders.filter(folder => folder.name === mapping.name)
      if (matches.length > 1) throw new Error(`Có nhiều folder trùng tên: ${mapping.name}. Hãy giữ một folder duy nhất.`)
      if (!matches.length) { missingFolders.push(mapping.name); albums.push({ ...mapping, photos: [] }); continue }
      const folder = matches[0]
      const files = await list(folder.id, folder.resourceKey)
      const toPhotos = entries => entries.filter(file => file.mimeType.startsWith('image/')).map(file => {
        const width = file.imageMediaMetadata?.width
        const height = file.imageMediaMetadata?.height
        nextImages.set(file.id, file)
        return { id: file.id, image: `/api/drive/images/${file.id}?v=${encodeURIComponent(file.modifiedTime || '')}`, label: file.name, title: file.name, album: mapping.album, dishId: mapping.dishId, width, height, ratio: width && height ? `${width}:${height}` : null, source: 'drive' }
      })
      const photos = toPhotos(files)
      let galleryPhotos = []
      if (mapping.dishId !== undefined) {
        const galleries = files.filter(file => file.mimeType === FOLDER && file.name === 'gallery')
        if (galleries.length > 1) throw new Error(`Có nhiều folder trùng tên: ${mapping.name}/gallery. Hãy giữ một folder duy nhất.`)
        if (galleries.length) {
          galleryPhotos = toPhotos(await list(galleries[0].id, galleries[0].resourceKey))
        } else missingFolders.push(`${mapping.name}/gallery`)
      }
      albums.push({ ...mapping, photos, galleryPhotos })
    }
    // Publish only a complete snapshot; failures keep the previous image allowlist intact.
    allowedImages = nextImages
    return { configured: true, albums, missingFolders, fetchedAt: new Date().toISOString() }
  }
  async function image(fileId) {
    const file = allowedImages.get(fileId)
    if (!file) return null
    return request(`files/${encodeURIComponent(fileId)}`, { alt: 'media' }, file.resourceKey ? `${fileId}/${file.resourceKey}` : '')
  }
  return { load, image }
}

export function driveMiddleware(library) {
  return async (req, res, next) => {
    const pathname = new URL(req.url, 'http://localhost').pathname
    if (!pathname.startsWith('/api/drive/')) return next()
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return }
    try {
      if (pathname === '/api/drive/library') {
        const result = await library.load()
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(result)); return
      }
      const match = pathname.match(/^\/api\/drive\/images\/([a-zA-Z0-9_-]+)$/)
      if (match) {
        const response = await library.image(match[1], new URL(req.url, 'http://localhost').searchParams.get('v') || '')
        if (!response) { res.writeHead(404); res.end(); return }
        const type = response.headers.get('content-type') || ''
        if (!type.startsWith('image/')) throw new Error('Drive không trả về nội dung hình ảnh.')
        res.setHeader('Content-Type', type)
        if (response.headers.has('Cache-Control')) res.setHeader('Cache-Control', response.headers.get('Cache-Control'))
        if (response.headers.has('ETag')) res.setHeader('ETag', response.headers.get('ETag'))
        res.setHeader('X-Content-Type-Options', 'nosniff')
        // Sandbox uploaded SVGs when opened as standalone documents.
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
        const { Readable } = await import('node:stream')
        Readable.fromWeb(response.body).on('error', () => res.destroy()).pipe(res)
        return
      }
      res.writeHead(404); res.end()
    } catch (error) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: error.message }))
    }
  }
}

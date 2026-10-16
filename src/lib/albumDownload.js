// Store images without compression: photos are already compressed.
export async function createPhotoZip(files) {
  const parts = [], directory = []
  let offset = 0, directorySize = 0
  for (const file of files) {
    const name = new TextEncoder().encode(file.name)
    const bytes = new Uint8Array(await file.arrayBuffer())
    let crc = 0xffffffff
    for (const byte of bytes) {
      crc ^= byte
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
    }
    crc = (crc ^ 0xffffffff) >>> 0
    const header = new Uint8Array(30 + name.length)
    const local = new DataView(header.buffer)
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, 0x0800, true)
    local.setUint16(12, 33, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, bytes.length, true)
    local.setUint32(22, bytes.length, true)
    local.setUint16(26, name.length, true)
    header.set(name, 30)
    const entry = new Uint8Array(46 + name.length)
    const central = new DataView(entry.buffer)
    central.setUint32(0, 0x02014b50, true)
    central.setUint16(4, 20, true)
    central.setUint16(6, 20, true)
    central.setUint16(8, 0x0800, true)
    central.setUint16(14, 33, true)
    central.setUint32(16, crc, true)
    central.setUint32(20, bytes.length, true)
    central.setUint32(24, bytes.length, true)
    central.setUint16(28, name.length, true)
    central.setUint32(42, offset, true)
    entry.set(name, 46)
    parts.push(header, bytes)
    directory.push(entry)
    offset += header.length + bytes.length
    directorySize += entry.length
  }
  const end = new Uint8Array(22)
  const view = new DataView(end.buffer)
  view.setUint32(0, 0x06054b50, true)
  view.setUint16(8, files.length, true)
  view.setUint16(10, files.length, true)
  view.setUint32(12, directorySize, true)
  view.setUint32(16, offset, true)
  return new Blob([...parts, ...directory, end], { type: 'application/zip' })
}

export async function preparePhoto(photo, index, name, store) {
  const url = store ? await store.load(photo.image) : photo.image
  const response = await fetch(url)
  if (!response.ok) throw new Error('Không tải được ảnh')
  const blob = await response.blob()
  const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif', 'image/heic': 'heic', 'image/svg+xml': 'svg' }
  if (!blob.type.startsWith('image/')) throw new Error('Tệp không phải hình ảnh')
  const safeName = Array.from(name, char => char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? '-' : char).join('').slice(0, 80) || 'album'
  return new File([blob], `${safeName}-${index + 1}.${extensions[blob.type] || 'img'}`, { type: blob.type })
}

export function createImageStore(signal) {
  const pending = new Map()
  const urls = new Set()
  const queue = []
  let active = 0
  function acquire() {
    if (active < 4) { active++; return Promise.resolve() }
    return new Promise(resolve => queue.push(resolve))
  }
  function release() {
    if (queue.length) queue.shift()()
    else active--
  }
  function load(source) {
    if (source.startsWith('blob:')) return Promise.resolve(source)
    if (pending.has(source)) return pending.get(source)
    const request = (async () => {
      let url
      await acquire()
      try {
        signal.throwIfAborted()
        const response = await fetch(source, { signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]), cache: 'default' })
        if (!response.ok) throw new Error('Image unavailable')
        const blob = await response.blob()
        signal.throwIfAborted()
        url = URL.createObjectURL(blob)
        urls.add(url)
        const image = new Image()
        image.src = url
        await image.decode()
        signal.throwIfAborted()
        return url
      } catch (error) {
        if (url) { URL.revokeObjectURL(url); urls.delete(url) }
        pending.delete(source)
        throw error
      } finally { release() }
    })()
    pending.set(source, request)
    return request
  }
  return { load, dispose() { urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); pending.clear() } }
}

import { useEffect, useRef, useState } from 'react'

export default function LazyPhoto({ src, alt, store, eager = false, enabled = true, className = '', ratio = '1 / 1', onOpen, retry = true }) {
  const frame = useRef(null)
  const [visible, setVisible] = useState(eager)
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState(null)
  const [failure, setFailure] = useState(null)
  const result = loaded?.src === src && loaded?.store === store ? loaded.url : null
  const failed = failure?.src === src && failure?.store === store
  useEffect(() => {
    if (eager) { setVisible(true); return }
    if (!('IntersectionObserver' in window)) { setVisible(true); return }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect() }
    }, { rootMargin: '200px' })
    if (frame.current) observer.observe(frame.current)
    return () => observer.disconnect()
  }, [eager])
  useEffect(() => {
    // Leaving the preload window must never clear an already decoded image.
    if (result || !visible || !enabled || !store) return
    let cancelled = false
    setFailure(null)
    store.load(src)
      .then(url => { if (!cancelled) setLoaded({ src, store, url }) })
      .catch(() => { if (!cancelled) setFailure({ src, store }) })
    return () => { cancelled = true }
  }, [src, visible, enabled, store, attempt, result])
  return <div ref={frame} className={`lazy-photo ${result ? 'is-ready' : ''} ${failed ? 'is-failed' : ''}`} style={{ aspectRatio: ratio }} aria-busy={!result && !failed}>
    {result ? <img src={result} alt={alt} className={className} onClick={onOpen ? () => onOpen(result) : undefined} role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined} onKeyDown={onOpen ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(result) } } : undefined} /> : failed ? <div className="photo-failure"><img src="/dishes/empty.svg" alt="Ảnh không tải được" />{retry && <button onClick={e => { e.stopPropagation(); setAttempt(value => value + 1) }}>Thử lại</button>}</div> : <span className="photo-skeleton-label">Đang tải hình...</span>}
  </div>
}

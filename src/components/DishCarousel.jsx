import { useEffect, useRef, useState } from 'react'
import LazyPhoto from './LazyPhoto'

export default function DishCarousel({ dish, store, enabled = true }) {
  const photos = dish.carouselPhotos || []
  const track = useRef(null)
  const dialog = useRef(null)
  const pausedUntil = useRef(0)
  const [current, setCurrent] = useState(0)
  const [albumOpen, setAlbumOpen] = useState(false)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (photos.length < 2) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const timer = window.setInterval(() => {
      if (paused || reduced.matches || document.hidden || Date.now() < pausedUntil.current || !window.matchMedia('(max-width: 440px)').matches) return
      const node = track.current
      if (!node || photos.length < 2) return
      const index = Math.round(node.scrollLeft / node.clientWidth)
      node.scrollTo({ left: ((index + 1) % photos.length) * node.clientWidth, behavior: 'smooth' })
    }, 2000)
    return () => window.clearInterval(timer)
  }, [paused, photos.length])

  function pauseForSwipe() { pausedUntil.current = Date.now() + 8000 }
  function closeGallery() { dialog.current.close(); setPaused(false); setAlbumOpen(false) }

  if (!photos.length) return <div className="empty-dish-photo"><img src={dish.image} alt="Món ăn hiện chưa có ảnh" /><p>hiện chưa có ảnh</p></div>

  return (
    <div className="dish-outlet-carousel">
      <div className="outlet-track" ref={track} role="region" aria-label={`Ảnh ${dish.name}, vuốt để xem`} tabIndex={0}
        onPointerDown={pauseForSwipe} onTouchStart={pauseForSwipe}
        onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
        onScroll={() => { const node = track.current; setCurrent(Math.round(node.scrollLeft / node.clientWidth)) }}
        onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); pauseForSwipe(); track.current.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * track.current.clientWidth, behavior: 'smooth' }) } }}>
        {photos.map((photo, i) => <div className="outlet-slide" key={i}><LazyPhoto src={photo.image} alt={`${dish.name} — ${photo.label}`} store={store} enabled={enabled && (i === current || i === (current + 1) % photos.length || i === (current + 2) % photos.length)} eager className={`outlet-crop-${photo.crop ?? 0}`} /></div>)}
      </div>
      <div className="outlet-photo-controls"><span className="outlet-dots" aria-label={`Ảnh ${current + 1} trên ${photos.length}`}>{photos.map((_, i) => <span key={i} className={current === i ? 'active' : ''} />)}</span><button onClick={() => { setPaused(true); setAlbumOpen(true); dialog.current.showModal() }}>Xem tất cả ảnh ({photos.length})</button></div>
      <dialog className="all-dish-photos" ref={dialog} onCancel={() => {setPaused(false);setAlbumOpen(false)}} onClose={() => {setPaused(false);setAlbumOpen(false)}} onClick={e => { if (e.target === dialog.current) closeGallery() }}>
        <div className="all-photos-header"><div><span>ALBUM MÓN ĂN</span><h3>{dish.name}</h3></div><button autoFocus onClick={closeGallery} aria-label="Đóng tất cả ảnh">✕</button></div>
        <div className="all-photos-scroll-content">
        <div className="all-photos-list">{photos.map((photo, i) => <figure key={i}><div><LazyPhoto src={photo.image} alt={`${dish.name} — ${photo.label}`} store={store} enabled={enabled && albumOpen} className={`outlet-crop-${photo.crop ?? 0}`} /></div></figure>)}</div>
        <p className="image-note">{`${photos.length} ảnh của ${dish.name}.`}</p>
        </div>
      </dialog>
    </div>
  )
}

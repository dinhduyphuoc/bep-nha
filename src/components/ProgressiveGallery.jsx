import LazyPhoto from './LazyPhoto'

export default function ProgressiveGallery({ photos, store, onSelect, aggregate = false, enabled = true, selecting = false, selected = [], saving = false, onToggle }) {
  if (!photos.length) return <p className="empty-photos">hiện chưa có ảnh</p>

  function renderPhoto(photo, index) {
    const title = photo.title || photo.label
    const ratio = photo.width && photo.height ? `${photo.width} / ${photo.height}` : '1 / 1'
    return <div className={`${aggregate ? 'event-photo' : 'gallery-photo'}${selected.includes(index) ? ' album-photo-selected' : ''}`} key={photo.id || index}>
      <LazyPhoto src={photo.image} alt={title} store={store} enabled={enabled} ratio={aggregate ? ratio : '4 / 3'} className={`gallery-crop crop-${photo.crop ?? 0}`} onOpen={selecting ? undefined : image => onSelect({ ...photo, image })} />
      {selecting && <button type="button" className="album-photo-toggle" aria-label={`Chọn ảnh ${index + 1}: ${title || 'Ảnh sự kiện'}`} aria-pressed={selected.includes(index)} disabled={saving} onClick={() => onToggle(index)}><span aria-hidden="true">{selected.includes(index) ? '✓' : ''}</span></button>}
    </div>
  }

  if (aggregate) return <div className="events-masonry">
    {[0, 1].map(column => <div className="events-column" key={column}>
      {photos.map((photo, index) => index % 2 === column ? renderPhoto(photo, index) : null)}
    </div>)}
  </div>

  return <div className="gallery">{photos.map(renderPhoto)}</div>
}

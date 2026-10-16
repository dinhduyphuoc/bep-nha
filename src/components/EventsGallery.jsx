import { useRef, useState } from 'react'
import ProgressiveGallery from './ProgressiveGallery'
import { createPhotoZip, preparePhoto } from '../lib/albumDownload'

export default function EventsGallery({ photos, store, enabled, onSelect }) {
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState([])
  const [prepared, setPrepared] = useState({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [downloadOnly, setDownloadOnly] = useState(false)
  const session = useRef(0)
  const selectedFiles = selected.map(index => prepared[index]).filter(Boolean)
  const ready = selected.length > 0 && selectedFiles.length === selected.length

  function resetSelection() {
    session.current++
    setSelecting(false); setSelected([]); setPrepared({}); setSaving(false); setMessage(''); setDownloadOnly(false)
  }

  function togglePhoto(index) {
    if (saving) return
    setMessage('')
    if (selected.includes(index)) { setSelected(selected.filter(value => value !== index)); return }
    setSelected([...selected, index])
    if (prepared[index]) return
    const token = session.current
    preparePhoto(photos[index], index, 'Ảnh sự kiện', store).then(file => {
      if (session.current === token) setPrepared(previous => ({ ...previous, [index]: file }))
    }).catch(() => {
      if (session.current !== token) return
      setSelected(previous => previous.filter(value => value !== index))
      setMessage(`Không tải được ảnh ${index + 1}. Bạn có thể chọn lại để thử.`)
    })
  }

  async function savePhotos() {
    if (!ready || saving) return
    const token = session.current
    setSaving(true); setMessage('')
    try {
      if (!downloadOnly && navigator.canShare?.({ files: selectedFiles }) && navigator.share) {
        await navigator.share({ files: selectedFiles })
        if (session.current === token) setMessage('Đã mở bảng chia sẻ. Chọn nơi lưu ảnh trên thiết bị.')
      } else {
        const blob = selectedFiles.length === 1 ? selectedFiles[0] : await createPhotoZip(selectedFiles)
        if (session.current !== token) return
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = selectedFiles.length === 1 ? selectedFiles[0].name : 'album-anh.zip'
        document.body.append(link); link.click(); link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 60000)
        setMessage(selectedFiles.length === 1 ? 'Đã gửi yêu cầu tải ảnh.' : 'Đã gửi yêu cầu tải file ZIP chứa các ảnh đã chọn.')
      }
    } catch (error) {
      if (session.current === token && error.name !== 'AbortError') {
        setDownloadOnly(true)
        setMessage('Không mở được bảng chia sẻ. Nhấn Lưu lần nữa để tải ảnh về máy.')
      }
    } finally { if (session.current === token) setSaving(false) }
  }

  return <div className={selecting ? 'events-selection-active' : undefined}>
    <div className="events-summary album-toolbar"><span>{photos.length} ảnh</span><button type="button" disabled={!enabled || !photos.length || selecting} onClick={() => { resetSelection(); setSelecting(true) }}>Chọn hình ảnh</button></div>
    <ProgressiveGallery photos={photos} store={store} enabled={enabled} aggregate onSelect={onSelect}
      selecting={selecting} selected={selected} saving={saving} onToggle={togglePhoto} />
    {selecting && <div className="album-save-panel events-save-panel">
      <p className="album-save-message" role="status">{message || (selected.length && !ready ? 'Đang chuẩn bị ảnh…' : 'Chọn ảnh bạn muốn lưu.')}</p>
      <div className="album-save-actions"><button type="button" disabled={saving} onClick={resetSelection}>Huỷ</button><button type="button" disabled={!ready || saving} onClick={savePhotos}>{saving ? 'Đang lưu…' : `Lưu ${selected.length} ảnh`}</button></div>
    </div>}
  </div>
}

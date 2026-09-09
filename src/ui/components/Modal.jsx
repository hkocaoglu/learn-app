export default function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={wide ? { maxWidth: 820 } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="page-head" style={{ marginBottom: 10 }}>
          <h2>{title}</h2>
          <button className="btn btn-sm" onClick={onClose}>
            ✕ Kapat
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

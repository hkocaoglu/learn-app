import { Component } from 'react'

// Render hatalarında tüm ağacı boşaltmak yerine hata kartı gösterir.
// (Örn. bozuk soru verisi → React #31 → eskiden tamamen boş ekran.)
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('UI render hatası:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card empty">
          <h2>Beklenmeyen bir hata oluştu</h2>
          <p className="small">{String(this.state.error?.message || this.state.error)}</p>
          <div className="row-actions mt-8" style={{ justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                this.setState({ error: null })
                window.location.hash = '#/'
              }}
            >
              Ana sayfaya dön
            </button>
            <button className="btn" type="button" onClick={() => window.location.reload()}>
              Sayfayı yenile
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

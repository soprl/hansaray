import { Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className='rounded-xl border border-rose-300 bg-rose-50 px-4 py-4 text-sm text-rose-900'>
          <p className='font-semibold'>Form yüklenirken bir hata oluştu.</p>
          <p className='mt-2 text-xs text-rose-800'>
            Tarihleri değiştirip tekrar deneyin. Sorun sürerse sayfayı yenileyin.
          </p>
          <button
            type='button'
            className='mt-3 rounded-lg border border-rose-400 bg-white px-3 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-100'
            onClick={() => this.setState({ error: null })}
          >
            Tekrar dene
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

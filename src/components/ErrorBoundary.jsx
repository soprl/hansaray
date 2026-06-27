import { Component, cloneElement, isValidElement } from 'react'
import { ACTIVE_ROOMS, getRoomDisplayName, isRoomBookable, isVipRoom } from '../config/rooms'

function RoomsFullFallback({ onRetry, title = 'Yeni Rezervasyon' }) {
  const bookableRooms = ACTIVE_ROOMS.filter((roomName) => isRoomBookable(roomName))

  return (
    <section className='card space-y-4'>
      <h2 className='text-lg font-semibold text-blue-950'>{title}</h2>

      <div
        className='rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm text-rose-800'
        role='alert'
      >
        <p className='font-semibold text-rose-700'>
          Bu tarihlerde tüm odalar dolu. Lütfen başka tarih seçin.
        </p>
        <p className='mt-1.5 text-xs leading-relaxed text-rose-700/90'>
          Seçilen aralıkta müsait standart oda kalmadı veya taşımayla yer açılamıyor. V.I.P
          misafirler taşınmaz.
        </p>
      </div>

      <div>
        <p className='mb-3 text-sm font-semibold text-slate-800'>Odalar — seçilen tarihler</p>
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6'>
          {bookableRooms.map((roomName) => {
            const vip = isVipRoom(roomName)
            return (
              <div
                key={roomName}
                className='cursor-not-allowed rounded-xl border-2 border-rose-200 bg-rose-50/80 p-3 text-left sm:p-4'
              >
                <p
                  className={`text-base font-bold sm:text-lg ${vip ? 'text-amber-900' : 'text-blue-950'}`}
                >
                  {getRoomDisplayName(roomName)}
                </p>
                <p className='mt-1 text-[11px] font-semibold text-rose-700 sm:text-xs'>Dolu</p>
              </div>
            )
          })}
        </div>
      </div>

      <button
        type='button'
        className='rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50'
        onClick={onRetry}
      >
        Başka tarih seç
      </button>
    </section>
  )
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, retryKey: 0 }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary:', error, info)
  }

  handleRetry = () => {
    this.props.onRetry?.()
    this.setState((prev) => ({ error: null, retryKey: prev.retryKey + 1 }))
  }

  render() {
    if (this.state.error) {
      if (this.props.variant === 'roomsFull') {
        return (
          <RoomsFullFallback onRetry={this.handleRetry} title={this.props.formTitle} />
        )
      }

      return (
        <div className='rounded-xl border border-rose-300 bg-rose-50 px-4 py-4 text-sm text-rose-900'>
          <p className='font-semibold'>Form yüklenirken bir hata oluştu.</p>
          <p className='mt-2 text-xs text-rose-800'>
            Tarihleri değiştirip tekrar deneyin. Sorun sürerse sayfayı yenileyin.
          </p>
          <button
            type='button'
            className='mt-3 rounded-lg border border-rose-400 bg-white px-3 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-100'
            onClick={this.handleRetry}
          >
            Tekrar dene
          </button>
        </div>
      )
    }

    const { children } = this.props
    if (isValidElement(children)) {
      return cloneElement(children, { key: `retry-${this.state.retryKey}` })
    }

    return children
  }
}

export default ErrorBoundary

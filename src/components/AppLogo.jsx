function AppLogo({ className = 'h-10 w-10', showText = false, textClassName = 'text-base font-semibold text-white' }) {
  return (
    <div className='flex items-center gap-2.5'>
      <img src='/logo.png' alt='Hansaray' className={`${className} shrink-0 rounded-xl object-contain`} />
      {showText ? <span className={textClassName}>Hansaray</span> : null}
    </div>
  )
}

export default AppLogo

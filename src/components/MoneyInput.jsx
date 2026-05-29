import { formatMoneyInputDisplay, parseMoneyInput } from '../utils/moneyInput'

function MoneyInput({
  name,
  value,
  onChange,
  className = 'input',
  placeholder = '0',
  disabled = false,
  id,
}) {
  const handleChange = (event) => {
    const parsed = parseMoneyInput(event.target.value)
    onChange(name, parsed)
  }

  return (
    <input
      id={id}
      type='text'
      inputMode='decimal'
      autoComplete='off'
      name={name}
      className={className}
      value={formatMoneyInputDisplay(value)}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
    />
  )
}

export default MoneyInput

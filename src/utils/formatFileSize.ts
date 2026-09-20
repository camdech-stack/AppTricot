const UNITS = ['o', 'Ko', 'Mo', 'Go']

// French-style byte size formatting ("2,4 Mo") — used by the pattern detail
// page and the storage usage line in Settings.
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 o'
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const decimals = unitIndex === 0 || Number.isInteger(value) ? 0 : value < 10 ? 1 : 0
  return `${value.toFixed(decimals).replace('.', ',')} ${UNITS[unitIndex]}`
}

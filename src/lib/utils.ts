import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** A package price of 0 means it hasn't been set yet. */
export function formatPackagePrice(currency: string, amount: number) {
  return amount ? `${currency} ${amount.toLocaleString()}` : 'TBA'
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** A Date as an `<input type="date">` value (YYYY-MM-DD, local time). */
export function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** 12-hour time in the device's timezone, with its abbreviation (2:05 pm AEDT). */
export function formatDeviceTime(date: Date) {
  const { timeZone } = Intl.DateTimeFormat().resolvedOptions()
  // Browsers only name a zone for its home locale, so a US-English device in Sydney would get GMT+11.
  // shortcut: only Australia and the Philippines get names, other zones may show GMT+N; add them here if needed.
  const locale = timeZone.startsWith('Australia/') ? 'en-AU' : undefined
  const time = date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' })
  return timeZone === 'Asia/Manila' ? time.replace('GMT+8', 'PHT') : time
}

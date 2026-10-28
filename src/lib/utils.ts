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

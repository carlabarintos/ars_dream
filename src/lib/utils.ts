import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** A package price of 0 means it hasn't been set yet. */
export function formatPackagePrice(currency: string, amount: number) {
  return amount ? `${currency} ${amount.toLocaleString()}` : 'TBA'
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

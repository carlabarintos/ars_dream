import { cn } from '@/lib/utils'

/** A minimal race-bib glyph — pinned tag with a numbered center — for places that need a
 * compact bib mark rather than the full odometer-style BibCard (e.g. the inline spinner). */
export function BibIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('overflow-visible', className)}
    >
      <rect x="4" y="6" width="16" height="15" rx="2" />
      <circle cx="8" cy="6" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="16" cy="6" r="1.4" fill="currentColor" stroke="none" />
      <line x1="4" y1="11" x2="20" y2="11" />
      <line x1="8.5" y1="16" x2="8.5" y2="16.01" />
      <line x1="12" y1="16" x2="12" y2="16.01" />
      <line x1="15.5" y1="16" x2="15.5" y2="16.01" />
    </svg>
  )
}

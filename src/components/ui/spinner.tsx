import { cn } from '@/lib/utils'
import { BibIcon } from '@/components/BibIcon'
import { BibCard } from '@/components/BibCard'

const SIZE_CLASSES = {
  sm: 'size-4',
  default: 'size-6',
  lg: 'size-10',
} as const

export function Spinner({
  size = 'default',
  className,
}: {
  size?: keyof typeof SIZE_CLASSES
  className?: string
}) {
  return (
    <span role="status" aria-label="Loading" className={cn('text-primary inline-block', className)}>
      <BibIcon className={cn('animate-bib-swing', SIZE_CLASSES[size])} />
    </span>
  )
}

export function PageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex min-h-svh flex-col items-center justify-center gap-6">
      <BibCard />
      <p className="text-muted-foreground text-sm" aria-hidden="true">
        {label}
      </p>
    </div>
  )
}

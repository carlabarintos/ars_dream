import { cn } from '@/lib/utils'
import { BibIcon } from '@/components/BibIcon'
import { BibCard, MiniBibCard } from '@/components/BibCard'

export function Spinner({
  size = 'default',
  className,
}: {
  size?: 'sm' | 'default' | 'lg'
  className?: string
}) {
  return (
    <span role="status" aria-label="Loading" className={cn('text-primary inline-block', className)}>
      {size === 'sm' ? <BibIcon className="animate-bib-swing size-4" /> : <MiniBibCard size={size} />}
    </span>
  )
}

export function PageSpinner({ label = 'Warming up…' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex min-h-svh flex-col items-center justify-center gap-6">
      <BibCard />
      <p className="text-muted-foreground text-sm" aria-hidden="true">
        {label}
      </p>
    </div>
  )
}

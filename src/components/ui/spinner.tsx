import { cn } from '@/lib/utils'
import { RunnerIcon } from '@/components/RunnerIcon'

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
      <RunnerIcon className={cn('animate-runner', SIZE_CLASSES[size])} />
    </span>
  )
}

export function PageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3">
      <Spinner size="lg" />
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  )
}

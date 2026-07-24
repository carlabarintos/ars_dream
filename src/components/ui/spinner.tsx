import { cn } from '@/lib/utils'

const SIZE_CLASSES = {
  sm: 'text-base',
  default: 'text-xl',
  lg: 'text-4xl',
} as const

export function Spinner({
  size = 'default',
  className,
}: {
  size?: keyof typeof SIZE_CLASSES
  className?: string
}) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn('animate-runner inline-block leading-none select-none', SIZE_CLASSES[size], className)}
    >
      🏃
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

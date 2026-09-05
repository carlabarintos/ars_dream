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

/** One column of a race-bib number: an endless 0-9 reel, each column spinning at its own
 * speed (like a mechanical odometer) so the number never visibly settles while loading. */
function BibDigitReel({ duration, delay }: { duration: string; delay: string }) {
  return (
    <div className="h-[46px] w-[27px] overflow-hidden" aria-hidden="true">
      <div className="animate-bib-roll flex flex-col" style={{ animationDuration: duration, animationDelay: delay }}>
        {DIGIT_REEL.map((digit, i) => (
          <div
            key={i}
            className="text-card-foreground font-mono flex h-[46px] items-center justify-center text-[34px] font-bold"
          >
            {digit}
          </div>
        ))}
      </div>
    </div>
  )
}

const DIGIT_REEL = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

// Rightmost column spins fastest, like the ones place on a real odometer.
const BIB_REELS = [
  { duration: '4.7s', delay: '-1.1s' },
  { duration: '2.6s', delay: '-0.3s' },
  { duration: '1.4s', delay: '-0.9s' },
  { duration: '0.8s', delay: '-0.5s' },
]

function BibCard() {
  return (
    <div className="border-border bg-card relative w-[210px] -rotate-3 rounded-[10px] border p-5 pt-6 shadow-lg">
      <span className="bg-primary absolute inset-x-4 top-0 h-1 rounded-b-[3px]" />
      <span
        className="bg-background absolute top-3 left-4 size-2 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]"
        aria-hidden="true"
      />
      <span
        className="bg-background absolute top-3 right-4 size-2 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]"
        aria-hidden="true"
      />
      <p className="text-primary mt-2 mb-2.5 text-center font-mono text-[8.5px] tracking-[0.14em] uppercase">
        Marathon Tour · Official Entry
      </p>
      <div className="border-border mb-2.5 flex justify-center gap-1 border-b pb-2.5">
        {BIB_REELS.map((reel, i) => (
          <BibDigitReel key={i} {...reel} />
        ))}
      </div>
      <p className="text-muted-foreground font-display text-center text-[13px] tracking-[0.08em]">ARS DREAM</p>
    </div>
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

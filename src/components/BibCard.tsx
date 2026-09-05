import { cn } from '@/lib/utils'

/** One column of a race-bib number: an endless 0-9 reel, each column spinning at its own
 * speed (like a mechanical odometer) so the number never visibly settles. `height` also
 * drives the reel's scroll distance (10 digits' worth), so it stays seamless at any size. */
function BibDigitReel({
  duration,
  delay,
  width = 27,
  height = 46,
  fontSize = 34,
}: {
  duration: string
  delay: string
  width?: number
  height?: number
  fontSize?: number
}) {
  return (
    <div className="overflow-hidden" style={{ width, height }} aria-hidden="true">
      <div
        className="animate-bib-roll flex flex-col"
        style={{ animationDuration: duration, animationDelay: delay, ['--bib-roll-distance' as string]: `${-height * 10}px` }}
      >
        {DIGIT_REEL.map((digit, i) => (
          <div
            key={i}
            className="text-card-foreground font-mono flex items-center justify-center font-bold"
            style={{ height, fontSize }}
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

/** The race-bib number card used by the loading spinner — a bib pinned at both corners,
 * with a mechanical odometer reel where the runner's number would be. Reused decoratively
 * wherever the brand wants that same tactile, "official entry" touch. */
export function BibCard({ className }: { className?: string }) {
  return (
    <div className={cn('border-border bg-card relative w-[210px] -rotate-3 rounded-[10px] border p-5 pt-6 shadow-lg', className)}>
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

const MINI_REELS = [
  { duration: '2.1s', delay: '-0.6s' },
  { duration: '1.2s', delay: '-0.2s' },
  { duration: '0.7s', delay: '-0.4s' },
]

const MINI_SIZE_CONFIG = {
  default: { reelWidth: 12, reelHeight: 19, fontSize: 14 },
  lg: { reelWidth: 15, reelHeight: 24, fontSize: 18 },
} as const

/** A pocket-sized BibCard for inline loading states — same pinned-tag, rolling-digit look,
 * scaled down and stripped of the footer copy so it stays legible at icon-adjacent sizes. */
export function MiniBibCard({
  size = 'default',
  className,
}: {
  size?: keyof typeof MINI_SIZE_CONFIG
  className?: string
}) {
  const { reelWidth, reelHeight, fontSize } = MINI_SIZE_CONFIG[size]
  return (
    <div
      className={cn(
        'border-border bg-card relative inline-block -rotate-3 rounded-md border p-2 shadow-md',
        className,
      )}
    >
      <span className="bg-primary absolute inset-x-2 top-0 h-[3px] rounded-b-[2px]" />
      <span
        className="bg-background absolute top-1 left-1.5 size-1 rounded-full shadow-[inset_0_1px_1px_rgba(0,0,0,0.3)]"
        aria-hidden="true"
      />
      <span
        className="bg-background absolute top-1 right-1.5 size-1 rounded-full shadow-[inset_0_1px_1px_rgba(0,0,0,0.3)]"
        aria-hidden="true"
      />
      <div className="mt-1.5 flex justify-center gap-0.5">
        {MINI_REELS.map((reel, i) => (
          <BibDigitReel key={i} {...reel} width={reelWidth} height={reelHeight} fontSize={fontSize} />
        ))}
      </div>
    </div>
  )
}

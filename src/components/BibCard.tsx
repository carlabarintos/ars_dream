import { cn } from '@/lib/utils'

/** One column of a race-bib number: an endless 0-9 reel, each column spinning at its own
 * speed (like a mechanical odometer) so the number never visibly settles. */
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

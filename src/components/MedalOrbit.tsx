import { BibCard } from '@/components/BibCard'
import { MedalIcon, type MedalCity } from '@/components/MedalIcon'
import { cn } from '@/lib/utils'

const CITIES: MedalCity[] = ['new-york', 'berlin', 'london', 'tokyo', 'sydney']

/** Five finisher medals circling the bib: the five majors, one booking. Spin is gated on
 * reduced motion in index.css (.animate-orbit). Size via `--r` (orbit radius) and the box size. */
export function MedalOrbit({ className }: { className?: string }) {
  return (
    <div className={cn('relative mx-auto size-[300px] [--r:130px] sm:size-[440px] sm:[--r:195px]', className)} aria-hidden="true">
      <div className="absolute inset-0 rounded-full border border-dashed border-white/20" />
      <div className="absolute inset-[18%] rounded-full border border-white/10" />
      <div className="animate-orbit absolute inset-0">
        {CITIES.map((city, i) => (
          <div
            key={city}
            className="absolute top-1/2 left-1/2 -mt-9 -ml-7 w-14 sm:-mt-11 sm:-ml-8 sm:w-16"
            style={{ transform: `rotate(${i * 72}deg) translateY(calc(var(--r) * -1)) rotate(${-i * 72}deg)` }}
          >
            <div className="animate-orbit-reverse">
              <MedalIcon city={city} className="drop-shadow-lg" />
            </div>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="animate-bib-float">
          <BibCard className="scale-75 sm:scale-90" />
        </div>
      </div>
    </div>
  )
}

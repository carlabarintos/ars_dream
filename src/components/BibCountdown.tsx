import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

interface CountdownParts {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function getCountdownParts(target: Date): CountdownParts | null {
  const diffMs = target.getTime() - Date.now()
  if (diffMs <= 0) return null
  const totalSeconds = Math.floor(diffMs / 1000)
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  }
}

/** Ticks every second toward `target`, keyed off its epoch ms so an inline `new Date()`
 * passed in on every render doesn't restart the interval. */
function useCountdown(target: Date) {
  const targetMs = target.getTime()
  const [parts, setParts] = useState(() => getCountdownParts(target))

  useEffect(() => {
    const tick = () => setParts(getCountdownParts(new Date(targetMs)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetMs])

  return parts
}

function pad(value: number) {
  return value.toString().padStart(2, '0')
}

/** One ticking digit pair — remounted (via `key`) on every value change so the roll-in
 * animation replays on each tick, like a mechanical odometer advancing. */
function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="h-[15px] overflow-hidden">
        <span key={value} className="animate-bib-tick block font-mono text-[13px] font-bold text-white tabular-nums">
          {pad(value)}
        </span>
      </div>
      <span className="text-[6.5px] font-semibold tracking-wider text-white/60 uppercase">{label}</span>
    </div>
  )
}

/** Race-bib-styled ticking countdown to a marathon's event date, meant to sit as a corner
 * tag on a booking card's banner. Echoes BibCard's pinned, mechanical-odometer look but
 * drives real day/hour/minute/second values instead of a decorative infinite spin. Renders
 * nothing once the target date has passed. */
export function BibCountdown({ target, className }: { target: Date; className?: string }) {
  const parts = useCountdown(target)
  if (!parts) return null

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-lg border border-primary/60 bg-black/55 px-2 py-1.5 backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex flex-col items-center border-r border-white/20 pr-1.5">
        <span className="font-display text-lg leading-none text-white tabular-nums">{parts.days}</span>
        <span className="text-[6.5px] font-semibold tracking-wider text-white/60 uppercase">
          {parts.days === 1 ? 'day' : 'days'}
        </span>
      </div>
      <CountdownUnit value={parts.hours} label="hrs" />
      <span className="text-xs font-bold text-white/40">:</span>
      <CountdownUnit value={parts.minutes} label="min" />
      <span className="text-xs font-bold text-white/40">:</span>
      <CountdownUnit value={parts.seconds} label="sec" />
    </div>
  )
}

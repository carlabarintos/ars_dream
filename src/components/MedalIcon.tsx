import type { CSSProperties } from 'react'

import { cn } from '@/lib/utils'

export type MedalCity = 'new-york' | 'berlin' | 'london' | 'tokyo' | 'sydney'

interface MedalTheme {
  label: string
  ribbon: string
  ribbonShadow: string
  disc: string
  rim: string
  /** Abstract landmark glyph traced inside the disc — a nod to each city's skyline, not any
   * race's official medal art (which is trademarked by its organizer). */
  glyph: string
}

const MEDAL_THEMES: Record<MedalCity, MedalTheme> = {
  'new-york': {
    label: 'New York',
    ribbon: '#1E3A8A',
    ribbonShadow: '#152a63',
    disc: '#0B1F3F',
    rim: '#F97316',
    glyph: 'M32 92 L32 78 L38 78 L38 70 L44 70 L44 82 L50 82 L50 66 L56 66 L56 92 Z M58 92 Q66 76 68 92',
  },
  berlin: {
    label: 'Berlin',
    ribbon: '#151515',
    ribbonShadow: '#000000',
    disc: '#7A1420',
    rim: '#D4A017',
    glyph: 'M33 92 L33 68 M41 92 L41 68 M50 92 L50 68 M59 92 L59 68 M67 92 L67 68 M31 68 L69 68 L69 63 L31 63 Z',
  },
  london: {
    label: 'London',
    ribbon: '#C8102E',
    ribbonShadow: '#8c0b21',
    disc: '#00247D',
    rim: '#F5F5F5',
    glyph: 'M37 92 L37 62 L33 62 M37 66 L41 66 M63 92 L63 62 L67 62 M63 66 L59 66 M37 74 L63 74 M45 92 L45 78 Q50 71 55 78 L55 92',
  },
  tokyo: {
    label: 'Tokyo',
    ribbon: '#BC002D',
    ribbonShadow: '#7c0020',
    disc: '#1A1A1A',
    rim: '#E5E5E5',
    glyph: 'M31 70 L69 70 M34 65 L66 65 M40 70 L40 92 M60 70 L60 92 M40 79 L60 79',
  },
  sydney: {
    label: 'Sydney',
    ribbon: '#00843D',
    ribbonShadow: '#00301a',
    disc: '#00512E',
    rim: '#D4AF37',
    glyph: 'M31 92 Q40 66 49 92 M41 92 Q50 70 59 92 M51 92 Q60 66 69 92',
  },
}

export const MEDAL_CITIES = Object.keys(MEDAL_THEMES) as MedalCity[]

/** A decorative "finisher medal" for one of the five majors — flag-inspired ribbon colors and
 * an abstract landmark glyph, drawn in the same thin line-art style as RouteLines/BibCard.
 * Purely brand illustration, not a reproduction of any race's actual medal design. */
export function MedalIcon({
  city,
  showLabel = false,
  className,
  style,
}: {
  city: MedalCity
  showLabel?: boolean
  className?: string
  style?: CSSProperties
}) {
  const theme = MEDAL_THEMES[city]

  return (
    <div className={cn('flex flex-col items-center', className)} style={style}>
      <svg viewBox="0 0 100 130" className="h-full w-full drop-shadow-lg" aria-hidden="true">
        <path d="M28 2 L48 50 L38 58 L12 10 Z" fill={theme.ribbonShadow} />
        <path d="M72 2 L52 50 L62 58 L88 10 Z" fill={theme.ribbon} />
        <circle cx="50" cy="79" r="35" fill={theme.rim} />
        <circle cx="50" cy="79" r="31" fill={theme.disc} stroke={theme.rim} strokeWidth="1.5" />
        <circle cx="50" cy="79" r="24" fill="none" stroke={theme.rim} strokeOpacity="0.4" strokeWidth="1" />
        <path d={theme.glyph} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {showLabel ? (
        <span className="mt-1 text-[10px] font-semibold tracking-[0.15em] text-white/70 uppercase">
          {theme.label}
        </span>
      ) : null}
    </div>
  )
}

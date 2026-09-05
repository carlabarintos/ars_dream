import { useId } from 'react'

import { cn } from '@/lib/utils'
import type { MedalCity } from '@/components/MedalIcon'

interface ArtTheme {
  sky: [string, string]
  accent: string
  ground: string
}

const ART_THEMES: Record<MedalCity, ArtTheme> = {
  'new-york': { sky: ['#0B1F3F', '#1E3A8A'], accent: '#F97316', ground: '#061530' },
  berlin: { sky: ['#3a0d14', '#7A1420'], accent: '#D4A017', ground: '#280a0f' },
  london: { sky: ['#001a5c', '#00247D'], accent: '#C8102E', ground: '#00113d' },
  tokyo: { sky: ['#0d0d0d', '#241414'], accent: '#BC002D', ground: '#000000' },
  sydney: { sky: ['#00301a', '#00512E'], accent: '#D4AF37', ground: '#001f10' },
}

/** A flat, line-art "postcard" illustration of one iconic landmark per city — drawn in the same
 * brand-illustration style as MedalIcon/RouteLines/BibCard rather than a licensed photo. */
export function DestinationArt({ city, className }: { city: MedalCity; className?: string }) {
  const theme = ART_THEMES[city]
  const uid = useId()
  const skyId = `${uid}-sky`

  return (
    <svg
      viewBox="0 0 240 140"
      preserveAspectRatio="xMidYMid slice"
      className={cn('h-full w-full', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.sky[0]} />
          <stop offset="100%" stopColor={theme.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="240" height="140" fill={`url(#${skyId})`} />

      {city === 'new-york' ? (
        <>
          <rect x="0" y="96" width="34" height="44" fill={theme.ground} opacity="0.6" />
          <rect x="30" y="82" width="22" height="58" fill={theme.ground} opacity="0.6" />
          <rect x="188" y="90" width="24" height="50" fill={theme.ground} opacity="0.6" />
          <rect x="208" y="76" width="32" height="64" fill={theme.ground} opacity="0.6" />
          <rect x="102" y="122" width="36" height="18" fill="#E8ECF2" />
          <rect x="108" y="104" width="24" height="20" fill="#DCE2EB" />
          <path d="M106 104 L112 60 Q120 54 128 60 L134 104 Z" fill="#C9D2DE" />
          <path d="M116 104 L119 62 M124 104 L121 62" stroke="#A9B4C4" strokeWidth="1.5" />
          <circle cx="120" cy="53" r="7" fill="#C9D2DE" />
          <path
            d="M108 48 L113 42 M114 44 L117 38 M120 43 L120 36 M126 44 L123 38 M132 48 L127 42"
            stroke="#C9D2DE"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path d="M127 58 L142 38" stroke="#C9D2DE" strokeWidth="4" strokeLinecap="round" />
          <path d="M142 38 L138 30 L144 26 L149 33 Z" fill={theme.accent} />
          <path d="M111 64 L102 70 L102 78 L110 78" fill="none" stroke="#C9D2DE" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}

      {city === 'berlin' ? (
        <>
          {[54, 78, 102, 126, 150, 174].map((x) => (
            <rect key={x} x={x} y="66" width="10" height="60" fill="#E9E4D8" opacity="0.9" />
          ))}
          <rect x="48" y="58" width="142" height="10" fill="#E9E4D8" />
          <path d="M96 58 L120 34 L144 58 Z" fill="#E9E4D8" opacity="0.9" />
          <path d="M112 42 Q120 30 128 42 L124 44 Q120 36 116 44 Z" fill={theme.accent} />
        </>
      ) : null}

      {city === 'london' ? (
        <>
          <rect x="98" y="40" width="26" height="100" fill="#D7DCE6" />
          <rect x="94" y="34" width="34" height="8" fill="#D7DCE6" />
          <circle cx="111" cy="58" r="9" fill={theme.sky[1]} stroke="#D7DCE6" strokeWidth="2" />
          <path d="M100 34 L111 14 L122 34 Z" fill="#D7DCE6" />
          <rect x="109" y="6" width="4" height="10" fill="#D7DCE6" />
          <rect x="44" y="112" width="58" height="24" rx="3" fill={theme.accent} />
          <rect x="50" y="118" width="12" height="8" fill="#EAF2FF" opacity="0.85" />
          <rect x="66" y="118" width="12" height="8" fill="#EAF2FF" opacity="0.85" />
          <rect x="82" y="118" width="12" height="8" fill="#EAF2FF" opacity="0.85" />
          <circle cx="58" cy="138" r="5" fill="#111" />
          <circle cx="88" cy="138" r="5" fill="#111" />
        </>
      ) : null}

      {city === 'tokyo' ? (
        <>
          <circle cx="46" cy="30" r="13" fill={theme.accent} opacity="0.9" />
          <path d="M60 122 L120 40 L180 122 Z" fill="#3a3a3a" />
          <path d="M105 62 L120 40 L135 62 Z" fill="#EDEDED" />
          <path
            d="M120 30 L140 132 L128 132 L120 82 L112 132 L100 132 Z"
            fill={theme.accent}
          />
          <path d="M105 100 L135 100 M110 118 L130 118" stroke="#EDEDED" strokeWidth="2" />
        </>
      ) : null}

      {city === 'sydney' ? (
        <>
          <path
            d="M20 90 Q120 20 220 90"
            fill="none"
            stroke="#E8E2CC"
            strokeWidth="4"
            opacity="0.85"
          />
          <path d="M58 92 Q80 32 102 92 Z" fill="#F5F1E6" />
          <path d="M90 96 Q114 28 138 96 Z" fill="#EDE8D9" />
          <path d="M126 96 Q148 40 170 96 Z" fill="#F5F1E6" />
          <rect x="20" y="96" width="200" height="6" fill="#00301a" opacity="0.6" />
        </>
      ) : null}

      <rect x="0" y="128" width="240" height="12" fill={theme.ground} opacity="0.55" />
    </svg>
  )
}

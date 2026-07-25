import { cn } from '@/lib/utils'

function RunnerIcon() {
  return (
    <svg viewBox="0 0 300 220" className="absolute" style={{ left: '0%', top: '18%', width: '30%', height: '61%' }}>
      <path
        d="M 8,125 C 5,85 25,40 75,25 C 115,15 155,25 178,50 C 184,58 178,66 168,60 C 145,48 115,38 85,52 C 55,66 35,90 30,120 C 28,132 12,140 8,125 Z"
        fill="currentColor"
      />
      <circle cx="190" cy="50" r="35" fill="currentColor" />
      <path
        d="M 172,95 C 205,85 240,95 265,120 C 273,128 268,138 258,133 C 238,124 218,128 205,145 C 195,158 200,175 215,188 C 222,194 216,202 205,198 C 185,190 172,170 170,145 C 168,125 168,108 172,95 Z"
        fill="currentColor"
      />
      <path
        d="M 108,178 C 95,195 75,208 50,213 C 38,215 30,217 33,207 C 35,199 47,198 58,192 C 75,183 88,170 96,155 C 102,145 110,140 115,146 C 119,158 116,170 108,178 Z"
        fill="currentColor"
      />
      <path
        d="M 33,207 C 30,217 38,215 50,213 C 58,211 66,214 63,220 C 51,223 36,223 24,220 C 18,218 20,209 27,207 Z"
        fill="currentColor"
      />
      <g clipPath="url(#globeClip)">
        <circle cx="150" cy="140" r="70" fill="#1D67CD" />
        <ellipse cx="150" cy="140" rx="25" ry="70" fill="none" stroke="#fff" strokeWidth="5" />
        <ellipse cx="150" cy="140" rx="50" ry="70" fill="none" stroke="#fff" strokeWidth="5" />
        <line x1="80" y1="140" x2="220" y2="140" stroke="#fff" strokeWidth="5" />
        <line x1="87" y1="110" x2="213" y2="110" stroke="#fff" strokeWidth="5" />
        <line x1="87" y1="170" x2="213" y2="170" stroke="#fff" strokeWidth="5" />
        <line x1="107" y1="85" x2="193" y2="85" stroke="#fff" strokeWidth="5" />
        <line x1="107" y1="195" x2="193" y2="195" stroke="#fff" strokeWidth="5" />
      </g>
      <defs>
        <clipPath id="globeClip">
          <circle cx="150" cy="140" r="70" />
        </clipPath>
      </defs>
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('relative inline-block', className)} style={{ aspectRatio: '460 / 150' }}>
      <svg viewBox="0 0 460 150" className="absolute inset-0 h-full w-full overflow-visible">
        <title>ARS Dream</title>
        <text
          x="158"
          y="88"
          fontFamily="Arial, Helvetica, sans-serif"
          fontWeight="800"
          fontSize="46"
          letterSpacing="0.5"
          fill="currentColor"
        >
          ARS DREAM
        </text>
        <text
          x="159"
          y="118"
          fontFamily="'Yu Gothic', 'Hiragino Sans', 'Noto Sans JP', Arial, sans-serif"
          fontSize="18"
          letterSpacing="2"
          fill="currentColor"
          opacity="0.6"
        >
          アールス ドリーム
        </text>
      </svg>
      <RunnerIcon />
    </span>
  )
}

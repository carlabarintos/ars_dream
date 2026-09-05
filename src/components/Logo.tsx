import { cn } from '@/lib/utils'
import { RunnerIcon } from '@/components/RunnerIcon'

function LogoGlobe() {
  return (
    <svg
      viewBox="0 0 300 220"
      className="absolute"
      style={{ left: '0%', top: '18%', width: '30%', height: '61%' }}
    >
      <g transform="translate(0, -4)" clipPath="url(#globeClip)">
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
      <RunnerIcon className="absolute top-[18%] left-0 h-[61%] w-[30%]" />
      <LogoGlobe />
    </span>
  )
}

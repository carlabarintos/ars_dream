import { cn } from '@/lib/utils'

function RunnerIcon() {
  return (
    <svg viewBox="0 0 300 210" className="absolute" style={{ left: '0%', top: '20%', width: '30%', height: '58%' }}>
      <path
        d="M 20,140 C 15,90 45,45 95,35 C 130,28 165,40 185,58 C 192,65 185,72 175,68 C 150,58 120,48 95,60 C 65,74 45,100 42,135 C 41,148 25,150 20,140 Z"
        fill="currentColor"
      />
      <circle cx="205" cy="60" r="32" fill="currentColor" />
      <path
        d="M 178,112 C 210,102 245,113 268,138 C 276,147 271,156 260,152 C 244,146 226,152 214,166 C 206,176 200,188 188,197 C 178,204 165,207 152,203 C 143,200 145,193 155,192 C 165,191 174,186 180,177 C 186,166 184,153 183,150 C 185,135 182,122 178,112 Z"
        fill="currentColor"
      />
      <path
        d="M 132,172 C 118,186 98,197 76,203 C 64,206 56,208 58,198 C 60,190 72,190 82,185 C 98,177 110,166 118,152 C 124,142 132,135 138,140 C 143,152 140,164 132,172 Z"
        fill="currentColor"
      />
      <path
        d="M 58,198 C 56,208 64,206 76,203 C 84,201 92,204 90,210 C 78,213 62,213 50,210 C 44,208 45,200 52,198 Z"
        fill="currentColor"
      />
      <g clipPath="url(#globeClip)">
        <circle cx="150" cy="130" r="55" fill="#1D67CD" />
        <ellipse cx="150" cy="130" rx="20" ry="55" fill="none" stroke="#fff" strokeWidth="4" />
        <ellipse cx="150" cy="130" rx="40" ry="55" fill="none" stroke="#fff" strokeWidth="4" />
        <line x1="95" y1="130" x2="205" y2="130" stroke="#fff" strokeWidth="4" />
        <line x1="99" y1="105" x2="201" y2="105" stroke="#fff" strokeWidth="4" />
        <line x1="99" y1="155" x2="201" y2="155" stroke="#fff" strokeWidth="4" />
        <line x1="111" y1="82" x2="189" y2="82" stroke="#fff" strokeWidth="4" />
        <line x1="111" y1="178" x2="189" y2="178" stroke="#fff" strokeWidth="4" />
      </g>
      <defs>
        <clipPath id="globeClip">
          <circle cx="150" cy="130" r="55" />
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

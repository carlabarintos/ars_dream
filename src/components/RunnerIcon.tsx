import { cn } from '@/lib/utils'

/** The runner silhouette from the ARS Dream wordmark, reused wherever the brand needs a standalone mark (e.g. the loading spinner). */
export function RunnerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 220" className={cn('overflow-visible', className)}>
      <g transform="translate(0, -4)">
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
      </g>
    </svg>
  )
}

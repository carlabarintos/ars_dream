import { cn } from '@/lib/utils'

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
      <img
        src="/logo-icon.png"
        alt=""
        className="absolute dark:hidden"
        style={{ left: '0%', top: `${(33 / 150) * 100}%`, width: `${(137 / 460) * 100}%`, height: `${(84 / 150) * 100}%` }}
      />
      <img
        src="/logo-icon-dark.png"
        alt=""
        className="absolute hidden dark:block"
        style={{ left: '0%', top: `${(33 / 150) * 100}%`, width: `${(137 / 460) * 100}%`, height: `${(84 / 150) * 100}%` }}
      />
    </span>
  )
}

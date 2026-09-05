import type { CSSProperties } from 'react'

export function RouteLines({
  className,
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 1200 500"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d="M -100 520 Q 400 300 1300 420" stroke="#fff" strokeWidth="1.5" fill="none" />
      <path d="M -100 460 Q 420 260 1300 360" stroke="#fff" strokeWidth="1.5" fill="none" />
      <path d="M -100 400 Q 440 220 1300 300" stroke="#fff" strokeWidth="1.5" fill="none" />
    </svg>
  )
}

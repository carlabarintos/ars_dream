export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 460 150" className={className}>
      <title>ARS Dream</title>
      <circle cx="68" cy="72" r="58" className="fill-primary" />
      <path d="M68 14 A58 58 0 0 1 68 130 A29 58 0 0 1 68 14 Z" fill="#ffffff" opacity="0.08" />
      <ellipse cx="68" cy="72" rx="58" ry="21" fill="none" stroke="#eaf3ff" strokeWidth="3" opacity="0.85" />
      <ellipse cx="68" cy="72" rx="21" ry="58" fill="none" stroke="#eaf3ff" strokeWidth="3" opacity="0.85" />
      <line x1="10" y1="72" x2="126" y2="72" stroke="#eaf3ff" strokeWidth="3" opacity="0.85" />
      <path d="M34 30 A58 58 0 0 1 34 114" fill="none" stroke="#eaf3ff" strokeWidth="2.5" opacity="0.6" />
      <path d="M102 30 A58 58 0 0 0 102 114" fill="none" stroke="#eaf3ff" strokeWidth="2.5" opacity="0.6" />
      <circle cx="46" cy="46" r="10" fill="#ffffff" opacity="0.3" />
      <text
        x="150"
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
        x="151"
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
  )
}

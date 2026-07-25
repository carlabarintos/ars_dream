export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 460 150" className={className}>
      <title>ARS Dream</title>
      <image
        href="/logo-icon.png"
        x="0"
        y="33"
        width="137"
        height="84"
        preserveAspectRatio="xMidYMid meet"
        className="dark:hidden"
      />
      <image
        href="/logo-icon-dark.png"
        x="0"
        y="33"
        width="137"
        height="84"
        preserveAspectRatio="xMidYMid meet"
        className="hidden dark:block"
      />
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
  )
}

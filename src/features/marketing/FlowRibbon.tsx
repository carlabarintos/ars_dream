import { useEffect, useRef } from 'react'

// Deterministic PRNG so the star field is identical on every render/visit.
let seed = 7
function rand() {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
// Roughly normal (-1.5..1.5), so stars bunch along the band's spine and thin out at its edges.
const spread = () => rand() + rand() + rand() - 1.5

// The band's spine: a slow S-curve down the page. t = 0..1 → x as % of page width.
const spineX = (t: number) => 50 + 28 * Math.sin(t * Math.PI * 4.4)

const COLORS = ['#ffffff', '#cfe0ff', '#8db6f5', 'var(--accent)', 'var(--primary)']

// Two depth layers: far stars are small/dim and drift slowly, near stars are brighter and faster.
function makeStars(count: number, maxSize: number) {
  return Array.from({ length: count }, () => {
    const t = rand() * 1.25 - 0.25 // start above the page so drifting down never leaves a gap
    return {
      top: t * 100,
      left: spineX(t) + spread() * 16,
      size: 1 + rand() * maxSize,
      color: COLORS[Math.floor(rand() * COLORS.length)],
      opacity: 0.35 + rand() * 0.65,
      twinkle: rand() < 0.3 ? `${rand() * -3}s` : undefined,
    }
  })
}
const FAR = makeStars(700, 1.8)
const NEAR = makeStars(160, 3.5)
const HAZE = Array.from({ length: 40 }, (_, i) => {
  const t = i / 39 - 0.1
  return { top: t * 100, left: spineX(t) + spread() * 8, size: 260 + rand() * 260 }
})

/**
 * A milky-way band of stars and soft nebula haze winding down the landing page behind the
 * content. It unveils downward as you scroll down (and recedes as you scroll up), while its two
 * star layers drift at different speeds for depth, so it feels like travelling through it.
 */
export function FlowRibbon() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let progress = 0
    let frame = 0

    function tick() {
      const y = window.scrollY
      // Keep the band's leading edge a bit below the middle of the viewport.
      const target = Math.min((y + window.innerHeight * 1.1) / document.documentElement.scrollHeight, 1)
      progress += (target - progress) * 0.08
      el!.style.setProperty('--reveal', `${progress * 100}%`)
      el!.style.setProperty('--far', `${y * 0.06}px`)
      el!.style.setProperty('--near', `${y * 0.16}px`)
      frame = Math.abs(target - progress) > 0.0005 ? requestAnimationFrame(tick) : 0
    }

    function onScroll() {
      if (!frame) frame = requestAnimationFrame(tick)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden motion-reduce:hidden"
      style={{
        ['--reveal' as string]: '0%',
        // Soft leading edge instead of a hard cut-off.
        maskImage: 'linear-gradient(to bottom, #000 calc(var(--reveal) - 500px), transparent var(--reveal))',
      }}
    >
      {HAZE.map((h, i) => (
        <span
          key={i}
          className="absolute -translate-1/2 rounded-full opacity-40 blur-3xl"
          style={{
            top: `${h.top}%`,
            left: `${h.left}%`,
            width: h.size,
            height: h.size,
            background: 'radial-gradient(circle, #8db6f5, transparent 70%)',
          }}
        />
      ))}
      {([['--far', FAR], ['--near', NEAR]] as const).map(([depth, stars]) => (
        <div key={depth} className="absolute inset-0" style={{ transform: `translateY(var(${depth}))` }}>
          {stars.map((s, i) => (
            <span
              key={i}
              className={`absolute rounded-full ${s.twinkle ? 'animate-pulse' : ''}`}
              style={{
                top: `${s.top}%`,
                left: `${s.left}%`,
                width: s.size,
                height: s.size,
                background: s.color,
                opacity: s.opacity,
                boxShadow: s.size > 2 ? `0 0 6px ${s.color}` : undefined,
                animationDelay: s.twinkle,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

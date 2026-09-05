import { useEffect, useState } from 'react'

/** Returns `window.scrollY * factor`, rAF-throttled, for a subtle scroll parallax offset. */
export function useParallax(factor: number) {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let ticking = false
    function onScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        setOffset(window.scrollY * factor)
        ticking = false
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [factor])

  return offset
}

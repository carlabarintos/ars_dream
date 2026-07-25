const FIELD_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/**
 * iOS Safari can still leave the page zoomed in after a text field blurs (e.g. if the
 * keyboard's autofill bar nudged the layout). Briefly forcing maximum-scale=1.0 in the
 * viewport meta tag snaps it back to 100%; restoring the original content afterward keeps
 * pinch-zoom available everywhere else.
 */
export function initIosZoomReset() {
  if (typeof window === 'undefined') return
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
  if (!isIos) return

  const viewport = document.querySelector('meta[name="viewport"]')
  if (!viewport) return
  const defaultContent = viewport.getAttribute('content') ?? ''

  document.addEventListener('focusout', (event) => {
    const target = event.target
    if (!(target instanceof HTMLElement) || !FIELD_TAGS.has(target.tagName)) return

    viewport.setAttribute('content', `${defaultContent}, maximum-scale=1.0`)
    window.setTimeout(() => {
      viewport.setAttribute('content', defaultContent)
    }, 300)
  })
}

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * A marathon's banner box. Wide images fill it (cropped); a vertical logo instead gets its own
 * uncropped column on the left, with `children` (overlays, title, badges) laid out in the pane beside it,
 * which shows `sideUrl` (a separate photo) when set, else plain navy.
 * `className` sets the box size; `imageClassName` styles the image layer (e.g. hover zoom).
 */
export function MarathonBanner({
  url,
  vertical,
  sideUrl,
  className,
  imageClassName,
  children,
}: {
  url?: string
  vertical?: boolean
  sideUrl?: string
  className?: string
  imageClassName?: string
  children?: ReactNode
}) {
  const image = url ? { backgroundImage: `url(${url})` } : undefined

  if (vertical) {
    return (
      <div className={cn('flex overflow-hidden', className)}>
        <div
          className={cn('aspect-[3/4] h-full shrink-0 bg-white bg-contain bg-center bg-no-repeat', imageClassName)}
          style={image}
        />
        <div className="bg-brand-navy relative min-w-0 flex-1 overflow-hidden">
          {sideUrl && (
            <div
              className={cn('absolute inset-0 bg-cover bg-center', imageClassName)}
              style={{ backgroundImage: `url(${sideUrl})` }}
            />
          )}
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <div className={cn('absolute inset-0 bg-cover bg-center', imageClassName)} style={image} />
      {children}
    </div>
  )
}
